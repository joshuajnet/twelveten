import { sql, type RawBuilder, type Transaction } from 'kysely';
import { engagementScore, VIEWED_MS } from '@twelveten/shared';
import type { DB } from '../db/index.ts';
import type { Database } from '../db/types.ts';

type Exec = Transaction<Database> | DB;

/** Works viewers of a room can see: not hidden, and available when the room hides unavailable works. */
export const visibleRoomWorks = (roomId: string | RawBuilder<unknown>) => sql`
SELECT rw.work_id FROM viewing_room_works rw
JOIN viewing_rooms r ON r.id = rw.room_id
JOIN works w ON w.id = rw.work_id
WHERE rw.room_id = ${roomId} AND NOT rw.hidden AND (NOT r.hide_unavailable OR w.status = 'available')`;

/** Recompute and store a visitor's engagement score from their totals and per-work stats. */
export async function refreshEngagement(db: Exec, visitorId: string): Promise<number> {
    const r = await sql<{
        room_id: string;
        active_ms: number;
        visit_count: number;
        works_total: number;
        works_viewed: number;
        zooms: number;
        focus: number;
        inquiries: number;
        max_view: number;
        read_ms: number;
        cv_opens: number;
        press_clicks: number;
    }>`
SELECT v.room_id, v.active_ms, v.visit_count,
  (SELECT count(*) FROM (${visibleRoomWorks(sql`v.room_id`)}) vw)::int AS works_total,
  coalesce(s.works_viewed, 0)::int AS works_viewed, coalesce(s.zooms, 0)::int AS zooms, coalesce(s.focus, 0)::int AS focus,
  coalesce(s.inquiries, 0)::int AS inquiries, coalesce(s.max_view, 0)::bigint AS max_view,
  coalesce(a.read_ms, 0)::bigint AS read_ms, coalesce(a.cv_opens, 0)::int AS cv_opens, coalesce(a.press_clicks, 0)::int AS press_clicks
FROM viewing_room_visitors v
LEFT JOIN LATERAL (
  SELECT count(*) FILTER (WHERE view_ms >= ${VIEWED_MS}) AS works_viewed, sum(zoom_count) AS zooms, sum(focus_count) AS focus,
         sum(inquiries) AS inquiries, max(view_ms) AS max_view
  FROM viewing_room_work_stats WHERE visitor_id = v.id
) s ON true
LEFT JOIN LATERAL (
  SELECT sum(read_ms) AS read_ms, sum(cv_opens) AS cv_opens, sum(press_clicks) AS press_clicks
  FROM viewing_room_artist_stats WHERE visitor_id = v.id
) a ON true
WHERE v.id = ${visitorId}`.execute(db);
    const row = r.rows[0];
    if (!row) return 0;
    const score = engagementScore({
        activeMs: Number(row.active_ms),
        visits: Number(row.visit_count),
        worksTotal: Number(row.works_total),
        worksViewed: Number(row.works_viewed),
        zooms: Number(row.zooms),
        focusCount: Number(row.focus),
        inquiries: Number(row.inquiries),
        maxWorkViewMs: Number(row.max_view),
        artistReadMs: Number(row.read_ms),
        cvOpens: Number(row.cv_opens),
        pressClicks: Number(row.press_clicks),
    });
    await db.updateTable('viewing_room_visitors').set({ engagement: score }).where('id', '=', visitorId).execute();
    return score;
}
