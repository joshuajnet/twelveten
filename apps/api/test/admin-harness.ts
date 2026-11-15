import { afterAll, beforeAll } from 'vitest';
import { createApp } from '../src/app.ts';
import { migrateToLatest } from '../src/db/migrate.ts';
import { seed } from '../src/db/seed.ts';
import { upsertAdmin } from '../src/auth/users.ts';
import type { Publisher } from '../src/publish/publisher.ts';
import { resetSchema, testDb } from './db.ts';

/** Fresh seeded database plus admin / user / anonymous request helpers for one test file. */
export function adminHarness() {
    const db = testDb();
    const state = { adminId: '' };
    const rendered: string[][] = [];
    const publisher: Publisher = { render: async (paths) => void rendered.push(paths), rebuildAll: async () => ({ pages: 0 }) };

    const apps = {
        admin: () => createApp({ db: () => db, publisher, resolveUser: async () => ({ id: state.adminId, role: 'admin' }) }),
        user: () => createApp({ db: () => db, resolveUser: async () => ({ id: state.adminId, role: 'user' }) }),
        anon: () => createApp({ db: () => db }),
    };

    async function call(method: string, path: string, json?: unknown, as: keyof typeof apps = 'admin') {
        const res = await apps[as]().request(`/api${path}`, {
            method,
            headers: json === undefined ? {} : { 'Content-Type': 'application/json' },
            body: json === undefined ? undefined : JSON.stringify(json),
        });
        const type = res.headers.get('content-type') ?? '';
        if (type.includes('application/pdf')) return { status: res.status, body: null as any, bytes: Buffer.from(await res.arrayBuffer()), headers: res.headers };
        const text = await res.text();
        return { status: res.status, body: text ? (JSON.parse(text) as any) : null, bytes: null, headers: res.headers };
    }

    beforeAll(async () => {
        await resetSchema(db);
        await migrateToLatest(db);
        await seed(db);
        state.adminId = (await upsertAdmin(db, { email: 'admin@example.com', password: 'correct horse battery' })).id;
    });
    afterAll(() => db.destroy());

    return { db, call, rendered };
}
