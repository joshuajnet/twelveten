import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { exhibitionSchema, homePageSchema, newsPostSchema, pressItemSchema } from '@twelveten/shared';
import { createApp } from '../src/app.ts';
import { migrateToLatest } from '../src/db/migrate.ts';
import { seed } from '../src/db/seed.ts';
import { encodeCursor } from '../src/content/cursor.ts';
import { resetSchema, testDb } from './db.ts';

const db = testDb();
const asPublic = createApp({ db: () => db });
const asAdmin = createApp({ db: () => db, resolveUser: async () => ({ id: '00000000-0000-4000-8000-000000000000', role: 'admin' }) });

const get = async (app: typeof asPublic, path: string) => {
    const res = await app.request(`/api${path}`);
    return { status: res.status, headers: res.headers, body: (await res.json()) as any };
};

beforeAll(async () => {
    await resetSchema(db);
    await migrateToLatest(db);
    await seed(db);
});
afterAll(() => db.destroy());

describe('public content API', () => {
    it('GET /home links the splash to its fair', async () => {
        const { status, body, headers } = await get(asPublic, '/home');
        expect(status).toBe(200);
        expect(homePageSchema.parse(body).link?.slug).toBe('nada-miami-2026');
        expect(headers.get('cache-control')).toContain('s-maxage=60');
    });

    it('GET /exhibitions lists by kind, newest first', async () => {
        const all = (await get(asPublic, '/exhibitions')).body.items;
        const fairs = (await get(asPublic, '/exhibitions?kind=fair')).body.items;
        expect(all).toHaveLength(17);
        expect(fairs.map((f: any) => f.slug)).toEqual(['nada-miami-2026', 'neighbors-chicago-2026', 'nada-miami-2025']);
        expect((await get(asPublic, '/exhibitions?kind=bogus')).status).toBe(400);
    });

    it('GET /exhibitions/:slug returns the full page', async () => {
        const { status, body } = await get(asPublic, '/exhibitions/africh-signal');
        expect(status).toBe(200);
        const e = exhibitionSchema.parse(body);
        expect(e.events.map((ev) => ev.label)).toEqual(['Opening']);
        expect(e.artworks.length).toBeGreaterThan(5);
        expect(e.artworks.every((a) => !a.hidden)).toBe(true);
        expect(e.press.map((p) => p.outlet)).toEqual(['Newcity Art']);
        expect((await get(asPublic, '/exhibitions/africh-signal?kind=fair')).status).toBe(404);
        expect((await get(asPublic, '/exhibitions/nope')).status).toBe(404);
    });

    it('hides drafts and hidden slides from the public but not from admins', async () => {
        await db.updateTable('exhibitions').set({ published: false }).where('slug', '=', 'coldbomb').execute();
        await db.updateTable('artworks').set({ hidden: true }).where('exhibition_id', '=', db.selectFrom('exhibitions').select('id').where('slug', '=', 'africh-signal')).where('position', '=', 0).execute();
        try {
            expect((await get(asPublic, '/exhibitions/coldbomb')).status).toBe(404);
            expect((await get(asPublic, '/exhibitions')).body.items).toHaveLength(16);
            const admin = await get(asAdmin, '/exhibitions/coldbomb');
            expect(admin.status).toBe(200);
            expect(admin.headers.get('cache-control')).toBe('private, no-store');
            const pub = (await get(asPublic, '/exhibitions/africh-signal')).body.artworks.length;
            const adm = (await get(asAdmin, '/exhibitions/africh-signal')).body.artworks.length;
            expect(adm).toBe(pub + 1);
        } finally {
            await db.updateTable('exhibitions').set({ published: true }).where('slug', '=', 'coldbomb').execute();
            await db.updateTable('artworks').set({ hidden: false }).where('position', '=', 0).execute();
        }
    });
});

describe('cursor pagination', () => {
    async function walk(path: string, limit?: number) {
        const seen: any[] = [];
        let cursor: string | null = null;
        let pages = 0;
        do {
            const qs = new URLSearchParams();
            if (cursor) qs.set('cursor', cursor);
            if (limit) qs.set('limit', String(limit));
            const { body } = await get(asPublic, `${path}?${qs}`);
            seen.push(...body.items);
            cursor = body.nextCursor;
            pages++;
        } while (cursor && pages < 100);
        return { seen, pages };
    }

    it('returns 10 news posts per batch and every post exactly once', async () => {
        const first = await get(asPublic, '/news');
        expect(first.body.items).toHaveLength(10);
        newsPostSchema.parse(first.body.items[0]);
        const { seen, pages } = await walk('/news');
        expect(pages).toBe(3);
        expect(seen).toHaveLength(24);
        expect(new Set(seen.map((n) => n.id)).size).toBe(24);
        const dates = seen.map((n) => n.publishedAt);
        expect([...dates].sort().reverse()).toEqual(dates);
    });

    it('caps the batch size at 50 and ignores bad limits', async () => {
        expect((await get(asPublic, '/news?limit=500')).body.items).toHaveLength(24);
        expect((await get(asPublic, '/news?limit=-3')).body.items).toHaveLength(10);
    });

    it('is stable when items share a date and when items are added mid-walk', async () => {
        // Give several press items the same date so ordering falls back to id.
        await db.updateTable('press_items').set({ published_on: '2024-07-25' }).where('outlet', '=', 'Art Viewer').execute();
        const first = await get(asPublic, '/press?limit=7');
        // A newer item appears after the first batch was read.
        await db.insertInto('press_items').values({ outlet: 'New', title: 'Newer', url: 'https://new.example/1', published_on: '2030-01-01', published: true }).execute();
        const seen = [...first.body.items];
        let cursor = first.body.nextCursor;
        while (cursor) {
            const { body } = await get(asPublic, `/press?limit=7&cursor=${cursor}`);
            seen.push(...body.items);
            cursor = body.nextCursor;
        }
        expect(seen).toHaveLength(20);
        expect(new Set(seen.map((p) => p.id)).size).toBe(20);
        seen.forEach((p) => pressItemSchema.parse(p));
        await db.deleteFrom('press_items').where('url', '=', 'https://new.example/1').execute();
    });

    it('filters press by exhibition', async () => {
        const { body } = await get(asPublic, '/press?exhibition=brain-worms');
        expect(body.items).toHaveLength(3);
        expect(body.nextCursor).toBeNull();
    });

    it('rejects malformed cursors', async () => {
        expect((await get(asPublic, '/news?cursor=garbage')).status).toBe(400);
        expect((await get(asPublic, `/news?cursor=${encodeCursor({ sort: 'x', id: 'not-a-uuid' })}`)).status).toBe(400);
    });

    it('GET /news/:slug', async () => {
        expect((await get(asPublic, '/news/7-1-2026')).body.title).toContain('Anatomy of Habit');
        expect((await get(asPublic, '/news/missing')).status).toBe(404);
    });
});
