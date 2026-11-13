import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'kysely';
import { migrateToLatest, migrations } from '../src/db/migrate.ts';
import { resetSchema, schemaSnapshot, testDb } from './db.ts';

const db = testDb();

beforeAll(async () => {
    await resetSchema(db);
});

afterAll(async () => {
    await db.destroy();
});

describe('migrations', () => {
    let first = '';

    it('applies every migration on an empty database', async () => {
        const { results } = await migrateToLatest(db);
        expect(results?.map((r) => [r.migrationName, r.status])).toEqual(
            Object.keys(migrations).map((name) => [name, 'Success']),
        );
        first = await schemaSnapshot(db);
        expect(first).toContain('exhibitions.slug:text:NO');
        expect(first).toContain('artworks_position_uq');
    });

    it('is a no-op the second time', async () => {
        const { results } = await migrateToLatest(db);
        expect(results).toEqual([]);
        expect(await schemaSnapshot(db)).toBe(first);
    });

    it('re-runs cleanly without bookkeeping tables and leaves the schema unchanged', async () => {
        await sql`DROP TABLE kysely_migration, kysely_migration_lock`.execute(db);
        const { results } = await migrateToLatest(db);
        expect(results?.every((r) => r.status === 'Success')).toBe(true);
        expect(await schemaSnapshot(db)).toBe(first);
    });

    it('generates UUID ids and maintains updated_at', async () => {
        const row = await db
            .insertInto('exhibitions')
            .values({ slug: 'test-show', title: 'Test', starts_on: '2026-04-04', ends_on: '2026-05-23', content: JSON.stringify({ type: 'doc', content: [] }) })
            .returningAll()
            .executeTakeFirstOrThrow();
        expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
        expect(row.starts_on).toBe('2026-04-04');
        await sql`SELECT pg_sleep(0.01)`.execute(db);
        const updated = await db.updateTable('exhibitions').set({ title: 'Changed' }).where('id', '=', row.id).returningAll().executeTakeFirstOrThrow();
        expect(updated.updated_at > row.updated_at).toBe(true);
    });

    it('enforces data rules', async () => {
        const base = { title: 'Bad', content: JSON.stringify({ type: 'doc', content: [] }) };
        await expect(
            db.insertInto('exhibitions').values({ ...base, slug: 'bad-dates', starts_on: '2026-05-01', ends_on: '2026-04-01' }).execute(),
        ).rejects.toThrow(/exhibitions_dates_chk/);
        await expect(
            db.insertInto('exhibitions').values({ ...base, slug: 'Bad Slug', starts_on: '2026-04-01', ends_on: '2026-04-02' }).execute(),
        ).rejects.toThrow(/check constraint/);
    });
});
