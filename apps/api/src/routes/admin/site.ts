import { Hono } from 'hono';
import type { Transaction } from 'kysely';
import { homePatchSchema, newsCreateSchema, newsPatchSchema, newsPath, pressCreateSchema, pressPatchSchema, exhibitionPath, type PressCreate } from '@twelveten/shared';
import type { Database } from '../../db/types.ts';
import type { AppEnv } from '../../env.ts';
import type { DB } from '../../db/index.ts';
import { sanitizeNewsHtml } from '../../lib/sanitize.ts';
import { getHome, getNews } from '../../content/queries.ts';
import { toNews, toPress } from '../../content/serialize.ts';
import { body, HttpError } from './errors.ts';
import { ensureBaseline, recordRevision } from './revisions.ts';
import { columns, conflictOr404, idParam, sameVersion, uniqueSlug, type Publish } from './util.ts';

const NEWS_COLUMNS = {
    slug: 'slug',
    title: 'title',
    publishedAt: 'published_at',
    bodyHtml: 'body_html',
    seoTitle: 'seo_title',
    seoDescription: 'seo_description',
    ogImage: 'og_image',
    published: 'published',
} as const;

const PRESS_COLUMNS = {
    outlet: 'outlet',
    title: 'title',
    url: 'url',
    publishedOn: 'published_on',
    issueLabel: 'issue_label',
    byline: 'byline',
    exhibitionId: 'exhibition_id',
    published: 'published',
} as const;

const HOME_COLUMNS = {
    bgImage: 'bg_image',
    bgImageMobile: 'bg_image_mobile',
    bgFocalPoint: 'bg_focal_point',
    headline: 'headline',
    subline: 'subline',
    extraText: 'extra_text',
    startsOn: 'starts_on',
    endsOn: 'ends_on',
    textColor: 'text_color',
    linkExhibitionId: 'link_exhibition_id',
    seoTitle: 'seo_title',
    seoDescription: 'seo_description',
    ogImage: 'og_image',
} as const;

/** Pages that list press: the news page and the pages of the exhibitions it is about. */
export async function pressPages(db: Pick<DB, 'selectFrom'>, exhibitionIds: (string | null)[]): Promise<string[]> {
    const pages = ['/news'];
    for (const exId of new Set(exhibitionIds.filter((x): x is string => Boolean(x)))) {
        const e = await db.selectFrom('exhibitions').select(['id', 'slug', 'kind']).where('id', '=', exId).executeTakeFirst();
        if (e) pages.push(exhibitionPath(e));
    }
    return pages;
}

/** Create a press item (a draft unless `published`), with its first revision. */
export async function createPress(trx: Transaction<Database>, input: PressCreate, userId: string | null) {
    const created = await trx
        .insertInto('press_items')
        .values({ ...columns(input, PRESS_COLUMNS), published: input.published ?? false } as never)
        .returningAll()
        .executeTakeFirstOrThrow();
    await recordRevision(trx, { entity: 'press_item', entityId: created.id, action: 'create', snapshot: created, userId });
    return created;
}

/** News posts, press and the home page splash. */
export function siteRoutes({ publish }: { publish: Publish }) {
    const app = new Hono<AppEnv>();

    // ---------- News ----------

    app.post('/news', async (c) => {
        const input = await body(c, newsCreateSchema);
        const db = c.var.db;
        const slug = input.slug ?? (await uniqueSlug(db, 'news_posts', input.title));
        const row = await db.transaction().execute(async (trx) => {
            const created = await trx
                .insertInto('news_posts')
                .values({
                    slug,
                    title: input.title,
                    published_at: input.publishedAt ?? new Date(),
                    body_html: sanitizeNewsHtml(input.bodyHtml),
                    published: false,
                })
                .returningAll()
                .executeTakeFirstOrThrow();
            await recordRevision(trx, { entity: 'news_post', entityId: created.id, action: 'create', snapshot: created, userId: c.var.userId });
            return created;
        });
        return c.json(toNews(row), 201);
    });

    app.patch('/news/:id', async (c) => {
        const id = idParam(c);
        const patch = await body(c, newsPatchSchema);
        const db = c.var.db;
        const before = await db.selectFrom('news_posts').select(['slug']).where('id', '=', id).executeTakeFirst();
        if (!before) throw new HttpError(404, 'Not found');
        const values = columns(patch, NEWS_COLUMNS);
        if (patch.bodyHtml !== undefined) values.body_html = sanitizeNewsHtml(patch.bodyHtml);
        if (Object.keys(values).length === 0) throw new HttpError(400, 'Nothing to update');
        const row = await db.transaction().execute(async (trx) => {
            await ensureBaseline(trx, 'news_post', id, () => trx.selectFrom('news_posts').selectAll().where('id', '=', id).executeTakeFirst());
            const updated = await trx
                .updateTable('news_posts')
                .set(values)
                .where('id', '=', id)
                .where(sameVersion(patch.updatedAt))
                .returningAll()
                .executeTakeFirst();
            if (updated) await recordRevision(trx, { entity: 'news_post', entityId: id, action: 'update', snapshot: updated, userId: c.var.userId });
            return updated;
        });
        if (!row) return conflictOr404(true, async () => toNews(await db.selectFrom('news_posts').selectAll().where('id', '=', id).executeTakeFirstOrThrow()));
        await publish(['/news', newsPath(row.slug), newsPath(before.slug)]);
        return c.json(toNews(row));
    });

    app.delete('/news/:id', async (c) => {
        const id = idParam(c);
        const db = c.var.db;
        const existing = await db.selectFrom('news_posts').selectAll().where('id', '=', id).executeTakeFirst();
        if (!existing) throw new HttpError(404, 'Not found');
        await db.transaction().execute(async (trx) => {
            await recordRevision(trx, { entity: 'news_post', entityId: id, action: 'delete', snapshot: existing, userId: c.var.userId });
            await trx.deleteFrom('news_posts').where('id', '=', id).execute();
        });
        await publish(['/news', newsPath(existing.slug)]);
        return c.body(null, 204);
    });

    // ---------- Press ----------

    app.post('/press', async (c) => {
        const input = await body(c, pressCreateSchema);
        const db = c.var.db;
        const row = await db.transaction().execute((trx) => createPress(trx, input, c.var.userId));
        await publish(await pressPages(db, [row.exhibition_id]));
        return c.json(toPress(row), 201);
    });

    app.patch('/press/:id', async (c) => {
        const id = idParam(c);
        const patch = await body(c, pressPatchSchema);
        const db = c.var.db;
        const before = await db.selectFrom('press_items').select('exhibition_id').where('id', '=', id).executeTakeFirst();
        if (!before) throw new HttpError(404, 'Not found');
        const values = columns(patch, PRESS_COLUMNS);
        if (Object.keys(values).length === 0) throw new HttpError(400, 'Nothing to update');
        const row = await db.transaction().execute(async (trx) => {
            await ensureBaseline(trx, 'press_item', id, () => trx.selectFrom('press_items').selectAll().where('id', '=', id).executeTakeFirst());
            const updated = await trx
                .updateTable('press_items')
                .set(values)
                .where('id', '=', id)
                .where(sameVersion(patch.updatedAt))
                .returningAll()
                .executeTakeFirst();
            if (updated) await recordRevision(trx, { entity: 'press_item', entityId: id, action: 'update', snapshot: updated, userId: c.var.userId });
            return updated;
        });
        if (!row) return conflictOr404(true, async () => toPress(await db.selectFrom('press_items').selectAll().where('id', '=', id).executeTakeFirstOrThrow()));
        await publish(await pressPages(db, [before.exhibition_id, row.exhibition_id]));
        return c.json(toPress(row));
    });

    app.delete('/press/:id', async (c) => {
        const id = idParam(c);
        const db = c.var.db;
        const existing = await db.selectFrom('press_items').selectAll().where('id', '=', id).executeTakeFirst();
        if (!existing) throw new HttpError(404, 'Not found');
        await db.transaction().execute(async (trx) => {
            const artists = await trx.selectFrom('press_artists').select('artist_id').where('press_item_id', '=', id).execute();
            const snapshot = { ...existing, artist_ids: artists.map((a) => a.artist_id) };
            await recordRevision(trx, { entity: 'press_item', entityId: id, action: 'delete', snapshot, userId: c.var.userId });
            await trx.deleteFrom('press_items').where('id', '=', id).execute();
        });
        await publish(await pressPages(db, [existing.exhibition_id]));
        return c.body(null, 204);
    });

    // ---------- Home ----------

    app.patch('/home', async (c) => {
        const patch = await body(c, homePatchSchema);
        const db = c.var.db;
        const values = columns(patch, HOME_COLUMNS);
        if (Object.keys(values).length === 0) throw new HttpError(400, 'Nothing to update');
        const row = await db.transaction().execute(async (trx) => {
            await ensureBaseline(trx, 'home_page', null, () => trx.selectFrom('home_page').selectAll().where('id', '=', 1).executeTakeFirst());
            const updated = await trx
                .updateTable('home_page')
                .set(values)
                .where('id', '=', 1)
                .where(sameVersion(patch.updatedAt))
                .returningAll()
                .executeTakeFirst();
            if (updated) await recordRevision(trx, { entity: 'home_page', entityId: null, action: 'update', snapshot: updated, userId: c.var.userId });
            return updated;
        });
        if (!row) return conflictOr404(true, () => getHome(db, { drafts: true }));
        await publish(['/']);
        return c.json(await getHome(db, { drafts: true }));
    });

    // Admin lookups used by pickers in the editor.
    app.get('/news/:slug', async (c) => {
        const post = await getNews(c.var.db, c.req.param('slug'), { drafts: true });
        if (!post) throw new HttpError(404, 'Not found');
        return c.json(post);
    });

    return app;
}
