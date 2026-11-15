import { describe, expect, it } from 'vitest';
import { extractBios, isInstallationView, seedArtistBios, seedArtists } from '../src/db/seedArtists.ts';
import { adminHarness } from './admin-harness.ts';

const { db, call } = adminHarness();

const doc = (text: string, variant?: string) => ({
    type: 'doc',
    content: [{ type: 'paragraph', ...(variant ? { attrs: { variant } } : {}), content: [{ type: 'text', text }] }],
});

async function personBySlug(slug: string) {
    const row = await db.selectFrom('artist_profiles').select('person_id').where('slug', '=', slug).executeTakeFirstOrThrow();
    return (await call('GET', `/admin/persons/${row.person_id}`)).body;
}

describe('access', () => {
    it('requires an admin for every people, address and inventory route', async () => {
        const id = '00000000-0000-4000-8000-000000000000';
        const routes: [string, string][] = [
            ['GET', '/admin/persons'],
            ['POST', '/admin/persons'],
            ['GET', `/admin/persons/${id}`],
            ['PATCH', `/admin/persons/${id}`],
            ['DELETE', `/admin/persons/${id}`],
            ['PUT', `/admin/persons/${id}/artist-profile`],
            ['PUT', `/admin/persons/${id}/artist-profile/exhibitions`],
            ['GET', `/admin/persons/${id}/artist-profile/cv.pdf`],
            ['GET', `/admin/addresses?entity=person&id=${id}`],
            ['POST', '/admin/addresses'],
            ['PATCH', `/admin/address-links/${id}`],
            ['GET', '/admin/works'],
            ['POST', '/admin/works'],
            ['GET', `/admin/works/${id}`],
            ['GET', `/admin/works/${id}/history`],
            ['PATCH', `/admin/works/${id}`],
            ['POST', `/admin/artworks/${id}/link`],
        ];
        for (const [method, path] of routes) {
            expect([method, path, (await call(method, path, method === 'GET' ? undefined : {}, 'anon')).status]).toEqual([method, path, 401]);
            expect([method, path, (await call(method, path, method === 'GET' ? undefined : {}, 'user')).status]).toEqual([method, path, 403]);
        }
    });
});

describe('artists backfill', () => {
    it('creates artist profiles from exhibition artist lines and links them', async () => {
        const africh = await personBySlug('noelle-africh');
        expect(africh.name).toBe('Noelle Africh');
        expect(africh.sortName).toBe('Africh, Noelle');
        expect(africh.profiles).toEqual(['artist']);
        const slugs = africh.artistProfile.exhibitions.map((e: { slug: string }) => e.slug);
        expect(slugs).toContain('africh-signal');
        expect(slugs.length).toBeGreaterThanOrEqual(3);
    });

    it('turns credited slides into linked works', async () => {
        const rozell = await personBySlug('trey-rozell');
        expect(rozell.artistProfile.works.length).toBeGreaterThan(0);
        const slides = await db.selectFrom('artworks').selectAll().where('author', '=', 'Trey Rozell').execute();
        const works = slides.filter((s) => !isInstallationView(s));
        expect(works.length).toBeGreaterThan(0);
        expect(works.every((r) => r.work_id)).toBe(true);
    });

    it('leaves installation views unlinked', async () => {
        const installs = await db
            .selectFrom('artworks')
            .select(['work_id'])
            .where((eb) => eb.or([eb('title', 'ilike', '%installation view%'), eb('dimensions', 'ilike', '%installation view%')]))
            .execute();
        expect(installs.length).toBeGreaterThan(0);
        expect(installs.every((r) => r.work_id === null)).toBe(true);
        expect(await db.selectFrom('works').select('id').where('title', 'ilike', '%installation view%').execute()).toEqual([]);
    });

    it('fills artist bios from exhibition pages', async () => {
        const africh = await personBySlug('noelle-africh');
        const text = JSON.stringify(africh.artistProfile.bio);
        expect(text).toContain('Noelle Africh');
        expect(text).toContain('School of the Art Institute of Chicago');
        expect(text).not.toContain('italic');
        // Group shows: each artist gets only their own paragraph.
        const bornstein = await personBySlug('sam-bornstein');
        expect(JSON.stringify(bornstein.artistProfile.bio)).toContain('Hunter College');
        expect(JSON.stringify(bornstein.artistProfile.bio)).not.toContain('Aisling Hamrogue');
    });

    it('never overwrites a bio that has text', async () => {
        const p = await personBySlug('trey-rozell');
        await call('PUT', `/admin/persons/${p.id}/artist-profile`, { updatedAt: p.artistProfile.updatedAt, bio: doc('Written by hand') });
        await seedArtistBios(db, { force: true });
        expect(JSON.stringify((await personBySlug('trey-rozell')).artistProfile.bio)).toContain('Written by hand');
    });

    it('splits a bio section by the bold artist names', () => {
        const bold = (t: string) => ({ type: 'text', text: t, marks: [{ type: 'bold' }] });
        const para = (...content: object[]) => ({ type: 'paragraph', attrs: { variant: 'italic' }, content });
        const bios = extractBios({
            type: 'doc',
            content: [
                para({ type: 'text', text: 'Not a bio' }),
                { type: 'bio', content: [para(bold('Ann A'), { type: 'text', text: ' one.' }), para({ type: 'text', text: 'More about Ann.' }), para(bold('Bo B'), { type: 'text', text: ' two.' })] },
            ],
        } as never);
        expect([...bios.keys()]).toEqual(['ann a', 'bo b']);
        expect(bios.get('ann a')).toHaveLength(2);
        expect(bios.get('bo b')![0]).toEqual({ type: 'paragraph', content: [bold('Bo B'), { type: 'text', text: ' two.' }] });
    });

    it('is idempotent', async () => {
        const count = async () => Promise.all(['persons', 'artist_profiles', 'exhibition_artists', 'works', 'work_images'].map(async (t) => Number((await db.selectFrom(t as 'persons').select((eb) => eb.fn.countAll().as('n')).executeTakeFirstOrThrow()).n)));
        const before = await count();
        expect((await seedArtists(db)).skipped).toBe(true);
        const forced = await seedArtists(db, { force: true });
        expect(forced).toMatchObject({ artists: 0, links: 0, works: 0 });
        expect(await count()).toEqual(before);
    });
});

describe('people', () => {
    it('creates, reads, updates with a version check, and deletes a person', async () => {
        const created = await call('POST', '/admin/persons', { name: 'Ada Collector', email: 'ada@example.com', phone: '+1 918 555 0100' });
        expect(created.status).toBe(201);
        expect(created.body).toMatchObject({ name: 'Ada Collector', email: 'ada@example.com', profiles: [], artistProfile: null, addresses: [] });
        const id = created.body.id;

        const updated = await call('PATCH', `/admin/persons/${id}`, { updatedAt: created.body.updatedAt, birthDate: '1970-05-01', email: '' });
        expect(updated.status).toBe(200);
        expect(updated.body).toMatchObject({ birthDate: '1970-05-01', email: null });

        const stale = await call('PATCH', `/admin/persons/${id}`, { updatedAt: created.body.updatedAt, name: 'Stale' });
        expect(stale.status).toBe(409);
        expect(stale.body.details.current.birthDate).toBe('1970-05-01');

        expect((await call('PATCH', `/admin/persons/${id}`, { updatedAt: updated.body.updatedAt, email: 'not-an-email' })).status).toBe(400);
        expect((await call('POST', '/admin/persons', { name: '' })).status).toBe(400);

        const revs = await call('GET', `/admin/revisions?entity=person&id=${id}`);
        expect(revs.body.items.map((r: { action: string }) => r.action)).toEqual(['update', 'create']);

        expect((await call('DELETE', `/admin/persons/${id}`)).status).toBe(204);
        expect((await call('GET', `/admin/persons/${id}`)).status).toBe(404);
        expect((await call('GET', '/admin/persons/not-a-uuid')).status).toBe(404);
    });

    it('lists people with a profile filter, search and pagination', async () => {
        await call('POST', '/admin/persons', { name: 'Zed Nobody' });
        const all = await call('GET', '/admin/persons?limit=50');
        const artists = await call('GET', '/admin/persons?profile=artist&limit=50');
        const none = await call('GET', '/admin/persons?profile=none&limit=50');
        expect(all.status).toBe(200);
        expect(artists.body.items.every((p: { profiles: string[] }) => p.profiles.includes('artist'))).toBe(true);
        expect(none.body.items.map((p: { name: string }) => p.name)).toContain('Zed Nobody');
        expect(artists.body.items.map((p: { name: string }) => p.name)).not.toContain('Zed Nobody');
        expect((await call('GET', '/admin/persons?profile=wizard')).status).toBe(400);

        const africh = artists.body.items.find((p: { name: string }) => p.name === 'Noelle Africh');
        expect(africh.artist).toMatchObject({ slug: 'noelle-africh' });
        expect(africh.artist.lastExhibition).toBeTruthy();

        // Numbered pages: sorted by sort name, no overlap, together they cover the list, with the total.
        const total = artists.body.total;
        expect(total).toBe(artists.body.items.length);
        const seen: string[] = [];
        for (let page = 1; page <= Math.ceil(total / 7); page++) {
            const res = await call('GET', `/admin/persons?profile=artist&limit=7&page=${page}`);
            expect(res.body).toMatchObject({ page, pageSize: 7, total });
            seen.push(...res.body.items.map((p: { id: string }) => p.id));
        }
        expect(seen).toEqual(artists.body.items.map((p: { id: string }) => p.id));
        const sortNames = artists.body.items.map((p: { sortName: string | null; name: string }) => (p.sortName ?? p.name).toLowerCase());
        expect(sortNames).toEqual([...sortNames].sort());
        // Past the end: no items, but the total is still known.
        expect((await call('GET', '/admin/persons?profile=artist&page=99')).body).toMatchObject({ items: [], total, page: 99 });
        expect((await call('GET', '/admin/persons?page=0')).status).toBe(400);
        expect((await call('GET', '/admin/persons?limit=500')).status).toBe(400);

        const search = await call('GET', '/admin/persons?q=afri');
        expect(search.body.items.map((p: { name: string }) => p.name)).toEqual(['Noelle Africh']);
    });

    it('adds, edits and removes an artist profile', async () => {
        const p = (await call('POST', '/admin/persons', { name: 'Iris New' })).body;
        const added = await call('PUT', `/admin/persons/${p.id}/artist-profile`, {});
        expect(added.status).toBe(201);
        expect(added.body.artistProfile).toMatchObject({ slug: 'iris-new', exhibitions: [], works: [] });

        const ap = added.body.artistProfile;
        expect((await call('PUT', `/admin/persons/${p.id}/artist-profile`, { bio: doc('x') })).status).toBe(400);
        const edited = await call('PUT', `/admin/persons/${p.id}/artist-profile`, {
            updatedAt: ap.updatedAt,
            bio: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bio', marks: [{ type: 'link', attrs: { href: 'javascript:x' } }] }] }, { type: 'script' }] },
            cv: doc('Solo exhibitions', 'lead'),
        });
        expect(edited.status).toBe(200);
        expect(JSON.stringify(edited.body.artistProfile.bio)).not.toMatch(/javascript|script/);
        expect(edited.body.artistProfile.cv.content[0].attrs.variant).toBe('lead');
        expect((await call('PUT', `/admin/persons/${p.id}/artist-profile`, { updatedAt: ap.updatedAt, cv: doc('stale') })).status).toBe(409);

        // Can't delete a person with an artist profile, or a profile with works.
        expect((await call('DELETE', `/admin/persons/${p.id}`)).status).toBe(409);
        const work = await call('POST', '/admin/works', { artistId: p.id, title: 'Untitled' });
        expect((await call('DELETE', `/admin/persons/${p.id}/artist-profile`)).status).toBe(409);
        await call('DELETE', `/admin/works/${work.body.id}`);
        const removed = await call('DELETE', `/admin/persons/${p.id}/artist-profile`);
        expect(removed.status).toBe(200);
        expect(removed.body.profiles).toEqual([]);
        expect((await call('DELETE', `/admin/persons/${p.id}`)).status).toBe(204);
    });

    it('creates a person with an artist profile in one step', async () => {
        const res = await call('POST', '/admin/persons', { name: 'Noelle Africh', profiles: ['artist'] });
        expect(res.status).toBe(201);
        // The slug is unique even when the name repeats.
        expect(res.body.artistProfile.slug).toBe('noelle-africh-2');
    });

    it('replaces the linked exhibitions', async () => {
        const africh = await personBySlug('noelle-africh');
        const signal = africh.artistProfile.exhibitions.find((e: { slug: string }) => e.slug === 'africh-signal');
        const res = await call('PUT', `/admin/persons/${africh.id}/artist-profile/exhibitions`, { exhibitionIds: [signal.id] });
        expect(res.status).toBe(200);
        expect(res.body.artistProfile.exhibitions.map((e: { slug: string }) => e.slug)).toEqual(['africh-signal']);
        expect((await call('PUT', `/admin/persons/${africh.id}/artist-profile/exhibitions`, { exhibitionIds: ['00000000-0000-4000-8000-000000000000'] })).status).toBe(400);
    });

    it('downloads the CV as a PDF', async () => {
        const africh = await personBySlug('noelle-africh');
        const res = await call('GET', `/admin/persons/${africh.id}/artist-profile/cv.pdf`);
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('application/pdf');
        expect(res.headers.get('content-disposition')).toContain('noelle-africh-cv.pdf');
        expect(res.bytes!.subarray(0, 5).toString()).toBe('%PDF-');
    });
});

describe('privacy', () => {
    it('keeps prices and contact details out of public responses', async () => {
        const africh = await personBySlug('noelle-africh');
        await call('PATCH', `/admin/persons/${africh.id}`, { updatedAt: africh.updatedAt, email: 'noelle@example.com', phone: '555-0199' });
        const work = africh.artistProfile.works[0] ?? (await call('POST', '/admin/works', { artistId: africh.id, title: 'Priced' })).body;
        const full = (await call('GET', `/admin/works/${work.id}`)).body;
        await call('PATCH', `/admin/works/${work.id}`, { updatedAt: full.updatedAt, priceCents: 987654 });

        for (const path of ['/exhibitions/africh-signal', '/exhibitions', '/home', '/news', '/press']) {
            const text = JSON.stringify((await call('GET', path, undefined, 'anon')).body);
            expect(text).not.toMatch(/987654|9,876|noelle@example\.com|555-0199|priceCents|workId|artistName/);
        }
    });
});
