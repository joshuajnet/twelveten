import { Hono } from 'hono';
import { sql } from 'kysely';
import type { DB } from './db/index.ts';
import type { AppEnv } from './env.ts';
import { publicRoutes } from './routes/public.ts';
import { InvalidCursorError } from './content/cursor.ts';

export interface AppDeps {
    db: () => DB;
    /** Resolves the signed-in user for a request (Better Auth in production). */
    resolveUser?: (headers: Headers) => Promise<{ id: string; role: string } | null>;
}

export function createApp(deps: AppDeps) {
    const app = new Hono<AppEnv>().basePath('/api');

    app.use('*', async (c, next) => {
        c.set('db', deps.db());
        const user = deps.resolveUser ? await deps.resolveUser(c.req.raw.headers) : null;
        c.set('userId', user?.id ?? null);
        c.set('isAdmin', user?.role === 'admin');
        await next();
    });

    app.get('/health', async (c) => {
        c.header('Cache-Control', 'no-store');
        try {
            await sql`select 1`.execute(c.var.db);
            return c.json({ ok: true, db: 'up' });
        } catch {
            return c.json({ ok: false, db: 'down' }, 503);
        }
    });

    app.route('/', publicRoutes());

    app.notFound((c) => c.json({ error: 'Not found' }, 404));
    app.onError((err, c) => {
        if (err instanceof InvalidCursorError) return c.json({ error: err.message }, 400);
        console.error(err);
        return c.json({ error: 'Internal server error' }, 500);
    });

    return app;
}

export type App = ReturnType<typeof createApp>;
