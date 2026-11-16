import { timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import { sql } from 'kysely';
import type { DB } from './db/index.ts';
import type { AppEnv } from './env.ts';
import { publicRoutes } from './routes/public.ts';
import { roomPublicRoutes } from './routes/rooms.ts';
import { inquiryPublicRoutes } from './routes/inquiries.ts';
import { InvalidCursorError } from './content/cursor.ts';
import { resolveUserFrom, withClientIp, type Auth } from './auth/auth.ts';
import { adminRoutes, handleError } from './routes/admin/index.ts';
import { noopPublisher, type Publisher } from './publish/publisher.ts';
import type { Storage } from './storage/uploads.ts';
import { headFor } from './publish/head.ts';
import { config } from './config.ts';

export interface AppDeps {
    db: () => DB;
    /** Better Auth instance; mounts /api/auth/* and resolves sessions. */
    auth?: Auth;
    /** Overrides session resolution (tests). Defaults to the Better Auth session. */
    resolveUser?: (headers: Headers) => Promise<{ id: string; role: string } | null>;
    /** Re-renders public pages after admin changes. */
    publisher?: Publisher;
    /** Media uploads (S3). */
    storage?: Storage;
    /** Absolute site origin for canonical URLs (defaults to SITE_URL). */
    siteUrl?: string;
    /** Make image derivatives in the API after uploads (defaults to MEDIA_DERIVE_INLINE). */
    deriveInline?: boolean;
    /** Overrides ORIGIN_VERIFY_SECRET (tests). */
    originVerifySecret?: string;
}

export function createApp(deps: AppDeps) {
    const app = new Hono<AppEnv>().basePath('/api');

    const resolveUser = deps.resolveUser ?? (deps.auth ? (h: Headers) => resolveUserFrom(deps.auth!, h) : null);

    // Behind CloudFront, only requests carrying the shared origin secret are served. This runs before
    // every route (auth included): Hono runs handlers in registration order.
    const originSecret = deps.originVerifySecret ?? config().ORIGIN_VERIFY_SECRET;
    if (originSecret) {
        const expected = Buffer.from(originSecret);
        app.use('*', async (c, next) => {
            const got = Buffer.from(c.req.header('x-origin-verify') ?? '');
            if (got.length !== expected.length || !timingSafeEqual(got, expected)) return c.json({ error: 'Forbidden' }, 403);
            await next();
        });
    }

    if (deps.auth) {
        const auth = deps.auth;
        app.on(['GET', 'POST'], '/auth/*', (c) => {
            c.header('Cache-Control', 'no-store');
            return auth.handler(withClientIp(c.req.raw));
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

    /** Head tags for a site path (used by the dev server; production pages are prerendered). */
    app.get('/meta', async (c) => {
        const path = c.req.query('path') ?? '/';
        const head = await headFor(c.var.db, path, deps.siteUrl ?? config().SITE_URL);
        c.header('Cache-Control', 'public, max-age=0, s-maxage=60');
        return c.json({ status: head.tags.status, html: head.html, tags: head.tags });
    });

    app.route('/', publicRoutes());
    app.route('/', roomPublicRoutes({ siteUrl: deps.siteUrl ?? config().SITE_URL, trustedOrigins: config().TRUSTED_ORIGINS, storage: deps.storage }));
    app.route('/', inquiryPublicRoutes({ siteUrl: deps.siteUrl ?? config().SITE_URL, trustedOrigins: config().TRUSTED_ORIGINS }));
    app.route('/admin', adminRoutes({ publisher: deps.publisher ?? noopPublisher, storage: deps.storage, deriveInline: deps.deriveInline }));

    app.notFound((c) => c.json({ error: 'Not found' }, 404));
    app.onError((err, c) => {
        if (err instanceof InvalidCursorError) return c.json({ error: err.message }, 400);
        return handleError(err, c);
    });

    return app;
}

export type App = ReturnType<typeof createApp>;
