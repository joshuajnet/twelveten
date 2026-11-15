import { describe, expect, it } from 'vitest';
import { adminHarness } from './admin-harness.ts';

const { db, call, rendered } = adminHarness();

async function newArtist(name: string) {
    return (await call('POST', '/admin/persons', { name, profiles: ['artist'] })).body as { id: string; name: string };
}

describe('works', () => {
    it('creates a work with images and records its initial inventory values', async () => {
        const artist = await newArtist('Wendy Works');
        const res = await call('POST', '/admin/works', {
            artistId: artist.id,
            title: 'Blue',
            inventoryNumber: 'TT-2026-001',
            priceCents: 450000,
            images: [{ url: '/media/uploads/a.jpg', alt: 'Blue, front' }, { url: '/media/uploads/b.jpg' }],
        });
        expect(res.status).toBe(201);
        expect(res.body).toMatchObject({
            artistName: 'Wendy Works',
            inventoryNumber: 'TT-2026-001',
            priceCents: 450000,
            currency: 'USD',
            status: 'available',
            images: [{ url: '/media/uploads/a.jpg', position: 0 }, { url: '/media/uploads/b.jpg', position: 1 }],
            image: { url: '/media/uploads/a.jpg' },
        });
        const history = await call('GET', `/admin/works/${res.body.id}/history`);
        expect(history.body.items.map((h: { field: string }) => h.field).sort()).toEqual(['price', 'status']);

        expect((await call('POST', '/admin/works', { artistId: artist.id, inventoryNumber: 'TT-2026-001' })).status).toBe(409);
        const plain = (await call('POST', '/admin/persons', { name: 'Not An Artist' })).body;
        expect((await call('POST', '/admin/works', { artistId: plain.id })).status).toBe(400);
        expect((await call('POST', '/admin/works', { artistId: artist.id, priceCents: -1 })).status).toBe(400);
        expect((await call('POST', '/admin/works', { artistId: artist.id, consignedOn: '2026-02-01', consignmentEndsOn: '2026-01-01' })).status).toBe(400);
    });

    it('numbers works with the artist’s initials and the next number', async () => {
        const a = await newArtist('Quincy Xavier-Zed');
        const b = await newArtist('Quentin Xu Zhang');
        const profile = async (id: string) => (await call('GET', `/admin/persons/${id}`)).body.artistProfile;
        expect((await profile(a.id)).inventoryPrefix).toBe('QXZ');
        expect((await profile(b.id)).inventoryPrefix).toBe('QXZH'); // clash: a later letter of the last name
        expect((await profile(a.id)).nextInventoryNumber).toBe('QXZ0001');

        const create = async (id: string, extra: Record<string, unknown> = {}) => (await call('POST', '/admin/works', { artistId: id, title: 'W', ...extra })).body.inventoryNumber;
        expect(await create(a.id)).toBe('QXZ0001');
        expect(await create(a.id, { title: 'Sister (QXZ007)' })).toBe('QXZ0007'); // code in the title is adopted
        expect(await create(a.id, { title: 'Again (QXZ0007)' })).toBe('QXZ0008'); // taken: next number instead
        expect(await create(a.id, { inventoryNumber: 'OLD-1' })).toBe('OLD-1');
        expect(await create(a.id)).toBe('QXZ0009');
        expect(await create(b.id)).toBe('QXZH0001');

        const p = await profile(a.id);
        const put = await call('PUT', `/admin/persons/${a.id}/artist-profile`, { inventoryPrefix: 'qx', updatedAt: p.updatedAt });
        expect(put.status).toBe(200);
        expect(put.body.artistProfile).toMatchObject({ inventoryPrefix: 'QX', nextInventoryNumber: 'QX0001' });
        const taken = await call('PUT', `/admin/persons/${a.id}/artist-profile`, { inventoryPrefix: 'QXZH', updatedAt: put.body.artistProfile.updatedAt });
        expect(taken.status).toBe(409);
        expect((await call('PUT', `/admin/persons/${a.id}/artist-profile`, { inventoryPrefix: 'Q1', updatedAt: put.body.artistProfile.updatedAt })).status).toBe(400);
    });

    it('writes one history row per changed tracked field, and none when nothing changes', async () => {
        const artist = await newArtist('Paul Price');
        const w = (await call('POST', '/admin/works', { artistId: artist.id, title: 'Red', priceCents: 100000 })).body;
        const historyCount = async () => (await call('GET', `/admin/works/${w.id}/history`)).body.items.length;
        const before = await historyCount();

        const raised = await call('PATCH', `/admin/works/${w.id}`, { updatedAt: w.updatedAt, priceCents: 125000, changeNote: 'Art fair pricing' });
        expect(raised.status).toBe(200);
        expect(await historyCount()).toBe(before + 1);
        const [latest] = (await call('GET', `/admin/works/${w.id}/history`)).body.items;
        expect(latest).toMatchObject({
            field: 'price',
            oldValue: { cents: 100000, currency: 'USD' },
            newValue: { cents: 125000, currency: 'USD' },
            note: 'Art fair pricing',
            userName: 'admin',
        });

        // Only non-tracked fields: no history row.
        const titled = await call('PATCH', `/admin/works/${w.id}`, { updatedAt: raised.body.updatedAt, title: 'Red (renamed)', priceCents: 125000 });
        expect(titled.status).toBe(200);
        expect(await historyCount()).toBe(before + 1);

        // Stale version → 409 and nothing recorded.
        expect((await call('PATCH', `/admin/works/${w.id}`, { updatedAt: w.updatedAt, priceCents: 1 })).status).toBe(409);
        expect(await historyCount()).toBe(before + 1);
    });

    it('records a sale with a buyer, shown in the buyer’s collection', async () => {
        const artist = await newArtist('Sally Sold');
        const buyer = (await call('POST', '/admin/persons', { name: 'Bea Buyer' })).body;
        const w = (await call('POST', '/admin/works', { artistId: artist.id, title: 'Green', priceCents: 50000 })).body;
        const sold = await call('PATCH', `/admin/works/${w.id}`, {
            updatedAt: w.updatedAt,
            status: 'sold',
            soldOn: '2026-11-01',
            salePriceCents: 45000,
            buyerId: buyer.id,
        });
        expect(sold.status).toBe(200);
        expect(sold.body).toMatchObject({ status: 'sold', buyer: { id: buyer.id, name: 'Bea Buyer' }, salePriceCents: 45000 });
        const history = (await call('GET', `/admin/works/${w.id}/history`)).body.items;
        expect(history.find((h: { field: string }) => h.field === 'sale').newValue).toMatchObject({ buyerName: 'Bea Buyer', cents: 45000, soldOn: '2026-11-01' });
        expect(history.find((h: { field: string }) => h.field === 'status')).toMatchObject({ oldValue: 'available', newValue: 'sold' });

        // Buying made them a collector: the work is in their collection (purchases are for people without one).
        let person = (await call('GET', `/admin/persons/${buyer.id}`)).body;
        expect(person.collectorProfile.collection[0].works.map((p: { id: string }) => p.id)).toEqual([w.id]);
        expect(person.purchases).toEqual([]);
        await call('DELETE', `/admin/persons/${buyer.id}/collector-profile`);
        person = (await call('GET', `/admin/persons/${buyer.id}`)).body;
        expect(person.purchases.map((p: { id: string }) => p.id)).toEqual([w.id]);
        expect((await call('PATCH', `/admin/works/${w.id}`, { updatedAt: sold.body.updatedAt, buyerId: '00000000-0000-4000-8000-000000000000' })).status).toBe(400);
    });

    it('lists, filters and paginates the inventory', async () => {
        const artist = await newArtist('Lena List');
        for (let i = 0; i < 4; i++) await call('POST', '/admin/works', { artistId: artist.id, title: `List ${i}`, status: i % 2 ? 'nfs' : 'available' });
        const mine = await call('GET', `/admin/works?artist=${artist.id}`);
        expect(mine.body.items.map((w: { title: string }) => w.title)).toEqual(['List 3', 'List 2', 'List 1', 'List 0']);
        const nfs = await call('GET', `/admin/works?artist=${artist.id}&status=nfs`);
        expect(nfs.body.items.map((w: { title: string }) => w.title)).toEqual(['List 3', 'List 1']);
        const p1 = await call('GET', `/admin/works?artist=${artist.id}&limit=3`);
        const p2 = await call('GET', `/admin/works?artist=${artist.id}&limit=3&page=2`);
        expect([p1.body.total, p1.body.page, p2.body.page]).toEqual([4, 1, 2]);
        expect([...p1.body.items, ...p2.body.items].map((w: { title: string }) => w.title)).toEqual(['List 3', 'List 2', 'List 1', 'List 0']);
        expect((await call('GET', `/admin/works?artist=${artist.id}&limit=3&page=5`)).body).toMatchObject({ items: [], total: 4 });
        expect((await call('GET', '/admin/works?page=0')).status).toBe(400);
        expect((await call('GET', '/admin/works?q=lena')).body.items.length).toBe(4);
        expect((await call('GET', '/admin/works?status=lost')).status).toBe(400);
    });

    it('adds, captions, reorders and removes images', async () => {
        const artist = await newArtist('Ivy Images');
        const w = (await call('POST', '/admin/works', { artistId: artist.id, title: 'Pics' })).body;
        await call('POST', `/admin/works/${w.id}/images`, { url: '/media/uploads/1.jpg' });
        await call('POST', `/admin/works/${w.id}/images`, { url: '/media/uploads/2.jpg' });
        let work = (await call('POST', `/admin/works/${w.id}/images`, { url: '/media/uploads/3.jpg' })).body;
        const ids = work.images.map((i: { id: string }) => i.id);
        work = (await call('PUT', `/admin/works/${w.id}/images/order`, { ids: [ids[2], ids[0], ids[1]] })).body;
        expect(work.images.map((i: { url: string }) => i.url)).toEqual(['/media/uploads/3.jpg', '/media/uploads/1.jpg', '/media/uploads/2.jpg']);
        expect((await call('PUT', `/admin/works/${w.id}/images/order`, { ids: [ids[0]] })).status).toBe(400);
        work = (await call('PATCH', `/admin/works/${w.id}/images/${ids[0]}`, { alt: 'Detail' })).body;
        expect(work.images[1].alt).toBe('Detail');
        work = (await call('DELETE', `/admin/works/${w.id}/images/${ids[2]}`)).body;
        expect(work.images.map((i: { position: number }) => i.position)).toEqual([0, 1]);
    });

    it('restores a work from history and records the change', async () => {
        const artist = await newArtist('Rhea Restore');
        const w = (await call('POST', '/admin/works', { artistId: artist.id, title: 'Before', priceCents: 1000 })).body;
        await call('PATCH', `/admin/works/${w.id}`, { updatedAt: w.updatedAt, title: 'After', priceCents: 2000 });
        const revs = (await call('GET', `/admin/revisions?entity=work&id=${w.id}`)).body.items;
        expect((await call('POST', `/admin/revisions/${revs.at(-1).id}/restore`)).status).toBe(200);
        const restored = (await call('GET', `/admin/works/${w.id}`)).body;
        expect(restored).toMatchObject({ title: 'Before', priceCents: 1000 });
        const [latest] = (await call('GET', `/admin/works/${w.id}/history`)).body.items;
        expect(latest).toMatchObject({ field: 'price', newValue: { cents: 1000 }, note: 'Restored from history' });
    });
});

describe('linking exhibition slides', () => {
    async function unlinkedSlide() {
        const row = await db.selectFrom('artworks').selectAll().where('work_id', 'is', null).where('image', 'is not', null).orderBy('id').executeTakeFirstOrThrow();
        return row;
    }

    it('links a slide to a person without an artist profile by creating the profile and a work from the slide', async () => {
        const slide = await unlinkedSlide();
        const person = (await call('POST', '/admin/persons', { name: 'Linda Linked' })).body;
        rendered.length = 0;
        const res = await call('POST', `/admin/artworks/${slide.id}/link`, { personId: person.id });
        expect(res.status).toBe(200);
        expect(res.body.link).toMatchObject({ personId: person.id, artistName: 'Linda Linked', workTitle: slide.title ?? '' });
        expect(rendered).toEqual([]);

        const after = (await call('GET', `/admin/persons/${person.id}`)).body;
        expect(after.profiles).toEqual(['artist']);
        expect(after.artistProfile.exhibitions.map((e: { id: string }) => e.id)).toContain(slide.exhibition_id);
        const work = (await call('GET', `/admin/works/${res.body.link.workId}`)).body;
        expect(work).toMatchObject({ dimensions: slide.dimensions, medium: slide.media, images: [{ url: slide.image }] });
        expect(work.slides.map((s: { artworkId: string }) => s.artworkId)).toEqual([slide.id]);

        // Admin reads of the exhibition carry the link; public reads don't.
        const e = await db.selectFrom('exhibitions').select(['slug', 'kind']).where('id', '=', slide.exhibition_id).executeTakeFirstOrThrow();
        const admin = (await call('GET', `/admin/exhibitions/${slide.exhibition_id}`)).body;
        expect(admin.artworks.find((a: { id: string }) => a.id === slide.id).link.workId).toBe(work.id);
        const pub = (await call('GET', `/exhibitions/${e.slug}?kind=${e.kind}`, undefined, 'anon')).body;
        expect(pub.artworks.every((a: { link?: unknown }) => a.link === undefined)).toBe(true);
    });

    it('links to an existing work without creating a new one, and unlinks', async () => {
        const slide = await unlinkedSlide();
        const artist = await newArtist('Ernest Existing');
        const work = (await call('POST', '/admin/works', { artistId: artist.id, title: 'Shown twice' })).body;
        const works = async () => (await call('GET', `/admin/works?artist=${artist.id}`)).body.items.length;
        const res = await call('POST', `/admin/artworks/${slide.id}/link`, { personId: artist.id, workId: work.id });
        expect(res.body.link.workId).toBe(work.id);
        expect(await works()).toBe(1);

        const other = await newArtist('Olga Other');
        expect((await call('POST', `/admin/artworks/${slide.id}/link`, { personId: other.id, workId: work.id })).status).toBe(400);

        const unlinked = await call('PATCH', `/admin/artworks/${slide.id}`, { updatedAt: res.body.updatedAt, workId: null });
        expect(unlinked.status).toBe(200);
        expect(unlinked.body.link).toBeNull();
        expect(await works()).toBe(1);
    });
});
