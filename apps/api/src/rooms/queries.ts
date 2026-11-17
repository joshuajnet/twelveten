import { sql } from 'kysely';
import {
    formatPrice,
    htmlToText,
    UNAVAILABLE_LABELS,
    VIEWED_MS,
    workInterest,
    type ArtistInterest,
    type NumberedPage,
    type PublicRoom,
    type PublicRoomArtist,
    type PublicRoomWork,
    type RichDoc,
    type RoomArtistSettings,
    type RoomDashboard,
    type RoomEvent,
    type RoomStatus,
    type RoomSummary,
    type RoomVisit,
    type RoomVisitorSummary,
    type ViewingRoom,
    type VisitorDashboard,
    type WorkInterest,
    type WorkStatus,
} from '@twelveten/shared';
import { richToHtmlServer } from '@twelveten/shared/rich/server';
import type { DB } from '../db/index.ts';
import type { ViewingRoomRow } from '../db/types.ts';
import { likePattern, numberedPage } from '../lib/paging.ts';
import { summaryQuery, toSummary } from '../inventory/queries.ts';
import { getArtistProfile } from '../people/queries.ts';
import { duplicatesOf } from '../people/duplicates.ts';
import { visibleRoomWorks } from './engagement.ts';

type Q = Pick<DB, 'selectFrom'>;

const isEmptyDoc = (d: RichDoc | null | undefined) => !d || !htmlToText(richToHtmlServer(d)).trim();

// ---------- Admin ----------

/** The room's artists with their settings, in room order; press is the artist's full list. */
async function roomArtistSettings(db: Q, roomId: string): Promise<RoomArtistSettings[]> {
    const rows = await db
        .selectFrom('viewing_room_artists as ra')
        .innerJoin('persons as p', 'p.id', 'ra.artist_id')
        .selectAll('ra')
        .select(['p.name', 'p.portrait'])
        .where('ra.room_id', '=', roomId)
        .orderBy('ra.position')
        .execute();
    return Promise.all(
        rows.map(async (r) => {
            const profile = await getArtistProfile(db, r.artist_id);
            return {
                artistId: r.artist_id,
                name: r.name,
                portrait: r.portrait,
                showBio: r.show_bio,
                showCv: r.show_cv,
                showPress: r.show_press,
                hiddenPressIds: r.hidden_press_ids,
                bioBackground: r.bio_background,
                bioBackgroundColor: r.bio_background_color,
                hasBio: !isEmptyDoc(profile?.bio),
                hasCv: !isEmptyDoc(profile?.cv),
                press: profile?.press ?? [],
            };
        }),
    );
}

export async function getRoom(db: Q, id: string): Promise<ViewingRoom | null> {
    const row = await db.selectFrom('viewing_rooms').selectAll().where('id', '=', id).executeTakeFirst();
    if (!row) return null;
    const [works, artists, visitors] = await Promise.all([
        summaryQuery(db)
            .innerJoin('viewing_room_works as rw', 'rw.work_id', 'w.id')
            .select(['rw.show_price', 'rw.hidden', 'rw.position'])
            .where('rw.room_id', '=', id)
            .orderBy('rw.position')
            .execute(),
        roomArtistSettings(db, id),
        db.selectFrom('viewing_room_visitors').select((eb) => eb.fn.countAll<number>().as('n')).where('room_id', '=', id).executeTakeFirst(),
    ]);
    return {
        id: row.id,
        token: row.token,
        title: row.title,
        subtitle: row.subtitle,
        intro: row.intro,
        coverImage: row.cover_image,
        showPrices: row.show_prices,
        hideUnavailable: row.hide_unavailable,
        pdfHidden: row.pdf_hidden,
        status: row.status,
        opensAt: row.opens_at,
        closesAt: row.closes_at,
        works: works.map((w) => ({ workId: w.id, showPrice: w.show_price, hidden: w.hidden, work: toSummary(w) })),
        artists,
        visitors: Number(visitors?.n ?? 0),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function summaryRoomQuery(db: Q) {
    return db
        .selectFrom('viewing_rooms as r')
        .selectAll('r')
        .select([
            (eb) => eb.selectFrom('viewing_room_works as rw').select((e) => e.fn.countAll<number>().as('n')).whereRef('rw.room_id', '=', 'r.id').as('works'),
            (eb) => eb.selectFrom('viewing_room_visitors as v').select((e) => e.fn.countAll<number>().as('n')).whereRef('v.room_id', '=', 'r.id').as('visitors'),
            (eb) => eb.selectFrom('viewing_room_visitors as v').select((e) => e.fn.max('v.last_seen_at').as('m')).whereRef('v.room_id', '=', 'r.id').as('last_visit'),
            (eb) =>
                eb
                    .selectFrom('viewing_room_works as rw')
                    .innerJoin('work_images as i', 'i.work_id', 'rw.work_id')
                    .select('i.url')
                    .whereRef('rw.room_id', '=', 'r.id')
                    .orderBy('rw.position')
                    .orderBy('i.position')
                    .limit(1)
                    .as('cover'),
        ]);
}

function toRoomSummary(r: ViewingRoomRow & { works: number | null; visitors: number | null; last_visit: string | null; cover: string | null }): RoomSummary {
    return {
        id: r.id,
        token: r.token,
        title: r.title,
        subtitle: r.subtitle,
        status: r.status,
        opensAt: r.opens_at,
        closesAt: r.closes_at,
        works: Number(r.works ?? 0),
        visitors: Number(r.visitors ?? 0),
        lastVisitAt: r.last_visit ?? null,
        cover: r.cover_image ?? r.cover ?? null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    };
}

export async function listRooms(db: Q, f: { q?: string; statuses?: RoomStatus[] }, page: number, pageSize: number): Promise<NumberedPage<RoomSummary>> {
    let q = summaryRoomQuery(db).orderBy('r.created_at', 'desc').orderBy('r.id', 'desc');
    if (f.statuses?.length) q = q.where('r.status', 'in', f.statuses);
    if (f.q) q = q.where('r.title', 'ilike', likePattern(f.q));
    return numberedPage(q, page, pageSize, (r) => toRoomSummary(r as never));
}

// ---------- Visitors and interest ----------

function visitorQuery(db: Q) {
    return db
        .selectFrom('viewing_room_visitors as v')
        .innerJoin('viewing_rooms as r', 'r.id', 'v.room_id')
        .innerJoin('persons as p', 'p.id', 'v.person_id')
        .selectAll('v')
        .select(['r.title as room_title', 'r.status as room_status', 'p.name as person_name'])
        .select([
            (eb) =>
                eb
                    .selectFrom('viewing_room_work_stats as s')
                    .select((e) => e.fn.countAll<number>().as('n'))
                    .whereRef('s.visitor_id', '=', 'v.id')
                    .where('s.view_ms', '>=', VIEWED_MS)
                    .as('works_viewed'),
            (eb) =>
                eb
                    .selectFrom('viewing_room_work_stats as s')
                    .select(sql<number>`coalesce(sum(s.inquiries), 0)`.as('n'))
                    .whereRef('s.visitor_id', '=', 'v.id')
                    .as('inquiries'),
            sql<number>`(SELECT count(*) FROM (${visibleRoomWorks(sql`v.room_id`)}) vw)`.as('works_total'),
        ]);
}

type VisitorRow = Awaited<ReturnType<ReturnType<typeof visitorQuery>['execute']>>[number];

function toVisitorSummary(r: VisitorRow): RoomVisitorSummary {
    return {
        id: r.id,
        roomId: r.room_id,
        roomTitle: r.room_title,
        roomStatus: r.room_status,
        personId: r.person_id,
        personName: r.person_name,
        enteredName: r.entered_name,
        enteredEmail: r.entered_email,
        match: r.match,
        firstSeenAt: r.first_seen_at,
        lastSeenAt: r.last_seen_at,
        visits: r.visit_count,
        activeMs: Number(r.active_ms),
        worksViewed: Number(r.works_viewed ?? 0),
        worksTotal: Number(r.works_total ?? 0),
        inquiries: Number(r.inquiries ?? 0),
        engagement: r.engagement,
    };
}

/** Rooms a person entered, most recent first. */
export async function roomsForPerson(db: Q, personId: string): Promise<RoomVisitorSummary[]> {
    const rows = await visitorQuery(db).where('v.person_id', '=', personId).orderBy('v.last_seen_at', 'desc').execute();
    return rows.map(toVisitorSummary);
}

/** Per-work stats joined with the work's caption and cover, interest computed. */
async function workInterests(db: Q, visitorIds: string[]): Promise<(WorkInterest & { visitorId: string; roomId: string })[]> {
    if (!visitorIds.length) return [];
    const rows = await db
        .selectFrom('viewing_room_work_stats as s')
        .innerJoin('viewing_room_visitors as v', 'v.id', 's.visitor_id')
        .innerJoin('works as w', 'w.id', 's.work_id')
        .innerJoin('persons as a', 'a.id', 'w.artist_id')
        .leftJoin('viewing_room_artist_stats as ast', (j) => j.onRef('ast.visitor_id', '=', 's.visitor_id').onRef('ast.artist_id', '=', 'w.artist_id'))
        .selectAll('s')
        .select(['v.room_id', 'w.title', 'w.date_text', 'w.status', 'w.artist_id', 'a.name as artist_name', 'ast.read_ms as artist_read_ms'])
        .select((eb) => eb.selectFrom('work_images as i').select('i.url').whereRef('i.work_id', '=', 'w.id').orderBy('i.position').limit(1).as('image'))
        .where('s.visitor_id', 'in', visitorIds)
        .execute();
    return rows.map((r) => {
        const stat = {
            viewMs: Number(r.view_ms),
            hoverMs: Number(r.hover_ms),
            zoomMs: Number(r.zoom_ms),
            zoomCount: r.zoom_count,
            focusCount: r.focus_count,
            clicks: r.clicks,
            inquiries: r.inquiries,
            visitsSeen: r.visits_seen,
            artistReadMs: Number(r.artist_read_ms ?? 0),
        };
        return {
            workId: r.work_id,
            title: r.title,
            artistId: r.artist_id,
            artistName: r.artist_name,
            dateText: r.date_text,
            image: r.image ?? null,
            status: r.status as WorkStatus,
            ...stat,
            maxZoom: r.max_zoom,
            interest: workInterest(stat),
            lastSeenAt: r.last_seen_at,
            visitorId: r.visitor_id,
            roomId: r.room_id,
        };
    });
}

/** The works a person looked at most across all rooms (their best interest per work), top `limit`. */
export async function topWorksForPerson(db: Q, personId: string, limit = 6): Promise<WorkInterest[]> {
    const visitors = await db.selectFrom('viewing_room_visitors').select('id').where('person_id', '=', personId).execute();
    const all = await workInterests(
        db,
        visitors.map((v) => v.id),
    );
    const best = new Map<string, WorkInterest>();
    for (const w of all) if (w.interest > (best.get(w.workId)?.interest ?? -1)) best.set(w.workId, w);
    return [...best.values()]
        .filter((w) => w.interest > 0)
        .sort((a, b) => b.interest - a.interest)
        .slice(0, limit);
}

export async function roomDashboard(db: Q, roomId: string): Promise<RoomDashboard | null> {
    const room = await summaryRoomQuery(db).where('r.id', '=', roomId).executeTakeFirst();
    if (!room) return null;
    const visitorRows = await visitorQuery(db).where('v.room_id', '=', roomId).orderBy('v.engagement', 'desc').orderBy('v.last_seen_at', 'desc').execute();
    const visitors = visitorRows.map(toVisitorSummary);
    const interests = await workInterests(
        db,
        visitors.map((v) => v.id),
    );
    // Room-wide: totals across visitors; interest is the sum of each visitor's.
    const roomWorks = await summaryQuery(db).innerJoin('viewing_room_works as rw', 'rw.work_id', 'w.id').where('rw.room_id', '=', roomId).orderBy('rw.position').execute();
    const works: WorkInterest[] = roomWorks.map((w) => {
        const its = interests.filter((i) => i.workId === w.id);
        const sum = (k: keyof WorkInterest) => its.reduce((n, i) => n + Number(i[k] ?? 0), 0);
        return {
            workId: w.id,
            title: w.title,
            artistId: w.artist_id,
            artistName: w.artist_name,
            dateText: w.date_text,
            image: w.image_url,
            status: w.status,
            viewMs: sum('viewMs'),
            hoverMs: sum('hoverMs'),
            zoomMs: sum('zoomMs'),
            zoomCount: sum('zoomCount'),
            maxZoom: its.reduce((m, i) => Math.max(m, i.maxZoom), 1),
            focusCount: sum('focusCount'),
            clicks: sum('clicks'),
            inquiries: sum('inquiries'),
            visitsSeen: sum('visitsSeen'),
            interest: sum('interest'),
            lastSeenAt: its.reduce<string | null>((m, i) => (i.lastSeenAt && (!m || i.lastSeenAt > m) ? i.lastSeenAt : m), null),
            viewers: its.filter((i) => i.viewMs >= VIEWED_MS).length,
        };
    });
    works.sort((a, b) => b.interest - a.interest);
    const visits = await db
        .selectFrom('viewing_room_visits as vs')
        .innerJoin('viewing_room_visitors as v', 'v.id', 'vs.visitor_id')
        .select((eb) => eb.fn.countAll<number>().as('n'))
        .where('v.room_id', '=', roomId)
        .executeTakeFirst();
    return {
        room: toRoomSummary(room as never),
        totals: {
            visitors: visitors.length,
            visits: Number(visits?.n ?? 0),
            activeMs: visitors.reduce((n, v) => n + v.activeMs, 0),
            inquiries: visitors.reduce((n, v) => n + v.inquiries, 0),
        },
        visitors,
        works,
    };
}

export async function visitorDashboard(db: DB, roomId: string, visitorId: string): Promise<VisitorDashboard | null> {
    const row = await visitorQuery(db).where('v.id', '=', visitorId).where('v.room_id', '=', roomId).executeTakeFirst();
    if (!row) return null;
    const room = await db.selectFrom('viewing_rooms').select(['id', 'title', 'token']).where('id', '=', roomId).executeTakeFirstOrThrow();
    const [visits, works, artists, events, possibleMatches] = await Promise.all([
        db.selectFrom('viewing_room_visits').selectAll().where('visitor_id', '=', visitorId).orderBy('started_at', 'desc').execute(),
        workInterests(db, [visitorId]),
        db
            .selectFrom('viewing_room_artist_stats as s')
            .innerJoin('persons as p', 'p.id', 's.artist_id')
            .selectAll('s')
            .select('p.name')
            .where('s.visitor_id', '=', visitorId)
            .orderBy('s.read_ms', 'desc')
            .execute(),
        db
            .selectFrom('viewing_room_events as e')
            .innerJoin('viewing_room_visits as vs', 'vs.id', 'e.visit_id')
            .leftJoin('works as w', 'w.id', 'e.work_id')
            .leftJoin('persons as a', 'a.id', 'e.artist_id')
            .select(['e.id', 'e.visit_id', 'e.at', 'e.type', 'e.work_id', 'e.artist_id', 'e.data', 'w.title as work_title', 'a.name as artist_name'])
            .where('vs.visitor_id', '=', visitorId)
            .orderBy('e.at', 'desc')
            .orderBy('e.id', 'desc')
            .limit(500)
            .execute(),
        duplicatesOf(db, row.person_id),
    ]);
    works.sort((a, b) => b.interest - a.interest);
    return {
        visitor: toVisitorSummary(row),
        room,
        visits: visits.map((v): RoomVisit => ({ id: v.id, startedAt: v.started_at, lastActivityAt: v.last_activity_at, activeMs: Number(v.active_ms), userAgent: v.user_agent })),
        works,
        artists: artists.map(
            (a): ArtistInterest => ({ artistId: a.artist_id, name: a.name, readMs: Number(a.read_ms), opens: a.opens, cvOpens: a.cv_opens, pressClicks: a.press_clicks }),
        ),
        events: events.map(
            (e): RoomEvent => ({
                id: Number(e.id),
                visitId: e.visit_id,
                at: e.at,
                type: e.type,
                workId: e.work_id,
                workTitle: e.work_title,
                artistId: e.artist_id,
                artistName: e.artist_name,
                data: e.data,
            }),
        ),
        possibleMatches,
    };
}

// ---------- Public ----------

/** A live room inside its open/close window, by link token. */
export async function liveRoomByToken(db: Q, token: string): Promise<ViewingRoomRow | null> {
    const row = await db
        .selectFrom('viewing_rooms')
        .selectAll()
        .where('token', '=', token)
        .where('status', '=', 'live')
        .where((eb) => eb.or([eb('opens_at', 'is', null), eb('opens_at', '<=', sql<string>`now()`)]))
        .where((eb) => eb.or([eb('closes_at', 'is', null), eb('closes_at', '>', sql<string>`now()`)]))
        .executeTakeFirst();
    return row ?? null;
}

/** Work ids viewers can see in a room (tracking for anything else is refused). */
export async function visibleWorkIds(db: DB, roomId: string): Promise<Set<string>> {
    const r = await sql<{ work_id: string }>`${visibleRoomWorks(roomId)}`.execute(db);
    return new Set(r.rows.map((x) => x.work_id));
}

/** Artists viewers can read about in a room (artists of its visible works). */
export async function visibleArtistIds(db: DB, roomId: string): Promise<Set<string>> {
    const r = await sql<{ artist_id: string }>`SELECT DISTINCT w.artist_id FROM works w WHERE w.id IN (${visibleRoomWorks(roomId)})`.execute(db);
    return new Set(r.rows.map((x) => x.artist_id));
}

/** The room as viewers see it: no inventory numbers, notes, buyers, hidden prices or private person fields. */
export async function publicRoom(db: Q, room: ViewingRoomRow, viewer: { name: string } | null, visitId: string | null): Promise<PublicRoom> {
    const rows = await db
        .selectFrom('viewing_room_works as rw')
        .innerJoin('works as w', 'w.id', 'rw.work_id')
        .innerJoin('persons as a', 'a.id', 'w.artist_id')
        .select(['w.id', 'w.artist_id', 'a.name as artist_name', 'w.title', 'w.date_text', 'w.medium', 'w.dimensions', 'w.edition', 'w.status', 'w.price_cents', 'w.currency', 'rw.show_price'])
        .where('rw.room_id', '=', room.id)
        .where('rw.hidden', '=', false)
        .orderBy('rw.position')
        .execute();
    const visible = rows.filter((w) => !room.hide_unavailable || w.status === 'available');
    const images = visible.length
        ? await db
              .selectFrom('work_images')
              .select(['work_id', 'url', 'alt'])
              .where(
                  'work_id',
                  'in',
                  visible.map((w) => w.id),
              )
              .orderBy('position')
              .execute()
        : [];
    const works: PublicRoomWork[] = visible.map((w) => {
        const available = w.status === 'available';
        const showPrice = available && (w.show_price ?? room.show_prices) && w.price_cents !== null;
        return {
            id: w.id,
            artistId: w.artist_id,
            artistName: w.artist_name,
            title: w.title,
            dateText: w.date_text,
            medium: w.medium,
            dimensions: w.dimensions,
            edition: w.edition,
            images: images.filter((i) => i.work_id === w.id).map((i) => ({ url: i.url, alt: i.alt })),
            available,
            statusLabel: available ? null : UNAVAILABLE_LABELS[w.status as Exclude<WorkStatus, 'available'>],
            price: showPrice ? formatPrice(w.price_cents, w.currency) : null,
        };
    });

    // Artists of the visible works, in the room's artist order.
    const artistIds = new Set(works.map((w) => w.artistId));
    const settings = await db
        .selectFrom('viewing_room_artists as ra')
        .innerJoin('persons as p', 'p.id', 'ra.artist_id')
        .selectAll('ra')
        .select(['p.name', 'p.portrait'])
        .where('ra.room_id', '=', room.id)
        .orderBy('ra.position')
        .execute();
    const artists: PublicRoomArtist[] = [];
    for (const s of settings.filter((s) => artistIds.has(s.artist_id))) {
        const profile = await getArtistProfile(db, s.artist_id);
        const hidden = new Set(s.hidden_press_ids);
        const press = s.show_press ? (profile?.press ?? []).filter((p) => !hidden.has(p.id)) : [];
        artists.push({
            id: s.artist_id,
            name: s.name,
            portrait: s.portrait,
            bioHtml: s.show_bio && profile && !isEmptyDoc(profile.bio) ? richToHtmlServer(profile.bio) : null,
            cvHtml: s.show_cv && profile && !isEmptyDoc(profile.cv) ? richToHtmlServer(profile.cv) : null,
            press: press.length
                ? press.map((p) => ({ id: p.id, outlet: p.outlet, title: p.title, url: p.url, publishedOn: p.publishedOn, issueLabel: p.issueLabel, byline: p.byline }))
                : null,
        });
    }

    return {
        title: room.title,
        subtitle: room.subtitle,
        hasPdf: !room.pdf_hidden && Boolean(await db.selectFrom('viewing_room_pdfs').select('id').where('room_id', '=', room.id).where('withdrawn_at', 'is', null).limit(1).executeTakeFirst()),
        introHtml: isEmptyDoc(room.intro) ? null : richToHtmlServer(room.intro),
        works,
        artists,
        viewer,
        visitId,
    };
}
