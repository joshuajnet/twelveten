import { describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import { createDb } from './db/index.ts';

describe('GET /api/health', () => {
    it('reports the database as up', async () => {
        const db = createDb(process.env.DATABASE_URL!, 1);
        const res = await createApp({ db: () => db }).request('/api/health');
        await db.destroy();
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: true, db: 'up' });
    });

    it('reports 503 when the database is unreachable', async () => {
        const db = createDb('postgres://nobody:nothing@127.0.0.1:1/none', 1);
        const res = await createApp({ db: () => db }).request('/api/health');
        await db.destroy();
        expect(res.status).toBe(503);
    });

    it('returns JSON 404s', async () => {
        const db = createDb(process.env.DATABASE_URL!, 1);
        const res = await createApp({ db: () => db }).request('/api/nope');
        await db.destroy();
        expect(res.status).toBe(404);
    });
});
