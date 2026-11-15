import { randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import type { Transaction } from 'kysely';
import {
    pointerToBase64,
    roomArtistsPutSchema,
    roomCreateSchema,
    roomPatchSchema,
    roomStatus,
    roomWorksPutSchema,
    ROOMS_PAGE_SIZE,
    type PointerData,
} from '@twelveten/shared';
import { sanitizeRichDoc } from '@twelveten/shared/rich/server';
import type { AppEnv } from '../../env.ts';
import type { DB } from '../../db/index.ts';
import type { Database } from '../../db/types.ts';
import { getRoom, listRooms, roomDashboard, visitorDashboard } from '../../rooms/queries.ts';
import { refreshEngagement } from '../../rooms/engagement.ts';
import { body, HttpError } from './errors.ts';
import { ensureBaseline, recordRevision } from './revisions.ts';
import { columns, conflictOr404, findOr404, idParam, isUuid, pageParams, sameVersion, touch } from './util.ts';

type Trx = Transaction<Database>;

const ROOM_COLUMNS = {
    title: 'title',
    showPrices: 'show_prices',
    hideUnavailable: 'hide_unavailable',
    status: 'status',
    opensAt: 'opens_at',
    closesAt: 'closes_at',
} as const;

/** A new link token: 32 random bytes, base64url (43 characters). */
export const newRoomToken = () => randomBytes(32).toString('base64url');

/** The room row with its works and artist settings, for revisions. */
export async function roomSnapshot(trx: Trx | DB, id: string) {
    const row = await trx.selectFrom('viewing_rooms').selectAll().where('id', '=', id).executeTakeFirst();
    if (!row) return null;
    const works = await trx.selectFrom('viewing_room_works').select(['work_id', 'position', 'show_price', 'hidden']).where('room_id', '=', id).orderBy('position').execute();
    const artists = await trx
        .selectFrom('viewing_room_artists')
        .select(['artist_id', 'position', 'show_bio', 'show_cv', 'show_press', 'hidden_press_ids'])
        .where('room_id', '=', id)
        .orderBy('position')
        .execute();
    return { ...row, works, artists };
}

/**
 * Keep the room's artist list in step with its works: artists whose works were added get default
 * settings at the end, artists with no works left are removed, the rest keep their settings and order.
 */
export async function syncRoomArtists(trx: Trx, roomId: string): Promise<void> {
    const wanted = await trx
        .selectFrom('viewing_room_works as rw')
        .innerJoin('works as w', 'w.id', 'rw.work_id')
        .select(['w.artist_id', (eb) => eb.fn.min('rw.position').as('first')])
        .where('rw.room_id', '=', roomId)
        .groupBy('w.artist_id')
        .orderBy('first')
        .execute();
    const ids = wanted.map((w) => w.artist_id);
    let del = trx.deleteFrom('viewing_room_artists').where('room_id', '=', roomId);
    if (ids.length) del = del.where('artist_id', 'not in', ids);
    await del.execute();
    const have = await trx.selectFrom('viewing_room_artists').select(['artist_id']).where('room_id', '=', roomId).orderBy('position').execute();
    const order = [...have.map((h) => h.artist_id), ...ids.filter((id) => !have.some((h) => h.artist_id === id))];
    for (const [position, artistId] of order.entries()) {
        await trx
            .insertInto('viewing_room_artists')
            .values({ room_id: roomId, artist_id: artistId, position })
            .onConflict((oc) => oc.columns(['room_id', 'artist_id']).doUpdateSet({ position }))
            .execute();
    }
}

async function replaceWorks(trx: Trx, roomId: string, works: { workId: string; showPrice: boolean | null; hidden: boolean }[]) {
    if (works.length) {
        const found = await trx
            .selectFrom('works')
            .select('id')
            .where(
                'id',
                'in',
                works.map((w) => w.workId),
            )
            .execute();
        if (found.length !== works.length) throw new HttpError(400, 'Some of these works no longer exist');
    }
    await trx.deleteFrom('viewing_room_works').where('room_id', '=', roomId).execute();
    for (const [position, w] of works.entries()) {
        await trx.insertInto('viewing_room_works').values({ room_id: roomId, work_id: w.workId, position, show_price: w.showPrice, hidden: w.hidden }).execute();
    }
    await syncRoomArtists(trx, roomId);
}

export function roomRoutes() {
    const app = new Hono<AppEnv>();
    const roomOr404 = (db: DB, id: string) => findOr404((x) => getRoom(db, x), id);

    const record = async (trx: Trx, id: string, action: 'create' | 'update' | 'delete', userId: string | null) =>
        recordRevision(trx, { entity: 'viewing_room', entityId: id, action, snapshot: await roomSnapshot(trx, id), userId });

    app.get('/rooms', async (c) => {
        const status = c.req.query('status');
        const parsed = status ? roomStatus.safeParse(status) : null;
        if (parsed && !parsed.success) throw new HttpError(400, 'Unknown status');
        const { page, pageSize } = pageParams(c, ROOMS_PAGE_SIZE);
        return c.json(await listRooms(c.var.db, { q: c.req.query('q')?.trim() || undefined, status: parsed?.data }, page, pageSize));
    });

    app.post('/rooms', async (c) => {
        const input = await body(c, roomCreateSchema);
        const db = c.var.db;
        const id = await db.transaction().execute(async (trx) => {
            const values: Record<string, unknown> = { ...columns(input, ROOM_COLUMNS), token: newRoomToken(), created_by: c.var.userId };
            if (input.intro) values.intro = JSON.stringify(sanitizeRichDoc(input.intro));
            const row = await trx.insertInto('viewing_rooms').values(values as never).returning('id').executeTakeFirstOrThrow();
            if (input.works?.length) await replaceWorks(trx, row.id, input.works.map((workId) => ({ workId, showPrice: null, hidden: false })));
            await record(trx, row.id, 'create', c.var.userId);
            return row.id;
        });
        return c.json(await getRoom(db, id), 201);
    });

    app.get('/rooms/:id', async (c) => c.json(await roomOr404(c.var.db, idParam(c))));

    app.patch('/rooms/:id', async (c) => {
        const id = idParam(c);
        const patch = await body(c, roomPatchSchema);
        const db = c.var.db;
        await roomOr404(db, id);
        const values: Record<string, unknown> = columns(patch, ROOM_COLUMNS);
        if (patch.intro) values.intro = JSON.stringify(sanitizeRichDoc(patch.intro));
        if (Object.keys(values).length === 0) throw new HttpError(400, 'Nothing to update');
        const ok = await db.transaction().execute(async (trx) => {
            await ensureBaseline(trx, 'viewing_room', id, () => roomSnapshot(trx, id));
            const updated = await trx.updateTable('viewing_rooms').set(values).where('id', '=', id).where(sameVersion(patch.updatedAt)).returning('id').executeTakeFirst();
            if (!updated) return false;
            // Engagement depends on which works are visible.
            if ('hide_unavailable' in values) await refreshRoom(trx, id);
            await record(trx, id, 'update', c.var.userId);
            return true;
        });
        if (!ok) return conflictOr404(true, () => getRoom(db, id));
        return c.json(await getRoom(db, id));
    });

    app.delete('/rooms/:id', async (c) => {
        const id = idParam(c);
        const db = c.var.db;
        const room = await roomOr404(db, id);
        if (room.visitors) throw new HttpError(409, 'People have visited this room; close it instead of deleting it');
        await db.transaction().execute(async (trx) => {
            await record(trx, id, 'delete', c.var.userId);
            await trx.deleteFrom('viewing_rooms').where('id', '=', id).execute();
        });
        return c.body(null, 204);
    });

    app.put('/rooms/:id/works', async (c) => {
        const id = idParam(c);
        const { works } = await body(c, roomWorksPutSchema);
        const db = c.var.db;
        await roomOr404(db, id);
        await db.transaction().execute(async (trx) => {
            await ensureBaseline(trx, 'viewing_room', id, () => roomSnapshot(trx, id));
            await replaceWorks(
                trx,
                id,
                works.map((w) => ({ workId: w.workId, showPrice: w.showPrice ?? null, hidden: w.hidden ?? false })),
            );
            await touch(trx, 'viewing_rooms', id);
            await refreshRoom(trx, id);
            await record(trx, id, 'update', c.var.userId);
        });
        return c.json(await getRoom(db, id));
    });

    app.put('/rooms/:id/artists', async (c) => {
        const id = idParam(c);
        const { artists } = await body(c, roomArtistsPutSchema);
        const db = c.var.db;
        const room = await roomOr404(db, id);
        const known = new Set(room.artists.map((a) => a.artistId));
        if (artists.length !== known.size || artists.some((a) => !known.has(a.artistId)) || new Set(artists.map((a) => a.artistId)).size !== artists.length) {
            throw new HttpError(400, 'List every artist in the room exactly once');
        }
        await db.transaction().execute(async (trx) => {
            await ensureBaseline(trx, 'viewing_room', id, () => roomSnapshot(trx, id));
            for (const [position, a] of artists.entries()) {
                await trx
                    .updateTable('viewing_room_artists')
                    .set({ position, show_bio: a.showBio, show_cv: a.showCv, show_press: a.showPress, hidden_press_ids: a.hiddenPressIds ?? [] })
                    .where('room_id', '=', id)
                    .where('artist_id', '=', a.artistId)
                    .execute();
            }
            await touch(trx, 'viewing_rooms', id);
            await record(trx, id, 'update', c.var.userId);
        });
        return c.json(await getRoom(db, id));
    });

    /** A new link; the old one stops working (viewers already in keep their cookie only for the old path). */
    app.post('/rooms/:id/token', async (c) => {
        const id = idParam(c);
        const db = c.var.db;
        await roomOr404(db, id);
        await db.transaction().execute(async (trx) => {
            await trx.updateTable('viewing_rooms').set({ token: newRoomToken() }).where('id', '=', id).execute();
            await trx.deleteFrom('viewing_room_cookies').where('visitor_id', 'in', (eb) => eb.selectFrom('viewing_room_visitors').select('id').where('room_id', '=', id)).execute();
            await record(trx, id, 'update', c.var.userId);
        });
        return c.json(await getRoom(db, id));
    });

    app.get('/rooms/:id/dashboard', async (c) => {
        const d = await roomDashboard(c.var.db, idParam(c));
        if (!d) throw new HttpError(404, 'Not found');
        return c.json(d);
    });

    app.get('/rooms/:id/visitors/:visitorId', async (c) => {
        const visitorId = c.req.param('visitorId');
        if (!isUuid(visitorId)) throw new HttpError(404, 'Not found');
        const d = await visitorDashboard(c.var.db, idParam(c), visitorId);
        if (!d) throw new HttpError(404, 'Not found');
        return c.json(d);
    });

    /** Forget one visitor's activity in a room (visits, stats, events, remembered browsers). The person stays. */
    app.delete('/rooms/:id/visitors/:visitorId', async (c) => {
        const visitorId = c.req.param('visitorId');
        if (!isUuid(visitorId)) throw new HttpError(404, 'Not found');
        const gone = await c.var.db.deleteFrom('viewing_room_visitors').where('id', '=', visitorId).where('room_id', '=', idParam(c)).returning('id').executeTakeFirst();
        if (!gone) throw new HttpError(404, 'Not found');
        return c.body(null, 204);
    });

    /** Packed pointer samples for one work (or every work), for heatmaps. */
    app.get('/rooms/:id/visitors/:visitorId/pointer', async (c) => {
        const roomId = idParam(c);
        const visitorId = c.req.param('visitorId');
        const work = c.req.query('work');
        if (!isUuid(visitorId) || (work !== undefined && !isUuid(work))) throw new HttpError(404, 'Not found');
        const visitor = await c.var.db.selectFrom('viewing_room_visitors').select('id').where('id', '=', visitorId).where('room_id', '=', roomId).executeTakeFirst();
        if (!visitor) throw new HttpError(404, 'Not found');
        let q = c.var.db.selectFrom('viewing_room_pointer').select(['work_id', 'points']).where('visitor_id', '=', visitorId).orderBy('id');
        if (work) q = q.where('work_id', '=', work);
        const rows = await q.execute();
        const byWork = new Map<string, Buffer[]>();
        for (const r of rows) byWork.set(r.work_id, [...(byWork.get(r.work_id) ?? []), r.points]);
        const items: PointerData[] = [...byWork].map(([workId, chunks]) => ({ workId, points: pointerToBase64(new Uint8Array(Buffer.concat(chunks))) }));
        return c.json({ items });
    });

    return app;
}

/** Recompute every visitor's engagement after the room's visible works change. */
async function refreshRoom(trx: Trx, roomId: string): Promise<void> {
    const visitors = await trx.selectFrom('viewing_room_visitors').select('id').where('room_id', '=', roomId).execute();
    for (const v of visitors) await refreshEngagement(trx, v.id);
}

