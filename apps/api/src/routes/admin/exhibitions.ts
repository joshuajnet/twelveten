import { Hono } from 'hono';
import { sql, type Transaction } from 'kysely';
import {
    artworkCreateSchema,
    artworkOrderSchema,
    artworkPatchSchema,
    eventsPutSchema,
    exhibitionCreateSchema,
    exhibitionPatchSchema,
    exhibitionPath,
    type Artwork,
} from '@twelveten/shared';
import { sanitizeRichDoc } from '@twelveten/shared/rich/server';
import type { AppEnv } from '../../env.ts';
import type { DB } from '../../db/index.ts';
import type { Database } from '../../db/types.ts';
import { getExhibition } from '../../content/queries.ts';
import { toArtwork } from '../../content/serialize.ts';
import { artworkLinks } from '../../inventory/queries.ts';
import { body, HttpError } from './errors.ts';
import { ensureBaseline, recordRevision } from './revisions.ts';
import { closeGap, columns, conflictOr404, findOr404, idParam, nextPosition, reorder, sameVersion, touch, uniqueSlug, type Publish } from './util.ts';

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

/** An exhibition's id, slug and kind (enough for its page paths), or 404. */
export const exhibitionRef = (db: Pick<DB, 'selectFrom'>, id: string) =>
    findOr404((x) => db.selectFrom('exhibitions').select(['id', 'slug', 'kind']).where('id', '=', x).executeTakeFirst(), id);

/** Snapshot of an exhibition for revisions: the row plus its events. */
export async function exhibitionSnapshot(trx: Transaction<Database>, id: string) {
    const row = await trx.selectFrom('exhibitions').selectAll().where('id', '=', id).executeTakeFirst();
    if (!row) return null;
    const events = await trx.selectFrom('exhibition_events').selectAll().where('exhibition_id', '=', id).orderBy('position').execute();
    return { ...row, events };
}

/** Pages that show an exhibition: its own page, its list, and the home page if the splash links to it. */
export async function exhibitionPages(db: DB, e: { id: string; slug: string; kind: 'exhibition' | 'fair' }): Promise<string[]> {
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

/** Exhibitions and fairs, their events and slides. */
export function exhibitionRoutes({ publish }: { publish: Publish }) {
    const app = new Hono<AppEnv>();

    // ---------- Exhibitions & fairs ----------

    app.get('/exhibitions/:id', async (c) => {
        const e = await loadExhibitionById(c.var.db, idParam(c));
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
        const id = idParam(c);
        const patch = await body(c, exhibitionPatchSchema);
        const db = c.var.db;
        const before = await db.selectFrom('exhibitions').select(['id', 'slug', 'kind', 'published']).where('id', '=', id).executeTakeFirst();
        if (!before) throw new HttpError(404, 'Not found');
        const values = columns(patch, EXHIBITION_COLUMNS);
        if (patch.content) values.content = JSON.stringify(sanitizeRichDoc(patch.content));
        if (patch.headerLinks) values.header_links = JSON.stringify(patch.headerLinks);
        if (Object.keys(values).length === 0) throw new HttpError(400, 'Nothing to update');

        const updated = await db.transaction().execute(async (trx) => {
            await ensureBaseline(trx, 'exhibition', id, () => exhibitionSnapshot(trx, id));
            const row = await trx
                .updateTable('exhibitions')
                .set(values)
                .where('id', '=', id)
                .where(sameVersion(patch.updatedAt))
                .returningAll()
                .executeTakeFirst();
            if (!row) return null;
            await recordRevision(trx, { entity: 'exhibition', entityId: id, action: 'update', snapshot: await exhibitionSnapshot(trx, id), userId: c.var.userId });
            return row;
        });
        if (!updated) return conflictOr404(true, () => loadExhibitionById(db, id));

        const pages = await exhibitionPages(db, updated);
        if (before.slug !== updated.slug || before.kind !== updated.kind) pages.push(exhibitionPath(before), '/exhibitions', '/fairs');
        await publish(pages);
        return c.json(await loadExhibitionById(db, id));
    });

    app.delete('/exhibitions/:id', async (c) => {
        const id = idParam(c);
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
        const id = idParam(c);
        const { events } = await body(c, eventsPutSchema);
        const db = c.var.db;
        const e = await exhibitionRef(db, id);
        for (const ev of events) {
            if (ev.endsAt && ev.endsAt <= ev.startsAt) throw new HttpError(400, `“${ev.label}” must end after it starts`);
        }
        await db.transaction().execute(async (trx) => {
            await ensureBaseline(trx, 'exhibition', id, () => exhibitionSnapshot(trx, id));
            await trx.deleteFrom('exhibition_events').where('exhibition_id', '=', id).execute();
            if (events.length) {
                await trx
                    .insertInto('exhibition_events')
                    .values(events.map((ev, position) => ({ exhibition_id: id, label: ev.label, starts_at: ev.startsAt, ends_at: ev.endsAt, position })))
                    .execute();
            }
            await touch(trx, 'exhibitions', id);
            await recordRevision(trx, { entity: 'exhibition', entityId: id, action: 'update', snapshot: await exhibitionSnapshot(trx, id), userId: c.var.userId });
        });
        await publish(await exhibitionPages(db, e));
        return c.json(await loadExhibitionById(db, id));
    });

    // ---------- Slides ----------

    app.post('/exhibitions/:id/artworks', async (c) => {
        const id = idParam(c);
        const input = await body(c, artworkCreateSchema);
        const db = c.var.db;
        const e = await exhibitionRef(db, id);
        const row = await db.transaction().execute(async (trx) => {
            // Serialise appends per exhibition so positions stay unique.
            await sql`SELECT pg_advisory_xact_lock(hashtext(${id}))`.execute(trx);
            const position = await nextPosition(trx, 'artworks', { exhibition_id: id });
            const created = await trx
                .insertInto('artworks')
                .values({ exhibition_id: id, position, ...columns(input, ARTWORK_COLUMNS) } as never)
                .returningAll()
                .executeTakeFirstOrThrow();
            await recordRevision(trx, { entity: 'artwork', entityId: created.id, action: 'create', snapshot: created, userId: c.var.userId });
            return created;
        });
        await publish(await exhibitionPages(db, e));
        return c.json(await artworkWithLink(db, row), 201);
    });

    app.patch('/artworks/:id', async (c) => {
        const id = idParam(c);
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
        const id = idParam(c);
        const db = c.var.db;
        const existing = await db.selectFrom('artworks').selectAll().where('id', '=', id).executeTakeFirst();
        if (!existing) throw new HttpError(404, 'Not found');
        await db.transaction().execute(async (trx) => {
            await recordRevision(trx, { entity: 'artwork', entityId: id, action: 'delete', snapshot: existing, userId: c.var.userId });
            await trx.deleteFrom('artworks').where('id', '=', id).execute();
            await closeGap(trx, 'artworks', { exhibition_id: existing.exhibition_id }, existing.position);
        });
        const e = await db.selectFrom('exhibitions').select(['id', 'slug', 'kind']).where('id', '=', existing.exhibition_id).executeTakeFirstOrThrow();
        await publish(await exhibitionPages(db, e));
        return c.body(null, 204);
    });

    app.put('/exhibitions/:id/artworks/order', async (c) => {
        const id = idParam(c);
        const { ids } = await body(c, artworkOrderSchema);
        const db = c.var.db;
        const e = await exhibitionRef(db, id);
        await db.transaction().execute(async (trx) => {
            await reorder(trx, 'artworks', { exhibition_id: id }, ids, 'slide of this exhibition');
        });
        await publish(await exhibitionPages(db, e));
        return c.json((await loadExhibitionById(db, id))?.artworks ?? []);
    });

    return app;
}
