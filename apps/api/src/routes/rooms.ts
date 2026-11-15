import { createHash, randomBytes } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { sql, type Transaction } from 'kysely';
import { normalizeEmail, packPointer, ROOM_TOKEN_RE, roomEnterSchema, trackBatchSchema, VISIT_GAP_MS, type PublicRoom } from '@twelveten/shared';
import type { AppEnv } from '../env.ts';
import type { DB } from '../db/index.ts';
import type { Database, ViewingRoomRow } from '../db/types.ts';
import { viewerIp } from '../auth/auth.ts';
import { liveRoomByToken, publicRoom, visibleArtistIds, visibleWorkIds } from '../rooms/queries.ts';
import { refreshEngagement } from '../rooms/engagement.ts';
import { getArtistProfile } from '../people/queries.ts';
import { renderCvPdf } from '../people/cvPdf.ts';
import { HttpError, validationError } from './admin/errors.ts';
import { recordRevision } from './admin/revisions.ts';
import { ensureCollectorProfile, isUuid, pdfResponse } from './admin/util.ts';

export const ROOM_COOKIE = 'twelveten_vr';
const COOKIE_MAX_AGE = 365 * 24 * 3600;
const ENTER_LIMIT = { max: 10, windowMs: 60_000 };
const MAX_TRACK_BYTES = 256 * 1024;

type Ctx = Context<AppEnv>;
type Trx = Transaction<Database>;

const hash = (v: string) => createHash('sha256').update(v).digest('hex');
const cookiePath = (token: string) => `/api/rooms/${token}`;

/**
 * Public viewing room routes. Anyone with the link sees the gate; after entering a name and email,
 * a per-room HttpOnly cookie remembers the visitor in this browser. Nothing here is cached.
 */
export function roomPublicRoutes(opts: { siteUrl: string }) {
    const app = new Hono<AppEnv>();
    const siteOrigin = new URL(opts.siteUrl).origin;
    const secure = opts.siteUrl.startsWith('https://');

    app.use('/rooms/*', async (c, next) => {
        c.header('Cache-Control', 'private, no-store');
        c.header('X-Robots-Tag', 'noindex, nofollow');
        const token = c.req.path.split('/')[3] ?? '';
        if (!ROOM_TOKEN_RE.test(token)) throw new HttpError(404, 'Not found');
        // Writes only from the site itself (browsers always send Origin on POST).
        if (c.req.method === 'POST') {
            const origin = c.req.header('origin');
            if (origin && origin !== siteOrigin) throw new HttpError(403, 'Forbidden');
        }
        await next();
    });

    /** The visitor this browser's cookie belongs to, in this room. */
    async function visitorFor(c: Ctx, room: ViewingRoomRow) {
        const raw = getCookie(c, ROOM_COOKIE);
        if (!raw || raw.length > 100) return null;
        const row = await c.var.db
            .selectFrom('viewing_room_cookies as k')
            .innerJoin('viewing_room_visitors as v', 'v.id', 'k.visitor_id')
            .selectAll('v')
            .where('k.hash', '=', hash(raw))
            .where('v.room_id', '=', room.id)
            .executeTakeFirst();
        return row ?? null;
    }

    /** The visitor's current visit, or a new one after 30 minutes away. */
    async function currentVisit(trx: Trx, visitorId: string, userAgent: string | undefined): Promise<string> {
        const last = await trx
            .selectFrom('viewing_room_visits')
            .select(['id', 'last_activity_at'])
            .where('visitor_id', '=', visitorId)
            .orderBy('started_at', 'desc')
            .limit(1)
            .executeTakeFirst();
        if (last && Date.now() - Date.parse(last.last_activity_at) < VISIT_GAP_MS) {
            await trx.updateTable('viewing_room_visits').set({ last_activity_at: sql`now()` }).where('id', '=', last.id).execute();
            await trx.updateTable('viewing_room_visitors').set({ last_seen_at: sql`now()` }).where('id', '=', visitorId).execute();
            return last.id;
        }
        const visit = await trx
            .insertInto('viewing_room_visits')
            .values({ visitor_id: visitorId, user_agent: userAgent?.slice(0, 200) ?? null })
            .returning('id')
            .executeTakeFirstOrThrow();
        await trx
            .updateTable('viewing_room_visitors')
            .set((eb) => ({ visit_count: eb('visit_count', '+', 1), last_seen_at: sql`now()` }))
            .where('id', '=', visitorId)
            .execute();
        await trx.insertInto('viewing_room_events').values({ visit_id: visit.id, type: 'enter' }).execute();
        await refreshEngagement(trx, visitorId);
        return visit.id;
    }

    async function roomFor(c: Ctx): Promise<{ room: ViewingRoomRow; token: string }> {
        const token = c.req.param('token')!;
        const room = await liveRoomByToken(c.var.db, token);
        if (!room) throw new HttpError(404, 'Not found');
        return { room, token };
    }

    app.get('/rooms/:token', async (c) => {
        const token = c.req.param('token');
        const db = c.var.db;
        // Admins can look at any room (any status) without a gate or tracking.
        if (c.req.query('preview') === '1' && c.var.isAdmin) {
            const room = await db.selectFrom('viewing_rooms').selectAll().where('token', '=', token).executeTakeFirst();
            if (!room) throw new HttpError(404, 'Not found');
            return c.json({ room: await publicRoom(db, room, null, null) });
        }
        const { room } = await roomFor(c);
        const visitor = await visitorFor(c, room);
        if (!visitor) return c.json({ gate: { title: room.title } });
        const visitId = await db.transaction().execute((trx) => currentVisit(trx, visitor.id, c.req.header('user-agent')));
        return c.json({ room: await publicRoom(db, room, { name: visitor.entered_name }, visitId) satisfies PublicRoom });
    });

    app.post('/rooms/:token/enter', async (c) => {
        const { room, token } = await roomFor(c);
        const db = c.var.db;
        await rateLimit(db, `room-enter:${clientIp(c)}`);
        let raw: unknown;
        try {
            raw = await c.req.json();
        } catch {
            throw new HttpError(400, 'Request body must be JSON');
        }
        const parsed = roomEnterSchema.safeParse(raw);
        if (!parsed.success) throw validationError(parsed.error);
        const { name } = parsed.data;
        const email = normalizeEmail(parsed.data.email);

        const cookie = randomBytes(32).toString('base64url');
        const { visitor, visitId } = await db.transaction().execute(async (trx) => {
            // The same email (main or alias) is the same person; otherwise a new person.
            let personId: string | undefined;
            let match: 'email' | 'alias' | 'new' = 'email';
            const byEmail = await trx
                .selectFrom('persons')
                .select('id')
                .where(sql<string>`lower(btrim(email))`, '=', email)
                .orderBy('created_at')
                .limit(1)
                .executeTakeFirst();
            personId = byEmail?.id;
            if (!personId) {
                const byAlias = await trx.selectFrom('person_emails').select('person_id').where('email', '=', email).executeTakeFirst();
                personId = byAlias?.person_id;
                match = 'alias';
            }
            if (!personId) {
                const created = await trx
                    .insertInto('persons')
                    .values({ name, email, notes: `Created from viewing room “${room.title}”` })
                    .returningAll()
                    .executeTakeFirstOrThrow();
                await recordRevision(trx, { entity: 'person', entityId: created.id, action: 'create', snapshot: created, userId: null });
                personId = created.id;
                match = 'new';
            }
            await ensureCollectorProfile(trx, personId);
            const visitor = await trx
                .insertInto('viewing_room_visitors')
                .values({ room_id: room.id, person_id: personId, entered_name: name, entered_email: email, match })
                .onConflict((oc) => oc.columns(['room_id', 'person_id']).doUpdateSet({ entered_name: name, entered_email: email }))
                .returningAll()
                .executeTakeFirstOrThrow();
            await trx.insertInto('viewing_room_cookies').values({ hash: hash(cookie), visitor_id: visitor.id }).execute();
            const visitId = await currentVisit(trx, visitor.id, c.req.header('user-agent'));
            return { visitor, visitId };
        });

        setCookie(c, ROOM_COOKIE, cookie, { path: cookiePath(token), httpOnly: true, secure, sameSite: 'Lax', maxAge: COOKIE_MAX_AGE });
        return c.json({ room: await publicRoom(db, room, { name: visitor.entered_name }, visitId) satisfies PublicRoom });
    });

    app.post('/rooms/:token/track', async (c) => {
        const { room } = await roomFor(c);
        const db = c.var.db;
        const visitor = await visitorFor(c, room);
        if (!visitor) throw new HttpError(401, 'Enter the room first');
        // sendBeacon posts text/plain; parse the JSON ourselves either way.
        const text = await c.req.text();
        if (text.length > MAX_TRACK_BYTES) throw new HttpError(413, 'Too much at once');
        let raw: unknown;
        try {
            raw = JSON.parse(text);
        } catch {
            throw new HttpError(400, 'Request body must be JSON');
        }
        const parsed = trackBatchSchema.safeParse(raw);
        if (!parsed.success) throw validationError(parsed.error);
        const batch = parsed.data;

        const visit = await db
            .selectFrom('viewing_room_visits')
            .select(['id', 'last_activity_at'])
            .where('id', '=', batch.visitId)
            .where('visitor_id', '=', visitor.id)
            .executeTakeFirst();
        if (!visit) throw new HttpError(400, 'Unknown visit');

        // Time can't add up to more than has passed since the last batch (plus a little slack).
        const cap = Math.max(0, Date.now() - Date.parse(visit.last_activity_at)) + 15_000;
        const clamp = (ms: number) => Math.min(ms, cap);
        const [works, artists] = await Promise.all([visibleWorkIds(db, room.id), visibleArtistIds(db, room.id)]);
        const okWork = (id: string | null | undefined) => !id || works.has(id);
        const okArtist = (id: string | null | undefined) => !id || artists.has(id);

        await db.transaction().execute(async (trx) => {
            for (const w of batch.works.filter((w) => works.has(w.workId))) {
                await sql`
INSERT INTO viewing_room_work_stats AS t (visitor_id, work_id, view_ms, hover_ms, zoom_ms, focus_count, zoom_count, max_zoom, clicks, inquiries, visits_seen, last_visit_id, last_seen_at)
VALUES (${visitor.id}, ${w.workId}, ${clamp(w.viewMs)}, ${clamp(w.hoverMs)}, ${clamp(w.zoomMs)}, ${w.focus}, ${w.zooms}, ${w.maxZoom}, ${w.clicks}, ${w.inquiries}, 1, ${visit.id}, now())
ON CONFLICT (visitor_id, work_id) DO UPDATE SET
  view_ms = t.view_ms + excluded.view_ms, hover_ms = t.hover_ms + excluded.hover_ms, zoom_ms = t.zoom_ms + excluded.zoom_ms,
  focus_count = t.focus_count + excluded.focus_count, zoom_count = t.zoom_count + excluded.zoom_count,
  max_zoom = greatest(t.max_zoom, excluded.max_zoom), clicks = t.clicks + excluded.clicks, inquiries = t.inquiries + excluded.inquiries,
  visits_seen = t.visits_seen + CASE WHEN t.last_visit_id IS DISTINCT FROM excluded.last_visit_id THEN 1 ELSE 0 END,
  last_visit_id = excluded.last_visit_id, last_seen_at = now()`.execute(trx);
            }
            for (const a of batch.artists.filter((a) => artists.has(a.artistId))) {
                await sql`
INSERT INTO viewing_room_artist_stats AS t (visitor_id, artist_id, read_ms, opens, cv_opens, press_clicks)
VALUES (${visitor.id}, ${a.artistId}, ${clamp(a.readMs)}, ${a.opens}, ${a.cvOpens}, ${a.pressClicks})
ON CONFLICT (visitor_id, artist_id) DO UPDATE SET
  read_ms = t.read_ms + excluded.read_ms, opens = t.opens + excluded.opens,
  cv_opens = t.cv_opens + excluded.cv_opens, press_clicks = t.press_clicks + excluded.press_clicks`.execute(trx);
            }
            const events = batch.events.filter((e) => okWork(e.workId) && okArtist(e.artistId));
            if (events.length) {
                await trx
                    .insertInto('viewing_room_events')
                    .values(
                        events.map((e) => ({
                            visit_id: visit.id,
                            type: e.type,
                            at: e.at,
                            work_id: e.workId ?? null,
                            artist_id: e.artistId ?? null,
                            data: e.data ? JSON.stringify(e.data) : null,
                        })),
                    )
                    .execute();
            }
            for (const p of batch.pointer.filter((p) => works.has(p.workId) && p.points.length)) {
                await trx
                    .insertInto('viewing_room_pointer')
                    .values({ visitor_id: visitor.id, visit_id: visit.id, work_id: p.workId, points: Buffer.from(packPointer(p.points)) })
                    .execute();
            }
            const active = clamp(batch.activeMs);
            await trx
                .updateTable('viewing_room_visits')
                .set((eb) => ({ active_ms: eb('active_ms', '+', active), last_activity_at: sql`now()` }))
                .where('id', '=', visit.id)
                .execute();
            await trx
                .updateTable('viewing_room_visitors')
                .set((eb) => ({ active_ms: eb('active_ms', '+', active), last_seen_at: sql`now()` }))
                .where('id', '=', visitor.id)
                .execute();
            await refreshEngagement(trx, visitor.id);
        });
        return c.body(null, 204);
    });

    app.get('/rooms/:token/artists/:artistId/cv.pdf', async (c) => {
        const artistId = c.req.param('artistId');
        if (!isUuid(artistId)) throw new HttpError(404, 'Not found');
        const db = c.var.db;
        const { room } = await roomFor(c);
        const visitor = await visitorFor(c, room);
        if (!visitor) throw new HttpError(401, 'Enter the room first');
        const settings = await db.selectFrom('viewing_room_artists').select('show_cv').where('room_id', '=', room.id).where('artist_id', '=', artistId).executeTakeFirst();
        if (!settings?.show_cv || !(await visibleArtistIds(db, room.id)).has(artistId)) throw new HttpError(404, 'Not found');
        const [person, profile] = await Promise.all([
            db.selectFrom('persons').select(['name', 'birth_date', 'birth_place', 'website']).where('id', '=', artistId).executeTakeFirstOrThrow(),
            getArtistProfile(db, artistId),
        ]);
        if (!profile) throw new HttpError(404, 'Not found');
        await db.transaction().execute(async (trx) => {
            const visitId = await currentVisit(trx, visitor.id, c.req.header('user-agent'));
            await trx.insertInto('viewing_room_events').values({ visit_id: visitId, type: 'cv_pdf', artist_id: artistId }).execute();
            await sql`
INSERT INTO viewing_room_artist_stats AS t (visitor_id, artist_id, cv_opens) VALUES (${visitor.id}, ${artistId}, 1)
ON CONFLICT (visitor_id, artist_id) DO UPDATE SET cv_opens = t.cv_opens + 1`.execute(trx);
            await refreshEngagement(trx, visitor.id);
        });
        const pdf = await renderCvPdf({ name: person.name, birthDate: person.birth_date, birthPlace: person.birth_place, website: person.website }, profile.cv);
        return pdfResponse(c, pdf, `${profile.slug}-cv.pdf`);
    });

    return app;
}

/** The visitor's address: CloudFront's viewer address, else the local proxy's X-Forwarded-For. */
function clientIp(c: Ctx): string {
    return viewerIp(c.req.header('cloudfront-viewer-address') ?? null) ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

/** Fixed-window limit shared across API instances (Better Auth's rateLimit table, our own key prefix). */
async function rateLimit(db: DB, key: string): Promise<void> {
    const now = Date.now();
    const r = await sql<{ count: number }>`
INSERT INTO "rateLimit" (key, count, "lastRequest") VALUES (${key}, 1, ${now})
ON CONFLICT (key) DO UPDATE SET
  count = CASE WHEN "rateLimit"."lastRequest" < ${now - ENTER_LIMIT.windowMs} THEN 1 ELSE "rateLimit".count + 1 END,
  "lastRequest" = CASE WHEN "rateLimit"."lastRequest" < ${now - ENTER_LIMIT.windowMs} THEN ${now} ELSE "rateLimit"."lastRequest" END
RETURNING count`.execute(db);
    if (Number(r.rows[0]?.count ?? 0) > ENTER_LIMIT.max) throw new HttpError(429, 'Too many attempts; try again in a minute');
}
