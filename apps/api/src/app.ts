import { Hono } from 'hono';
import { sql } from 'kysely';
import type { DB } from './db/index.ts';

export interface AppDeps {
    db: () => DB;
}

export function createApp(deps: AppDeps) {
    const app = new Hono().basePath('/api');

    app.get('/health', async (c) => {
        try {
            await sql`select 1`.execute(deps.db());
            return c.json({ ok: true, db: 'up' });
        } catch {
            return c.json({ ok: false, db: 'down' }, 503);
        }
    });

    app.notFound((c) => c.json({ error: 'Not found' }, 404));
    app.onError((err, c) => {
        console.error(err);
        return c.json({ error: 'Internal server error' }, 500);
    });

    return app;
}

export type App = ReturnType<typeof createApp>;
