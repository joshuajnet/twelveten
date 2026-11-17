import { Hono } from 'hono';
import { sql, type Transaction } from 'kysely';
import { v7 as uuidv7 } from 'uuid';
import {
    artworkLinkSchema,
    workCreateSchema,
    workImageCreateSchema,
    workImagePatchSchema,
    workImagesOrderSchema,
    workLocation,
    workPatchSchema,
    workStatus,
    WORKS_PAGE_SIZE,
    type WorkChangeField,
} from '@twelveten/shared';
import type { AppEnv } from '../../env.ts';
import type { DB } from '../../db/index.ts';
import type { Database, WorkRow } from '../../db/types.ts';
import { toArtwork } from '../../content/serialize.ts';
import { artworkLinks, getWork, listWorks, trackedValues, workHistory } from '../../inventory/queries.ts';
import { body, HttpError } from './errors.ts';
import { ensureBaseline, recordRevision } from './revisions.ts';
import { createArtistProfile } from './people.ts';
import { closeGap, columns, conflictOr404, ensureCollectorProfile, findOr404, idParam, isUuid, listParam, nextPosition, pageParams, reorder, sameVersion, touch, uniqueSlug } from './util.ts';

type Trx = Transaction<Database>;

const WORK_COLUMNS = {
    inventoryNumber: 'inventory_number',
    title: 'title',
    dateText: 'date_text',
    medium: 'medium',
    dimensions: 'dimensions',
    edition: 'edition',
    credit: 'credit',
    priceCents: 'price_cents',
    currency: 'currency',
    status: 'status',
    location: 'location',
    locationNote: 'location_note',
    consignedOn: 'consigned_on',
    consignmentEndsOn: 'consignment_ends_on',
    soldOn: 'sold_on',
    salePriceCents: 'sale_price_cents',
    buyerId: 'buyer_id',
    saleNotes: 'sale_notes',
    notes: 'notes',
} as const;

/** Snapshot of a work for revisions: the row plus its images. */
async function workSnapshot(trx: Trx | DB, id: string) {
    const row = await trx.selectFrom('works').selectAll().where('id', '=', id).executeTakeFirst();
    if (!row) return null;
    const images = await trx.selectFrom('work_images').selectAll().where('work_id', '=', id).orderBy('position').execute();
    return { ...row, images };
}

/**
 * Append a work_changes row for every tracked field (price, status, location, consignment, sale)
 * whose value differs between `before` and `after`. `before` = null means the work is new.
 */
export async function recordWorkChanges(trx: Trx, before: WorkRow | null, after: WorkRow, note: string | null, userId: string | null): Promise<number> {
    const buyerName = async (id: string | null) => (id ? ((await trx.selectFrom('persons').select('name').where('id', '=', id).executeTakeFirst())?.name ?? null) : null);
    const withBuyer = async (v: ReturnType<typeof trackedValues>['sale']) => (v ? { ...v, buyerName: await buyerName(v.buyerId) } : null);
    const old = before ? trackedValues(before) : null;
    const now = trackedValues(after);
    let n = 0;
    for (const field of Object.keys(now) as WorkChangeField[]) {
        const a = old ? old[field] : null;
        const b = now[field];
        if (JSON.stringify(a) === JSON.stringify(b)) continue;
        // A new work only records the fields that were actually set (status always is).
        if (!before && b === null) continue;
        const [oldValue, newValue] = field === 'sale' ? [await withBuyer(a as never), await withBuyer(b as never)] : [a, b];
        await trx
            .insertInto('work_changes')
            .values({
                id: uuidv7(),
                work_id: after.id,
                field,
                old_value: JSON.stringify(oldValue),
                new_value: JSON.stringify(newValue),
                note,
                user_id: userId,
            })
            .execute();
        n++;
    }
    return n;
}

/** A buyer holding or owning a work is a collector. */
export async function collectorFor(trx: Trx, w: Pick<WorkRow, 'buyer_id' | 'status'>) {
    if (w.buyer_id && (w.status === 'on_hold' || w.status === 'sold')) await ensureCollectorProfile(trx, w.buyer_id);
}

async function assertArtist(db: Pick<DB, 'selectFrom'>, personId: string) {
    if (!(await db.selectFrom('artist_profiles').select('person_id').where('person_id', '=', personId).executeTakeFirst())) {
        throw new HttpError(400, 'That person has no artist profile');
    }
}

async function assertPerson(db: Pick<DB, 'selectFrom'>, personId: string | null | undefined) {
    if (personId && !(await db.selectFrom('persons').select('id').where('id', '=', personId).executeTakeFirst())) {
        throw new HttpError(400, 'Buyer not found');
    }
}

/** Append an image to a work at the end of its list. */
async function appendImage(trx: Trx, workId: string, url: string, alt: string) {
    await sql`SELECT pg_advisory_xact_lock(hashtext(${`work-images:${workId}`}))`.execute(trx);
    const position = await nextPosition(trx, 'work_images', { work_id: workId });
    return trx.insertInto('work_images').values({ work_id: workId, url, alt, position }).returningAll().executeTakeFirstOrThrow();
}

export function inventoryRoutes() {
    const app = new Hono<AppEnv>();

    const workOr404 = (db: DB, id: string) => findOr404((x) => getWork(db, x), id);

    // ---------- Works ----------

    app.get('/works', async (c) => {
        const artist = c.req.query('artist');
        const statuses = listParam(c, 'status', workStatus);
        const location = c.req.query('location');
        if (artist && !isUuid(artist)) throw new HttpError(400, 'Invalid artist');
        if (location && !workLocation.safeParse(location).success) throw new HttpError(400, 'Unknown location');
        const { page, pageSize } = pageParams(c, WORKS_PAGE_SIZE);
        return c.json(await listWorks(c.var.db, { artistId: artist, statuses, location, q: c.req.query('q')?.trim() || undefined }, page, pageSize));
    });

    app.post('/works', async (c) => {
        const input = await body(c, workCreateSchema);
        const db = c.var.db;
        await assertArtist(db, input.artistId);
        await assertPerson(db, input.buyerId);
        const id = await db.transaction().execute(async (trx) => {
            const created = await trx
                .insertInto('works')
                .values({ artist_id: input.artistId, ...columns(input, WORK_COLUMNS) } as never)
                .returningAll()
                .executeTakeFirstOrThrow();
            for (const img of input.images ?? []) await appendImage(trx, created.id, img.url, img.alt);
            await recordWorkChanges(trx, null, created, null, c.var.userId);
            await collectorFor(trx, created);
            await recordRevision(trx, { entity: 'work', entityId: created.id, action: 'create', snapshot: await workSnapshot(trx, created.id), userId: c.var.userId });
            return created.id;
        });
        return c.json(await getWork(db, id), 201);
    });

    app.get('/works/:id', async (c) => c.json(await workOr404(c.var.db, idParam(c))));

    app.get('/works/:id/history', async (c) => {
        await workOr404(c.var.db, idParam(c));
        return c.json({ items: await workHistory(c.var.db, idParam(c)) });
    });

    app.patch('/works/:id', async (c) => {
        const id = idParam(c);
        const patch = await body(c, workPatchSchema);
        const db = c.var.db;
        await workOr404(db, id);
        await assertPerson(db, patch.buyerId);
        const values = columns(patch, WORK_COLUMNS);
        if (Object.keys(values).length === 0) throw new HttpError(400, 'Nothing to update');
        const ok = await db.transaction().execute(async (trx) => {
            const before = await trx.selectFrom('works').selectAll().where('id', '=', id).forUpdate().executeTakeFirstOrThrow();
            await ensureBaseline(trx, 'work', id, () => workSnapshot(trx, id));
            const after = await trx.updateTable('works').set(values).where('id', '=', id).where(sameVersion(patch.updatedAt)).returningAll().executeTakeFirst();
            if (!after) return false;
            if (after.consigned_on && after.consignment_ends_on && after.consignment_ends_on < after.consigned_on) {
                throw new HttpError(400, 'Consignment must end after it starts');
            }
            await recordWorkChanges(trx, before, after, patch.changeNote ?? null, c.var.userId);
            await collectorFor(trx, after);
            await recordRevision(trx, { entity: 'work', entityId: id, action: 'update', snapshot: await workSnapshot(trx, id), userId: c.var.userId });
            return true;
        });
        if (!ok) return conflictOr404(true, () => getWork(db, id));
        return c.json(await getWork(db, id));
    });

    app.delete('/works/:id', async (c) => {
        const id = idParam(c);
        const db = c.var.db;
        await workOr404(db, id);
        await db.transaction().execute(async (trx) => {
            await recordRevision(trx, { entity: 'work', entityId: id, action: 'delete', snapshot: await workSnapshot(trx, id), userId: c.var.userId });
            // Slides that showed this work stay on their exhibitions, unlinked (FK: ON DELETE SET NULL).
            await trx.deleteFrom('works').where('id', '=', id).execute();
        });
        return c.body(null, 204);
    });

    // ---------- Work images ----------

    app.post('/works/:id/images', async (c) => {
        const id = idParam(c);
        const input = await body(c, workImageCreateSchema);
        const db = c.var.db;
        await workOr404(db, id);
        await db.transaction().execute(async (trx) => {
            await appendImage(trx, id, input.url, input.alt);
            await touch(trx, 'works', id);
        });
        return c.json(await getWork(db, id), 201);
    });

    app.patch('/works/:id/images/:imageId', async (c) => {
        const { id, imageId } = c.req.param();
        const input = await body(c, workImagePatchSchema);
        const db = c.var.db;
        if (!isUuid(id) || !isUuid(imageId)) throw new HttpError(404, 'Not found');
        const updated = await db.updateTable('work_images').set({ alt: input.alt }).where('id', '=', imageId).where('work_id', '=', id).executeTakeFirst();
        if (!updated.numUpdatedRows) throw new HttpError(404, 'Not found');
        return c.json(await getWork(db, id));
    });

    app.delete('/works/:id/images/:imageId', async (c) => {
        const { id, imageId } = c.req.param();
        const db = c.var.db;
        if (!isUuid(id) || !isUuid(imageId)) throw new HttpError(404, 'Not found');
        await db.transaction().execute(async (trx) => {
            const img = await trx.deleteFrom('work_images').where('id', '=', imageId).where('work_id', '=', id).returning('position').executeTakeFirst();
            if (!img) throw new HttpError(404, 'Not found');
            await closeGap(trx, 'work_images', { work_id: id }, img.position);
            await touch(trx, 'works', id);
        });
        return c.json(await getWork(db, id));
    });

    app.put('/works/:id/images/order', async (c) => {
        const id = idParam(c);
        const { ids } = await body(c, workImagesOrderSchema);
        const db = c.var.db;
        await workOr404(db, id);
        await db.transaction().execute(async (trx) => {
            await reorder(trx, 'work_images', { work_id: id }, ids, 'image of this work');
            await touch(trx, 'works', id);
        });
        return c.json(await getWork(db, id));
    });

    // ---------- Linking slideshow slides to artists and works ----------

    app.post('/artworks/:id/link', async (c) => {
        const id = idParam(c);
        const input = await body(c, artworkLinkSchema);
        const db = c.var.db;
        if (!isUuid(id)) throw new HttpError(404, 'Not found');
        const slide = await db.selectFrom('artworks').selectAll().where('id', '=', id).executeTakeFirst();
        if (!slide) throw new HttpError(404, 'Not found');
        const person = await db.selectFrom('persons').select(['id', 'name']).where('id', '=', input.personId).executeTakeFirst();
        if (!person) throw new HttpError(400, 'Person not found');
        if (input.workId) {
            const work = await db.selectFrom('works').select('artist_id').where('id', '=', input.workId).executeTakeFirst();
            if (!work) throw new HttpError(400, 'Work not found');
            if (work.artist_id !== person.id) throw new HttpError(400, 'That work belongs to a different artist');
        }
        const hasProfile = await db.selectFrom('artist_profiles').select('person_id').where('person_id', '=', person.id).executeTakeFirst();
        const slug = hasProfile ? null : await uniqueSlug(db, 'artist_profiles', person.name);

        const row = await db.transaction().execute(async (trx) => {
            const userId = c.var.userId;
            if (slug) await createArtistProfile(trx, person.id, { slug }, userId);
            let workId = input.workId;
            if (!workId) {
                const created = await trx
                    .insertInto('works')
                    .values({
                        artist_id: person.id,
                        title: slide.title ?? '',
                        date_text: slide.date_text,
                        medium: slide.media,
                        dimensions: slide.dimensions,
                        credit: slide.credit,
                        status: slide.available ? 'available' : 'nfs',
                    })
                    .returningAll()
                    .executeTakeFirstOrThrow();
                if (slide.image) await appendImage(trx, created.id, slide.image, slide.alt);
                await recordWorkChanges(trx, null, created, 'Created from an exhibition slide', userId);
                await recordRevision(trx, { entity: 'work', entityId: created.id, action: 'create', snapshot: await workSnapshot(trx, created.id), userId });
                workId = created.id;
            }
            await ensureBaseline(trx, 'artwork', id, () => trx.selectFrom('artworks').selectAll().where('id', '=', id).executeTakeFirst());
            const updated = await trx.updateTable('artworks').set({ work_id: workId }).where('id', '=', id).returningAll().executeTakeFirstOrThrow();
            await recordRevision(trx, { entity: 'artwork', entityId: id, action: 'update', snapshot: updated, userId });
            // The artist is now known to have been in this exhibition.
            const linked = await trx
                .selectFrom('exhibition_artists')
                .select('artist_id')
                .where('exhibition_id', '=', slide.exhibition_id)
                .where('artist_id', '=', person.id)
                .executeTakeFirst();
            if (!linked) {
                const position = await nextPosition(trx, 'exhibition_artists', { exhibition_id: slide.exhibition_id });
                await trx.insertInto('exhibition_artists').values({ exhibition_id: slide.exhibition_id, artist_id: person.id, position }).execute();
            }
            return updated;
        });
        const links = await artworkLinks(db, [row.id]);
        return c.json({ ...toArtwork(row), link: links.get(row.id) ?? null });
    });

    return app;
}
