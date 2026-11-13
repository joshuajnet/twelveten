import { Hono } from 'hono';
import { sql } from 'kysely';
import type { DB } from './db/index.ts';
import type { AppEnv } from './env.ts';
import { publicRoutes } from './routes/public.ts';
import { InvalidCursorError } from './content/cursor.ts';
import { resolveUserFrom, type Auth } from './auth/auth.ts';

export interface AppDeps {
    db: () => DB;
    /** Better Auth instance; mounts /api/auth/* and resolves sessions. */
    auth?: Auth;
    /** Overrides session resolution (tests). Defaults to the Better Auth session. */
    resolveUser?: (headers: Headers) => Promise<{ id: string; role: string } | null>;
}

export function createApp(deps: AppDeps) {
    const app = new Hono<AppEnv>().basePath('/api');

    const resolveUser = deps.resolveUser ?? (deps.auth ? (h: Headers) => resolveUserFrom(deps.auth!, h) : null);

    if (deps.auth) {
        const auth = deps.auth;
        app.on(['GET', 'POST'], '/auth/*', (c) => {
            c.header('Cache-Control', 'no-store');
            return auth.handler(c.req.raw);
        });
    }

    app.use('*', async (c, next) => {
        c.set('db', deps.db());
        if (c.req.path.startsWith('/api/auth/')) return next();
        const user = resolveUser ? await resolveUser(c.req.raw.headers) : null;
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

    /** Who is signed in (used by the site to show editing tools). */
    app.get('/session', async (c) => {
        c.header('Cache-Control', 'private, no-store');
        if (!c.var.userId) return c.json({ user: null });
        const user = await c.var.db
            .selectFrom('user')
            .select(['id', 'name', 'email', 'role'])
            .where('id', '=', c.var.userId)
            .executeTakeFirst();
        return c.json({ user: user ?? null });
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
