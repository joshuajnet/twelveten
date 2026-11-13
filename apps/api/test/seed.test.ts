import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { formatEvent, firstParagraph, richDocSchema } from '@twelveten/shared';
import { migrateToLatest } from '../src/db/migrate.ts';
import { seed } from '../src/db/seed.ts';
import { exhibitions } from '../seed-data/exhibitions.ts';
import { pressItems } from '../seed-data/press.ts';
import { resetSchema, testDb } from './db.ts';

const db = testDb();

beforeAll(async () => {
    await resetSchema(db);
    await migrateToLatest(db);
});
afterAll(() => db.destroy());

const count = async (table: 'exhibitions' | 'artworks' | 'exhibition_events' | 'press_items' | 'news_posts' | 'home_page') =>
    Number((await db.selectFrom(table).select((eb) => eb.fn.countAll().as('n')).executeTakeFirstOrThrow()).n);

describe('seed', () => {
    it('loads every exhibition, slide, event, press item, news post and the home page', async () => {
        const r = await seed(db);
        expect(r.skipped).toBe(false);
        expect(r.exhibitions).toBe(exhibitions.length);
        expect(await count('exhibitions')).toBe(17);
        expect(await count('press_items')).toBe(pressItems.length);
        expect(await count('news_posts')).toBe(24);
        expect(await count('home_page')).toBe(1);
        expect(r.artworks).toBeGreaterThan(400);
    });

    it('is skipped on the next run and changes nothing', async () => {
        const before = await Promise.all([count('exhibitions'), count('artworks'), count('press_items'), count('news_posts')]);
        expect((await seed(db)).skipped).toBe(true);
        expect(await Promise.all([count('exhibitions'), count('artworks'), count('press_items'), count('news_posts')])).toEqual(before);
    });

    it('keeps local edits unless forced', async () => {
        await db.updateTable('exhibitions').set({ title: 'Edited' }).where('slug', '=', 'africh-signal').execute();
        await db.deleteFrom('seed_state').execute();
        await seed(db);
        const kept = await db.selectFrom('exhibitions').select('title').where('slug', '=', 'africh-signal').executeTakeFirstOrThrow();
        expect(kept.title).toBe('Edited');

        const before = await count('artworks');
        await seed(db, { force: true });
        const restored = await db.selectFrom('exhibitions').select('title').where('slug', '=', 'africh-signal').executeTakeFirstOrThrow();
        expect(restored.title).toBe('Signal');
        expect(await count('artworks')).toBe(before);
    });

    it('stores valid rich documents with body, video and bio', async () => {
        const rows = await db.selectFrom('exhibitions').select(['slug', 'content']).execute();
        for (const r of rows) {
            expect(() => richDocSchema.parse(r.content), r.slug).not.toThrow();
            expect(firstParagraph(r.content).length, r.slug).toBeGreaterThan(20);
        }
        const delphic = rows.find((r) => r.slug === 'beech-delphic-future')!;
        expect(delphic.content.content[0]).toEqual({ type: 'video', attrs: { youtubeId: 'XaswpDf-jMI' } });
        expect(delphic.content.content.at(-1)?.type).toBe('bio');
        const nada = rows.find((r) => r.slug === 'nada-miami-2026')!;
        expect(nada.content.content.some((n) => n.type === 'figure')).toBe(true);
    });

    it('stores events that format back to the original text', async () => {
        const events = await db
            .selectFrom('exhibition_events as ev')
            .innerJoin('exhibitions as e', 'e.id', 'ev.exhibition_id')
            .select(['e.slug', 'e.timezone', 'ev.label', 'ev.starts_at', 'ev.ends_at'])
            .where('e.slug', 'in', ['africh-signal', 'rozell-as-above-so-below', 'coldbomb'])
            .orderBy('e.slug')
            .orderBy('ev.position')
            .execute();
        expect(events.map((e) => formatEvent({ label: e.label, startsAt: String(e.starts_at), endsAt: e.ends_at ? String(e.ends_at) : null }, e.timezone))).toEqual([
            'Opening: April 4th, 6PM — 9PM',
            'Opening: November 9th, 6PM — 9PM',
            'Opening: April 12th, 6PM — 9PM',
            'Artist Talk: April 25th, 6PM — 8PM',
        ]);
    });

    it('links press to exhibitions and the home splash to its fair', async () => {
        const linked = await db.selectFrom('press_items').select('exhibition_id').where('exhibition_id', 'is not', null).execute();
        expect(linked).toHaveLength(pressItems.filter((p) => p.exhibition).length);
        const homeLink = await db
            .selectFrom('home_page')
            .innerJoin('exhibitions', 'exhibitions.id', 'home_page.link_exhibition_id')
            .select('exhibitions.slug')
            .executeTakeFirstOrThrow();
        expect(homeLink.slug).toBe('nada-miami-2026');
    });

    it('sanitizes news HTML and fixes legacy data errors', async () => {
        const posts = await db.selectFrom('news_posts').select(['slug', 'title', 'published_at', 'body_html']).execute();
        for (const p of posts) expect(p.body_html, p.slug).not.toMatch(/targe=|<A |<a\/>|<a><\/a>/);
        expect(posts.find((p) => p.slug === '14-1-2024')!.published_at.startsWith('2024-01-14')).toBe(true);
        expect(posts.find((p) => p.slug === '6-6-2026')!.title).toBe('2026 Summer Updates');
    });
});
