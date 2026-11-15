import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { adminHarness } from './admin-harness.ts';

const { call, db } = adminHarness();

/** A visitor's browser keeping its cookies (by path). */
function browser(ip = '203.0.113.7') {
    const jar = new Map<string, { value: string; path: string }>();
    const app = createApp({ db: () => db, siteUrl: 'http://localhost:5173' });
    async function req(method: string, path: string, json?: unknown, headers: Record<string, string> = {}) {
        const url = `/api${path}`;
        const cookie = [...jar.entries()].filter(([, c]) => url.startsWith(c.path)).map(([k, c]) => `${k}=${c.value}`).join('; ');
        const res = await app.request(url, {
            method,
            headers: { ...(json === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { cookie } : {}), 'x-forwarded-for': ip, ...headers },
            body: json === undefined ? undefined : JSON.stringify(json),
        });
        for (const sc of res.headers.getSetCookie()) {
            const [pair, ...attrs] = sc.split(';').map((s) => s.trim());
            const [k, v] = pair!.split('=');
            const path = attrs.find((a) => a.toLowerCase().startsWith('path='))?.slice(5) ?? '/';
            if (!v || attrs.some((a) => /^max-age=0$/i.test(a))) jar.delete(k!);
            else jar.set(k!, { value: v, path });
        }
        const text = await res.text();
        return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
    }
    return { req, jar };
}

const state = { exhibitionId: '', slideId: '', hiddenSlideId: '', workId: '' };

beforeAll(async () => {
    // A published exhibition with works available, one available slide linked to a work and one hidden.
    const ex = await db.selectFrom('exhibitions').select(['id']).where('published', '=', true).where('kind', '=', 'exhibition').orderBy('starts_on', 'desc').executeTakeFirstOrThrow();
    const slides = await db.selectFrom('artworks').select(['id']).where('exhibition_id', '=', ex.id).where('image', 'is not', null).orderBy('position').limit(2).execute();
    await db.updateTable('exhibitions').set({ works_available: true, show_inquire: false }).where('id', '=', ex.id).execute();
    const artist = (await call('POST', '/admin/persons', { name: 'Inquiry Artist', profiles: ['artist'] })).body;
    const work = (await call('POST', '/admin/works', { artistId: artist.id, title: 'Asked About', priceCents: 1000 })).body;
    await db.updateTable('artworks').set({ available: true, hidden: false, work_id: work.id, title: 'Asked About', author: 'Inquiry Artist' }).where('id', '=', slides[0]!.id).execute();
    await db.updateTable('artworks').set({ hidden: true }).where('id', '=', slides[1]!.id).execute();
    Object.assign(state, { exhibitionId: ex.id, slideId: slides[0]!.id, hiddenSlideId: slides[1]!.id, workId: work.id });
});

describe('public inquiries', () => {
    it('identifies a new visitor, stores the inquiry with what they saw, and remembers the browser', async () => {
        const b = browser();
        expect((await b.req('GET', '/visitor')).body).toBeNull();
        const missing = await b.req('POST', '/inquiries', { item: { kind: 'slide', artworkId: state.slideId }, note: 'Hi' });
        expect(missing.status).toBe(400);
        expect(missing.body.details.map((d: any) => d.path)).toEqual(['name', 'email']);

        const res = await b.req('POST', '/inquiries', {
            item: { kind: 'slide', artworkId: state.slideId },
            name: 'Quinn Inquirer',
            email: 'Quinn@Example.com',
            note: '  Is it still available?\u0007\n\n\n\n\nThanks  ',
            pageUrl: '/exhibitions/x',
        });
        expect(res.status).toBe(201);
        expect(res.body).toEqual({ name: 'Quinn Inquirer' });
        expect(res.headers.getSetCookie().find((c) => c.startsWith('twelveten_who='))).toContain('HttpOnly');
        expect((await b.req('GET', '/visitor')).body).toEqual({ name: 'Quinn Inquirer' });

        // Known now: just a note.
        const again = await b.req('POST', '/inquiries', { item: { kind: 'slide', artworkId: state.slideId }, note: 'One more question' });
        expect(again.status).toBe(201);

        const person = (await call('GET', '/admin/persons?q=quinn@example.com')).body.items[0];
        expect(person).toMatchObject({ name: 'Quinn Inquirer', profiles: ['collector'] });
        const full = (await call('GET', `/admin/persons/${person.id}`)).body;
        const [second, first] = full.collectorProfile.inquiries;
        expect(first).toMatchObject({ source: 'slide', match: 'new', note: 'Is it still available?\n\n\nThanks', workId: state.workId, enteredEmail: 'quinn@example.com', pageUrl: '/exhibitions/x' });
        expect(first.item).toMatchObject({ title: 'Asked About', artist: 'Inquiry Artist' });
        expect(first.exhibition.id).toBe(state.exhibitionId);
        expect(second).toMatchObject({ match: 'known', enteredName: null, note: 'One more question' });

        // "Not you?"
        expect((await b.req('POST', '/visitor/forget')).status).toBe(204);
        expect((await b.req('GET', '/visitor')).body).toBeNull();
    });

    it('matches an existing person by email or other email', async () => {
        const known = (await call('POST', '/admin/persons', { name: 'Riley Known', email: 'riley@example.com' })).body;
        await call('PUT', `/admin/persons/${known.id}/emails`, { emails: ['riley@other.example'] });
        await browser('203.0.113.8').req('POST', '/inquiries', { item: { kind: 'slide', artworkId: state.slideId }, name: 'R', email: 'RILEY@example.com' });
        await browser('203.0.113.8').req('POST', '/inquiries', { item: { kind: 'slide', artworkId: state.slideId }, name: 'R', email: 'riley@other.example' });
        const p = (await call('GET', `/admin/persons/${known.id}`)).body;
        expect(p.collectorProfile.inquiries.map((i: any) => i.match).sort()).toEqual(['alias', 'email']);
    });

    it('refuses hidden slides, closed exhibitions, honeypots and floods', async () => {
        const b = browser('203.0.113.9');
        const who = { name: 'Sam', email: 'sam@example.com' };
        expect((await b.req('POST', '/inquiries', { item: { kind: 'slide', artworkId: state.hiddenSlideId }, ...who })).status).toBe(404);
        expect((await b.req('POST', '/inquiries', { item: { kind: 'exhibition', exhibitionId: state.exhibitionId }, ...who })).status).toBe(400);
        await db.updateTable('exhibitions').set({ show_inquire: true }).where('id', '=', state.exhibitionId).execute();
        const ok = await b.req('POST', '/inquiries', { item: { kind: 'exhibition', exhibitionId: state.exhibitionId }, ...who });
        expect(ok.status).toBe(201);
        // Bots: accepted, nothing stored.
        const before = (await db.selectFrom('inquiries').select((eb) => eb.fn.countAll<number>().as('n')).executeTakeFirst())!.n;
        expect((await b.req('POST', '/inquiries', { item: { kind: 'exhibition', exhibitionId: state.exhibitionId }, ...who, website: 'spam.example' })).status).toBe(201);
        expect((await db.selectFrom('inquiries').select((eb) => eb.fn.countAll<number>().as('n')).executeTakeFirst())!.n).toBe(before);
        // 5 per 10 minutes per address.
        let last = 0;
        for (let i = 0; i < 4; i++) last = (await b.req('POST', '/inquiries', { item: { kind: 'exhibition', exhibitionId: state.exhibitionId }, ...who })).status;
        expect(last).toBe(429);
        expect((await browser().req('POST', '/inquiries', { item: { kind: 'exhibition', exhibitionId: state.exhibitionId }, ...who }, { origin: 'https://evil.example' })).status).toBe(403);
    });
});

describe('admin inquiries', () => {
    it('lists new inquiries for the alert, dismisses them for everyone, and deletes spam', async () => {
        const unseen = (await call('GET', '/admin/inquiries/unseen')).body;
        expect(unseen.count).toBeGreaterThan(0);
        expect(unseen.items.length).toBeLessThanOrEqual(5);
        const one = unseen.items[0];
        const seen = (await call('POST', `/admin/inquiries/${one.id}/seen`)).body;
        expect(seen.seenAt).toBeTruthy();
        expect((await call('GET', '/admin/inquiries/unseen')).body.count).toBe(unseen.count - 1);
        expect((await call('GET', '/admin/inquiries?status=new')).body.total).toBe(unseen.count - 1);
        expect((await call('GET', '/admin/inquiries?q=Asked%20About')).body.total).toBeGreaterThan(0);
        await call('POST', '/admin/inquiries/seen');
        expect((await call('GET', '/admin/inquiries/unseen')).body.count).toBe(0);
        expect((await call('DELETE', `/admin/inquiries/${one.id}`)).status).toBe(204);
        expect((await call('DELETE', `/admin/inquiries/${one.id}`)).status).toBe(404);
    });

    it('keeps people with inquiries from being deleted, and moves inquiries on merge', async () => {
        const b = browser('203.0.113.10');
        await b.req('POST', '/inquiries', { item: { kind: 'slide', artworkId: state.slideId }, name: 'Taylor One', email: 'taylor@one.example' });
        const a = (await call('GET', '/admin/persons?q=taylor@one.example')).body.items[0];
        expect((await call('DELETE', `/admin/persons/${a.id}`)).status).toBe(409);
        const keep = (await call('POST', '/admin/persons', { name: 'Taylor Kept' })).body;
        const src = (await call('GET', `/admin/persons/${a.id}`)).body;
        const merged = (await call('POST', `/admin/persons/${a.id}/merge`, { intoId: keep.id, updatedAt: src.updatedAt, intoUpdatedAt: keep.updatedAt })).body;
        expect(merged.collectorProfile.inquiries).toHaveLength(1);
        // The browser now knows the kept person.
        expect((await b.req('GET', '/visitor')).body).toEqual({ name: 'Taylor Kept' });
    });
});
