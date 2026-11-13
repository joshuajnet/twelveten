import { Hono, type Context } from 'hono';
import { exhibitionKind } from '@twelveten/shared';
import type { AppEnv } from '../env.ts';
import { decodeCursor, InvalidCursorError, parseLimit } from '../content/cursor.ts';
import { getExhibition, getHome, getNews, listExhibitions, listNews, listPress } from '../content/queries.ts';

/** Public content is cached briefly by CloudFront; admin views (drafts) are never cached. */
function cache(c: Context<AppEnv>) {
    c.header('Cache-Control', c.get('isAdmin') ? 'private, no-store' : 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
}

function kindParam(raw: string | undefined) {
    if (raw === undefined) return undefined;
    const parsed = exhibitionKind.safeParse(raw);
    return parsed.success ? parsed.data : null;
}

export function publicRoutes() {
    const app = new Hono<AppEnv>();

    app.get('/home', async (c) => {
        const home = await getHome(c.var.db, { drafts: c.var.isAdmin });
        if (!home) return c.json({ error: 'Not found' }, 404);
        cache(c);
        return c.json(home);
    });

    app.get('/exhibitions', async (c) => {
        const kind = kindParam(c.req.query('kind'));
        if (kind === null) return c.json({ error: 'kind must be exhibition or fair' }, 400);
        cache(c);
        return c.json({ items: await listExhibitions(c.var.db, kind, { drafts: c.var.isAdmin }) });
    });

    app.get('/exhibitions/:slug', async (c) => {
        const kind = kindParam(c.req.query('kind'));
        if (kind === null) return c.json({ error: 'kind must be exhibition or fair' }, 400);
        const e = await getExhibition(c.var.db, c.req.param('slug'), kind, { drafts: c.var.isAdmin });
        if (!e) return c.json({ error: 'Not found' }, 404);
        cache(c);
        return c.json(e);
    });

    app.get('/news', async (c) => {
        cache(c);
        return c.json(await listNews(c.var.db, decodeCursor(c.req.query('cursor')), parseLimit(c.req.query('limit')), { drafts: c.var.isAdmin }));
    });

    app.get('/news/:slug', async (c) => {
        const post = await getNews(c.var.db, c.req.param('slug'), { drafts: c.var.isAdmin });
        if (!post) return c.json({ error: 'Not found' }, 404);
        cache(c);
        return c.json(post);
    });

    app.get('/press', async (c) => {
        cache(c);
        return c.json(
            await listPress(
                c.var.db,
                decodeCursor(c.req.query('cursor')),
                parseLimit(c.req.query('limit')),
                { exhibitionSlug: c.req.query('exhibition') },
                { drafts: c.var.isAdmin },
            ),
        );
    });

    app.onError((err, c) => {
        if (err instanceof InvalidCursorError) return c.json({ error: err.message }, 400);
        throw err;
    });

    return app;
}
