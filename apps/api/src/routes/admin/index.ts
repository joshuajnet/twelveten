import { Hono, type Context } from 'hono';
import { sql } from 'kysely';
import {
    artworkCreateSchema,
    artworkOrderSchema,
    artworkPatchSchema,
    eventsPutSchema,
    exhibitionCreateSchema,
    exhibitionPatchSchema,
    exhibitionPath,
    homePatchSchema,
    newsCreateSchema,
    newsPatchSchema,
    newsPath,
    pressCreateSchema,
    pressPatchSchema,
    revisionEntity,
    uploadRequestSchema,
    type RevisionSummary,
} from '@twelveten/shared';
import { sanitizeRichDoc } from '@twelveten/shared/rich/server';
import type { AppEnv } from '../../env.ts';
import type { DB } from '../../db/index.ts';
import type { Publisher } from '../../publish/publisher.ts';
import type { Storage } from '../../storage/uploads.ts';
import { sanitizeNewsHtml } from '../../lib/sanitize.ts';
import { getExhibition, getHome, getNews } from '../../content/queries.ts';
import { toArtwork, toNews, toPress } from '../../content/serialize.ts';
import type { Artwork } from '@twelveten/shared';
import { body, fromDbError, HttpError } from './errors.ts';
import { ensureBaseline, recordRevision } from './revisions.ts';
import { columns, conflictOr404, sameVersion, uniqueSlug } from './util.ts';
import { peopleRoutes } from './people.ts';
import { inventoryRoutes, recordWorkChanges } from './inventory.ts';
import { invoiceRoutes } from './invoices.ts';
import { artworkLinks } from '../../inventory/queries.ts';

export interface AdminDeps {
    publisher: Publisher;
    storage?: Storage;
}

type Ctx = Context<AppEnv>;

const EXHIBITION_COLUMNS = {
    slug: 'slug',
    kind: 'kind',
    artists: 'artists',
    title: 'title',
    subtitle: 'subtitle',
    titleFirst: 'title_first',
    startsOn: 'starts_on',
    endsOn: 'ends_on',
    timezone: 'timezone',
    hoursText: 'hours_text',
    venueText: 'venue_text',
    locationText: 'location_text',
    heroImage: 'hero_image',
    heroAlt: 'hero_alt',
    thumbnail: 'thumbnail',
    pressReleaseUrl: 'press_release_url',
    headerLinks: 'header_links',
    showInquire: 'show_inquire',
    slideshowVisible: 'slideshow_visible',
    worksAvailable: 'works_available',
    content: 'content',
    seoTitle: 'seo_title',
    seoDescription: 'seo_description',
    ogImage: 'og_image',
    published: 'published',
} as const;

const ARTWORK_COLUMNS = {
    image: 'image',
    video: 'video',
    alt: 'alt',
    author: 'author',
    title: 'title',
    dateText: 'date_text',
    dimensions: 'dimensions',
    media: 'media',
    credit: 'credit',
    hidden: 'hidden',
    available: 'available',
    workId: 'work_id',
} as const;

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

/** Pages that show an exhibition: its own page, its list, and the home page if the splash links to it. */
async function exhibitionPages(db: DB, e: { id: string; slug: string; kind: 'exhibition' | 'fair' }): Promise<string[]> {
    const paths = [exhibitionPath(e), e.kind === 'fair' ? '/fairs' : '/exhibitions'];
    const home = await db.selectFrom('home_page').select('link_exhibition_id').where('id', '=', 1).executeTakeFirst();
    if (home?.link_exhibition_id === e.id) paths.push('/');
    return paths;
}

async function loadExhibitionById(db: DB, id: string) {
    const row = await db.selectFrom('exhibitions').select(['slug', 'kind']).where('id', '=', id).executeTakeFirst();
    return row ? withLinks(db, await getExhibition(db, row.slug, row.kind, { drafts: true })) : null;
}

/** Admin copies of an exhibition carry each slide's inventory link (work and artist). */
async function withLinks<E extends { id: string; artworks: Artwork[] } | null>(db: DB, e: E): Promise<E> {
    if (!e) return e;
    const [links, linkedArtists] = await Promise.all([
        artworkLinks(db, e.artworks.map((a) => a.id)),
        db
            .selectFrom('exhibition_artists as ea')
            .innerJoin('persons as p', 'p.id', 'ea.artist_id')
            .select(['p.id as personId', 'p.name'])
            .where('ea.exhibition_id', '=', e.id)
            .orderBy('ea.position')
            .execute(),
    ]);
    return { ...e, artworks: e.artworks.map((a) => ({ ...a, link: links.get(a.id) ?? null })), linkedArtists };
}

/** A slide with its inventory link, for admin responses. */
async function artworkWithLink(db: DB, row: Parameters<typeof toArtwork>[0]): Promise<Artwork> {
    const links = await artworkLinks(db, [row.id]);
    return { ...toArtwork(row), link: links.get(row.id) ?? null };
}

export function adminRoutes(deps: AdminDeps) {
    const app = new Hono<AppEnv>();
    const { publisher } = deps;

    app.use('*', async (c, next) => {
        c.header('Cache-Control', 'private, no-store');
        if (!c.var.userId) throw new HttpError(401, 'Sign in required');
        if (!c.var.isAdmin) throw new HttpError(403, 'Admins only');
        await next();
    });

    const publish = async (paths: string[]) => {
        try {
            await publisher.render([...new Set(paths)]);
        } catch (err) {
            // Content is saved; a failed render is retried by the next save or a rebuild.
            console.error('publish failed', err);
        }
    };

    // ---------- Exhibitions & fairs ----------

    app.get('/exhibitions/:id', async (c) => {
        const e = await loadExhibitionById(c.var.db, c.req.param('id'));
        if (!e) throw new HttpError(404, 'Not found');
        return c.json(e);
    });

    app.post('/exhibitions', async (c) => {
        const input = await body(c, exhibitionCreateSchema);
        const db = c.var.db;
        const slug = input.slug ?? (await uniqueSlug(db, 'exhibitions', input.title));
        const row = await db.transaction().execute(async (trx) => {
            const created = await trx
                .insertInto('exhibitions')
                .values({
                    kind: input.kind,
                    title: input.title,
                    slug,
                    artists: input.artists,
                    starts_on: input.startsOn,
                    ends_on: input.endsOn,
                    // New pages start with an empty body and a bio section to fill in.
                    content: JSON.stringify({
                        type: 'doc',
                        content: [{ type: 'paragraph' }, { type: 'bio', content: [{ type: 'paragraph', attrs: { variant: 'italic' } }] }],
                    }),
                    published: false,
                })
                .returningAll()
                .executeTakeFirstOrThrow();
            await recordRevision(trx, { entity: 'exhibition', entityId: created.id, action: 'create', snapshot: created, userId: c.var.userId });
            return created;
        });
        return c.json(await withLinks(db, await getExhibition(db, row.slug, row.kind, { drafts: true })), 201);
    });

    app.patch('/exhibitions/:id', async (c) => {
        const id = c.req.param('id');
        const patch = await body(c, exhibitionPatchSchema);
        const db = c.var.db;
        const before = await db.selectFrom('exhibitions').select(['id', 'slug', 'kind', 'published']).where('id', '=', id).executeTakeFirst();
        if (!before) throw new HttpError(404, 'Not found');
        const values = columns(patch, EXHIBITION_COLUMNS);
        if (patch.content) values.content = JSON.stringify(sanitizeRichDoc(patch.content));
        if (patch.headerLinks) values.header_links = JSON.stringify(patch.headerLinks);
        if (Object.keys(values).length === 0) throw new HttpError(400, 'Nothing to update');

        const updated = await db.transaction().execute(async (trx) => {
            await ensureBaseline(trx, 'exhibition', id, async () => {
                const current = await trx.selectFrom('exhibitions').selectAll().where('id', '=', id).executeTakeFirst();
                const events = await trx.selectFrom('exhibition_events').selectAll().where('exhibition_id', '=', id).orderBy('position').execute();
                return current && { ...current, events };
            });
            const row = await trx
                .updateTable('exhibitions')
                .set(values)
                .where('id', '=', id)
                .where(sameVersion(patch.updatedAt))
                .returningAll()
                .executeTakeFirst();
            if (!row) return null;
            const events = await trx.selectFrom('exhibition_events').selectAll().where('exhibition_id', '=', id).orderBy('position').execute();
            await recordRevision(trx, { entity: 'exhibition', entityId: id, action: 'update', snapshot: { ...row, events }, userId: c.var.userId });
            return row;
        });
        if (!updated) return conflictOr404(true, () => loadExhibitionById(db, id));

        const pages = await exhibitionPages(db, updated);
        if (before.slug !== updated.slug || before.kind !== updated.kind) pages.push(exhibitionPath(before), '/exhibitions', '/fairs');
        await publish(pages);
        return c.json(await loadExhibitionById(db, id));
    });

    app.delete('/exhibitions/:id', async (c) => {
        const id = c.req.param('id');
        const db = c.var.db;
        const existing = await db.selectFrom('exhibitions').selectAll().where('id', '=', id).executeTakeFirst();
        if (!existing) throw new HttpError(404, 'Not found');
        const pages = await exhibitionPages(db, existing);
        await db.transaction().execute(async (trx) => {
            const events = await trx.selectFrom('exhibition_events').selectAll().where('exhibition_id', '=', id).execute();
            const artworks = await trx.selectFrom('artworks').selectAll().where('exhibition_id', '=', id).execute();
            await recordRevision(trx, { entity: 'exhibition', entityId: id, action: 'delete', snapshot: { ...existing, events, artworks }, userId: c.var.userId });
            await trx.deleteFrom('exhibitions').where('id', '=', id).execute();
        });
        await publish(pages);
        return c.body(null, 204);
    });

    app.put('/exhibitions/:id/events', async (c) => {
        const id = c.req.param('id');
        const { events } = await body(c, eventsPutSchema);
        const db = c.var.db;
        const e = await db.selectFrom('exhibitions').select(['id', 'slug', 'kind']).where('id', '=', id).executeTakeFirst();
        if (!e) throw new HttpError(404, 'Not found');
        for (const ev of events) {
            if (ev.endsAt && ev.endsAt <= ev.startsAt) throw new HttpError(400, `“${ev.label}” must end after it starts`);
        }
        await db.transaction().execute(async (trx) => {
            await ensureBaseline(trx, 'exhibition', id, async () => {
                const current = await trx.selectFrom('exhibitions').selectAll().where('id', '=', id).executeTakeFirst();
                const existing = await trx.selectFrom('exhibition_events').selectAll().where('exhibition_id', '=', id).orderBy('position').execute();
                return current && { ...current, events: existing };
            });
            await trx.deleteFrom('exhibition_events').where('exhibition_id', '=', id).execute();
            if (events.length) {
                await trx
                    .insertInto('exhibition_events')
                    .values(events.map((ev, position) => ({ exhibition_id: id, label: ev.label, starts_at: ev.startsAt, ends_at: ev.endsAt, position })))
                    .execute();
            }
            const row = await trx.updateTable('exhibitions').set({ updated_at: new Date() }).where('id', '=', id).returningAll().executeTakeFirstOrThrow();
            await recordRevision(trx, { entity: 'exhibition', entityId: id, action: 'update', snapshot: { ...row, events }, userId: c.var.userId });
        });
        await publish(await exhibitionPages(db, e));
        return c.json(await loadExhibitionById(db, id));
    });

    // ---------- Slides ----------

    app.post('/exhibitions/:id/artworks', async (c) => {
        const id = c.req.param('id');
        const input = await body(c, artworkCreateSchema);
        const db = c.var.db;
        const e = await db.selectFrom('exhibitions').select(['id', 'slug', 'kind']).where('id', '=', id).executeTakeFirst();
        if (!e) throw new HttpError(404, 'Not found');
        const row = await db.transaction().execute(async (trx) => {
            // Serialise appends per exhibition so positions stay unique.
            await sql`SELECT pg_advisory_xact_lock(hashtext(${id}))`.execute(trx);
            const max = await trx
                .selectFrom('artworks')
                .select((eb) => eb.fn.max('position').as('max'))
                .where('exhibition_id', '=', id)
                .executeTakeFirst();
            const created = await trx
                .insertInto('artworks')
                .values({ exhibition_id: id, position: Number(max?.max ?? -1) + 1, ...columns(input, ARTWORK_COLUMNS) } as never)
                .returningAll()
                .executeTakeFirstOrThrow();
            await recordRevision(trx, { entity: 'artwork', entityId: created.id, action: 'create', snapshot: created, userId: c.var.userId });
            return created;
        });
        await publish(await exhibitionPages(db, e));
        return c.json(await artworkWithLink(db, row), 201);
    });

    app.patch('/artworks/:id', async (c) => {
        const id = c.req.param('id');
        const patch = await body(c, artworkPatchSchema);
        const db = c.var.db;
        const values = columns(patch, ARTWORK_COLUMNS);
        if (Object.keys(values).length === 0) throw new HttpError(400, 'Nothing to update');
        if (patch.workId && !(await db.selectFrom('works').select('id').where('id', '=', patch.workId).executeTakeFirst())) {
            throw new HttpError(400, 'Work not found');
        }
        const row = await db.transaction().execute(async (trx) => {
            await ensureBaseline(trx, 'artwork', id, () => trx.selectFrom('artworks').selectAll().where('id', '=', id).executeTakeFirst());
            const updated = await trx
                .updateTable('artworks')
                .set(values)
                .where('id', '=', id)
                .where(sameVersion(patch.updatedAt))
                .returningAll()
                .executeTakeFirst();
            if (updated) await recordRevision(trx, { entity: 'artwork', entityId: id, action: 'update', snapshot: updated, userId: c.var.userId });
            return updated;
        });
        if (!row) {
            const current = await db.selectFrom('artworks').selectAll().where('id', '=', id).executeTakeFirst();
            return conflictOr404(Boolean(current), async () => current && toArtwork(current));
        }
        const e = await db.selectFrom('exhibitions').select(['id', 'slug', 'kind']).where('id', '=', row.exhibition_id).executeTakeFirstOrThrow();
        // Linking a slide to inventory changes nothing public.
        if (Object.keys(values).some((k) => k !== 'work_id')) await publish(await exhibitionPages(db, e));
        return c.json(await artworkWithLink(db, row));
    });

    app.delete('/artworks/:id', async (c) => {
        const id = c.req.param('id');
        const db = c.var.db;
        const existing = await db.selectFrom('artworks').selectAll().where('id', '=', id).executeTakeFirst();
        if (!existing) throw new HttpError(404, 'Not found');
        await db.transaction().execute(async (trx) => {
            await recordRevision(trx, { entity: 'artwork', entityId: id, action: 'delete', snapshot: existing, userId: c.var.userId });
            await trx.deleteFrom('artworks').where('id', '=', id).execute();
            // Close the gap so positions stay 0..n-1.
            await trx
                .updateTable('artworks')
                .set((eb) => ({ position: eb('position', '-', 1) }))
                .where('exhibition_id', '=', existing.exhibition_id)
                .where('position', '>', existing.position)
                .execute();
        });
        const e = await db.selectFrom('exhibitions').select(['id', 'slug', 'kind']).where('id', '=', existing.exhibition_id).executeTakeFirstOrThrow();
        await publish(await exhibitionPages(db, e));
        return c.body(null, 204);
    });

    app.put('/exhibitions/:id/artworks/order', async (c) => {
        const id = c.req.param('id');
        const { ids } = await body(c, artworkOrderSchema);
        const db = c.var.db;
        const e = await db.selectFrom('exhibitions').select(['id', 'slug', 'kind']).where('id', '=', id).executeTakeFirst();
        if (!e) throw new HttpError(404, 'Not found');
        await db.transaction().execute(async (trx) => {
            const current = await trx.selectFrom('artworks').select('id').where('exhibition_id', '=', id).execute();
            const known = new Set(current.map((r) => r.id));
            if (ids.length !== known.size || new Set(ids).size !== ids.length || ids.some((x) => !known.has(x))) {
                throw new HttpError(400, 'The order must list every slide of this exhibition exactly once');
            }
            // (exhibition_id, position) is unique but deferred, so swaps are fine inside the transaction.
            for (const [position, artworkId] of ids.entries()) {
                await trx.updateTable('artworks').set({ position }).where('id', '=', artworkId).execute();
            }
        });
        await publish(await exhibitionPages(db, e));
        return c.json((await loadExhibitionById(db, id))?.artworks ?? []);
    });

    // ---------- People, profiles, addresses and inventory (nothing public changes) ----------

    app.route('/', peopleRoutes());
    app.route('/', inventoryRoutes());
    app.route('/', invoiceRoutes({ storage: deps.storage }));

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
        const id = c.req.param('id');
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
        const id = c.req.param('id');
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

    const pressPages = async (db: DB, exhibitionIds: (string | null)[]) => {
        const pages = ['/news'];
        for (const exId of new Set(exhibitionIds.filter((x): x is string => Boolean(x)))) {
            const e = await db.selectFrom('exhibitions').select(['id', 'slug', 'kind']).where('id', '=', exId).executeTakeFirst();
            if (e) pages.push(exhibitionPath(e));
        }
        return pages;
    };

    app.post('/press', async (c) => {
        const input = await body(c, pressCreateSchema);
        const db = c.var.db;
        const row = await db.transaction().execute(async (trx) => {
            const created = await trx
                .insertInto('press_items')
                .values({ ...columns(input, PRESS_COLUMNS), published: input.published ?? false } as never)
                .returningAll()
                .executeTakeFirstOrThrow();
            await recordRevision(trx, { entity: 'press_item', entityId: created.id, action: 'create', snapshot: created, userId: c.var.userId });
            return created;
        });
        await publish(await pressPages(db, [row.exhibition_id]));
        return c.json(toPress(row), 201);
    });

    app.patch('/press/:id', async (c) => {
        const id = c.req.param('id');
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
        const id = c.req.param('id');
        const db = c.var.db;
        const existing = await db.selectFrom('press_items').selectAll().where('id', '=', id).executeTakeFirst();
        if (!existing) throw new HttpError(404, 'Not found');
        await db.transaction().execute(async (trx) => {
            await recordRevision(trx, { entity: 'press_item', entityId: id, action: 'delete', snapshot: existing, userId: c.var.userId });
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

    // ---------- Revisions ----------

    app.get('/revisions', async (c) => {
        const entity = revisionEntity.safeParse(c.req.query('entity'));
        if (!entity.success) throw new HttpError(400, 'entity is required');
        const entityId = c.req.query('id') ?? null;
        let q = c.var.db
            .selectFrom('content_revisions as r')
            .leftJoin('user as u', 'u.id', 'r.user_id')
            .select(['r.id', 'r.entity', 'r.entity_id', 'r.action', 'r.created_at', 'u.name as user_name'])
            .where('r.entity', '=', entity.data)
            .orderBy('r.created_at', 'desc')
            .orderBy('r.id', 'desc')
            .limit(50);
        q = entityId ? q.where('r.entity_id', '=', entityId) : q.where('r.entity_id', 'is', null);
        const rows = await q.execute();
        const items: RevisionSummary[] = rows.map((r) => ({
            id: r.id,
            entity: r.entity as RevisionSummary['entity'],
            entityId: r.entity_id,
            action: r.action,
            userName: r.user_name,
            createdAt: r.created_at,
        }));
        return c.json({ items });
    });

    /** Deleted items that can still be brought back (their latest revision is a delete). */
    app.get('/deleted', async (c) => {
        const rows = await c.var.db
            .selectFrom('content_revisions as r')
            .leftJoin('user as u', 'u.id', 'r.user_id')
            .select(['r.id', 'r.entity', 'r.entity_id', 'r.snapshot', 'r.created_at', 'u.name as user_name'])
            .where('r.action', '=', 'delete')
            .where('r.entity', 'in', ['exhibition', 'news_post', 'press_item'])
            .where(({ not, exists, selectFrom }) =>
                not(
                    exists(
                        selectFrom('content_revisions as later')
                            .select('later.id')
                            .whereRef('later.entity_id', '=', 'r.entity_id')
                            .where('later.action', '!=', 'delete')
                            .whereRef('later.id', '>', 'r.id'),
                    ),
                ),
            )
            .orderBy('r.created_at', 'desc')
            .limit(50)
            .execute();
        const items = rows.map((r) => {
            const snap = r.snapshot as { title?: string; kind?: string; outlet?: string };
            return {
                revisionId: r.id,
                entity: r.entity,
                entityId: r.entity_id,
                title: snap.title ?? '(untitled)',
                detail: r.entity === 'exhibition' ? (snap.kind === 'fair' ? 'Fair' : 'Exhibition') : r.entity === 'news_post' ? 'News post' : `Press · ${snap.outlet ?? ''}`,
                deletedAt: r.created_at,
                userName: r.user_name,
            };
        });
        return c.json({ items });
    });

    app.post('/revisions/:id/restore', async (c) => {
        const db = c.var.db;
        const rev = await db.selectFrom('content_revisions').selectAll().where('id', '=', c.req.param('id')).executeTakeFirst();
        if (!rev) throw new HttpError(404, 'Not found');
        const snap = rev.snapshot as Record<string, unknown>;
        const pages: string[] = [];

        await db.transaction().execute(async (trx) => {
            const strip = (row: Record<string, unknown>, extra: string[] = []) => {
                const copy = { ...row };
                for (const k of ['created_at', 'updated_at', ...extra]) delete copy[k];
                for (const [k, v] of Object.entries(copy)) if (v !== null && typeof v === 'object') copy[k] = JSON.stringify(v);
                return copy;
            };
            // A slide's linked work may have been deleted since the snapshot.
            const withLiveWork = async (row: Record<string, unknown>) => {
                if (row.work_id && !(await trx.selectFrom('works').select('id').where('id', '=', String(row.work_id)).executeTakeFirst())) row.work_id = null;
                return row;
            };
            switch (rev.entity) {
                case 'exhibition': {
                    const row = strip(snap, ['events', 'artworks']);
                    await trx
                        .insertInto('exhibitions')
                        .values(row as never)
                        .onConflict((oc) => oc.column('id').doUpdateSet(row as never))
                        .execute();
                    const events = (snap.events as Record<string, unknown>[] | undefined) ?? [];
                    await trx.deleteFrom('exhibition_events').where('exhibition_id', '=', String(snap.id)).execute();
                    for (const [position, ev] of events.entries()) {
                        await trx
                            .insertInto('exhibition_events')
                            .values({
                                exhibition_id: String(snap.id),
                                label: String(ev.label),
                                starts_at: String(ev.starts_at ?? ev.startsAt),
                                ends_at: (ev.ends_at ?? ev.endsAt ?? null) as string | null,
                                position,
                            })
                            .execute();
                    }
                    // A deleted exhibition comes back with its slides.
                    if (rev.action === 'delete') {
                        for (const a of (snap.artworks as Record<string, unknown>[] | undefined) ?? []) {
                            await trx.insertInto('artworks').values((await withLiveWork(strip(a))) as never).onConflict((oc) => oc.column('id').doNothing()).execute();
                        }
                    }
                    pages.push(...(await exhibitionPages(db, { id: String(snap.id), slug: String(snap.slug), kind: snap.kind as 'exhibition' | 'fair' })));
                    break;
                }
                case 'artwork': {
                    const row = await withLiveWork(strip(snap));
                    if (rev.action === 'delete') {
                        // Put it back at the end to avoid position clashes.
                        const max = await trx
                            .selectFrom('artworks')
                            .select((eb) => eb.fn.max('position').as('max'))
                            .where('exhibition_id', '=', String(snap.exhibition_id))
                            .executeTakeFirst();
                        row.position = Number(max?.max ?? -1) + 1;
                    }
                    await trx
                        .insertInto('artworks')
                        .values(row as never)
                        .onConflict((oc) => oc.column('id').doUpdateSet({ ...row, position: undefined } as never))
                        .execute();
                    const e = await trx.selectFrom('exhibitions').select(['id', 'slug', 'kind']).where('id', '=', String(snap.exhibition_id)).executeTakeFirst();
                    if (e) pages.push(exhibitionPath(e));
                    break;
                }
                case 'news_post': {
                    const row = strip(snap);
                    await trx.insertInto('news_posts').values(row as never).onConflict((oc) => oc.column('id').doUpdateSet(row as never)).execute();
                    pages.push('/news', newsPath(String(snap.slug)));
                    break;
                }
                case 'press_item': {
                    const row = strip(snap);
                    await trx.insertInto('press_items').values(row as never).onConflict((oc) => oc.column('id').doUpdateSet(row as never)).execute();
                    pages.push('/news');
                    break;
                }
                case 'home_page': {
                    const row = strip(snap);
                    await trx.updateTable('home_page').set(row as never).where('id', '=', 1).execute();
                    pages.push('/');
                    break;
                }
                case 'person': {
                    const row = strip(snap);
                    await trx.insertInto('persons').values(row as never).onConflict((oc) => oc.column('id').doUpdateSet(row as never)).execute();
                    break;
                }
                case 'artist_profile': {
                    const row = strip(snap, ['exhibition_ids', 'press_ids']);
                    if (!(await trx.selectFrom('persons').select('id').where('id', '=', String(snap.person_id)).executeTakeFirst())) {
                        throw new HttpError(409, 'Restore the person first');
                    }
                    await trx.insertInto('artist_profiles').values(row as never).onConflict((oc) => oc.column('person_id').doUpdateSet(row as never)).execute();
                    const ids = ((snap.exhibition_ids as string[] | undefined) ?? []).filter(Boolean);
                    const existing = ids.length ? (await trx.selectFrom('exhibitions').select('id').where('id', 'in', ids).execute()).map((r) => r.id) : [];
                    await trx.deleteFrom('exhibition_artists').where('artist_id', '=', String(snap.person_id)).execute();
                    for (const exhibitionId of ids.filter((x) => existing.includes(x))) {
                        await trx.insertInto('exhibition_artists').values({ exhibition_id: exhibitionId, artist_id: String(snap.person_id) }).execute();
                    }
                    // Snapshots from before direct press links have no press_ids; leave links alone then.
                    if (Array.isArray(snap.press_ids)) {
                        const pressIds = (snap.press_ids as string[]).filter(Boolean);
                        const found = pressIds.length ? (await trx.selectFrom('press_items').select('id').where('id', 'in', pressIds).execute()).map((r) => r.id) : [];
                        await trx.deleteFrom('press_artists').where('artist_id', '=', String(snap.person_id)).execute();
                        for (const pressItemId of found) await trx.insertInto('press_artists').values({ press_item_id: pressItemId, artist_id: String(snap.person_id) }).execute();
                    }
                    break;
                }
                case 'work': {
                    const row = strip(snap, ['images']);
                    if (!(await trx.selectFrom('artist_profiles').select('person_id').where('person_id', '=', String(snap.artist_id)).executeTakeFirst())) {
                        throw new HttpError(409, 'Restore the artist profile first');
                    }
                    if (row.buyer_id && !(await trx.selectFrom('persons').select('id').where('id', '=', String(row.buyer_id)).executeTakeFirst())) row.buyer_id = null;
                    const before = await trx.selectFrom('works').selectAll().where('id', '=', String(snap.id)).executeTakeFirst();
                    const after = await trx
                        .insertInto('works')
                        .values(row as never)
                        .onConflict((oc) => oc.column('id').doUpdateSet(row as never))
                        .returningAll()
                        .executeTakeFirstOrThrow();
                    await trx.deleteFrom('work_images').where('work_id', '=', after.id).execute();
                    for (const [position, img] of ((snap.images as Record<string, unknown>[] | undefined) ?? []).entries()) {
                        await trx.insertInto('work_images').values({ work_id: after.id, url: String(img.url), alt: String(img.alt ?? ''), position }).execute();
                    }
                    await recordWorkChanges(trx, before ?? null, after, 'Restored from history', c.var.userId);
                    break;
                }
                default:
                    throw new HttpError(400, 'This revision cannot be restored');
            }
            await recordRevision(trx, { entity: rev.entity, entityId: rev.entity_id, action: 'restore', snapshot: snap, userId: c.var.userId });
        });
        await publish(pages);
        return c.json({ ok: true });
    });

    // ---------- Uploads & publishing ----------

    app.post('/uploads', async (c) => {
        if (!deps.storage) throw new HttpError(422, 'File storage is not configured');
        const req = await body(c, uploadRequestSchema);
        return c.json(await deps.storage.presignUpload(req), 201);
    });

    app.post('/publish/rebuild', async (c) => c.json(await publisher.rebuildAll()));

    // Admin lookups used by pickers in the editor.
    app.get('/news/:slug', async (c) => {
        const post = await getNews(c.var.db, c.req.param('slug'), { drafts: true });
        if (!post) throw new HttpError(404, 'Not found');
        return c.json(post);
    });

    return app;
}

/** Shared error handler for the API (HTTP errors, DB constraint errors, everything else = 500). */
export function handleError(err: Error, c: Ctx) {
    if (err instanceof HttpError) return c.json({ error: err.message, details: err.details }, err.status);
    const db = fromDbError(err);
    if (db) return c.json({ error: db.message, details: db.details }, db.status);
    console.error(err);
    return c.json({ error: 'Internal server error' }, 500);
}
