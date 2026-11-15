import { sql, type Transaction } from 'kysely';
import { MERGE_FIELDS, normalizeEmail, type MergeField } from '@twelveten/shared';
import type { Database, PersonRow } from '../db/types.ts';
import { HttpError } from '../routes/admin/errors.ts';
import { recordRevision } from '../routes/admin/revisions.ts';
import { refreshEngagement } from '../rooms/engagement.ts';

const FIELD_COLUMNS: Record<MergeField, keyof PersonRow> = {
    name: 'name',
    sortName: 'sort_name',
    birthDate: 'birth_date',
    birthPlace: 'birth_place',
    email: 'email',
    phone: 'phone',
    website: 'website',
    portrait: 'portrait',
};

type Trx = Transaction<Database>;

/**
 * Merge `sourceId` into `targetId` and delete the source. Moves addresses, alias emails, purchases
 * and holds, invoices, the collector profile and viewing room visits (combining visits to the same
 * room). Both people's details before the merge are kept in revisions.
 */
export async function mergePersons(
    trx: Trx,
    opts: { sourceId: string; targetId: string; fields: Partial<Record<MergeField, 'source' | 'target'>>; userId: string | null },
): Promise<void> {
    const { sourceId, targetId, userId } = opts;
    if (sourceId === targetId) throw new HttpError(400, 'Pick two different people');
    const [source, target] = await Promise.all(
        [sourceId, targetId].map((id) => trx.selectFrom('persons').selectAll().where('id', '=', id).forUpdate().executeTakeFirst()),
    );
    if (!source || !target) throw new HttpError(404, 'Not found');

    const artist = await trx.selectFrom('artist_profiles').select('person_id').where('person_id', 'in', [sourceId, targetId]).execute();
    if (artist.some((a) => a.person_id === sourceId)) {
        throw new HttpError(
            409,
            artist.length === 2 ? 'Both people are artists; artist profiles can’t be merged' : `${source.name} is an artist: merge ${target.name} into them instead`,
        );
    }

    // ---- Snapshot both, as they were ----
    const sourceAddresses = await trx
        .selectFrom('address_links as l')
        .innerJoin('addresses as a', 'a.id', 'l.address_id')
        .select(['l.label', 'l.is_primary', 'l.position'])
        .select(sql<Record<string, unknown>>`to_jsonb(a)`.as('address'))
        .where('l.entity', '=', 'person')
        .where('l.entity_id', '=', sourceId)
        .execute();
    const sourceCollector = await trx.selectFrom('collector_profiles').selectAll().where('person_id', '=', sourceId).executeTakeFirst();
    await recordRevision(trx, {
        entity: 'person',
        entityId: sourceId,
        action: 'merge',
        snapshot: { ...source, merged_into: targetId, addresses: sourceAddresses, collector_profile: sourceCollector ?? null },
        userId,
    });
    // The kept person's pre-merge details, restorable from their history.
    const baseline = await trx.selectFrom('content_revisions').select('id').where('entity', '=', 'person').where('entity_id', '=', targetId).limit(1).executeTakeFirst();
    if (!baseline) await recordRevision(trx, { entity: 'person', entityId: targetId, action: 'create', snapshot: target, userId: null });

    // ---- Fields ----
    const values: Record<string, unknown> = {};
    for (const f of MERGE_FIELDS) {
        const col = FIELD_COLUMNS[f];
        // The sort name follows the chosen name unless picked explicitly.
        const fallback = f === 'sortName' && opts.fields.name ? opts.fields.name : target[col] ? 'target' : 'source';
        const pick = opts.fields[f] ?? fallback;
        values[col] = pick === 'source' ? source[col] : target[col];
    }
    if (!values.name) values.name = target.name;
    values.notes = [target.notes, source.notes].filter((n) => n && n.trim()).join('\n\n') || null;

    // ---- Emails: every address either person used stays findable ----
    await trx.updateTable('person_emails').set({ person_id: targetId }).where('person_id', '=', sourceId).execute();
    const primary = values.email ? normalizeEmail(String(values.email)) : null;
    for (const e of [source.email, target.email]) {
        if (!e) continue;
        const n = normalizeEmail(e);
        if (n === primary) continue;
        await trx
            .insertInto('person_emails')
            .values({ email: n, person_id: targetId, source: 'merge' })
            .onConflict((oc) => oc.column('email').doUpdateSet({ person_id: targetId }))
            .execute();
    }
    if (primary) await trx.deleteFrom('person_emails').where('email', '=', primary).execute();

    const updated = await trx.updateTable('persons').set(values).where('id', '=', targetId).returningAll().executeTakeFirstOrThrow();

    // ---- Addresses (an identical address already on the kept person is dropped) ----
    const targetLinks = await trx
        .selectFrom('address_links as l')
        .innerJoin('addresses as a', 'a.id', 'l.address_id')
        .select(['l.address_id', 'l.is_primary', 'l.position', 'a.line1', 'a.line2', 'a.city', 'a.region', 'a.postal_code', 'a.country'])
        .where('l.entity', '=', 'person')
        .where('l.entity_id', '=', targetId)
        .execute();
    const key = (a: { line1: string; line2: string | null; city: string | null; region: string | null; postal_code: string | null; country: string }) =>
        [a.line1, a.line2, a.city, a.region, a.postal_code, a.country].map((v) => (v ?? '').trim().toLowerCase()).join('|');
    const have = new Set(targetLinks.map(key));
    const haveIds = new Set(targetLinks.map((l) => l.address_id));
    const hasPrimary = targetLinks.some((l) => l.is_primary);
    let position = targetLinks.reduce((m, l) => Math.max(m, l.position + 1), 0);
    const sourceLinks = await trx
        .selectFrom('address_links as l')
        .innerJoin('addresses as a', 'a.id', 'l.address_id')
        .select(['l.id', 'l.address_id', 'l.is_primary', 'a.line1', 'a.line2', 'a.city', 'a.region', 'a.postal_code', 'a.country'])
        .where('l.entity', '=', 'person')
        .where('l.entity_id', '=', sourceId)
        .orderBy('l.position')
        .execute();
    for (const l of sourceLinks) {
        if (haveIds.has(l.address_id) || have.has(key(l))) {
            await trx.deleteFrom('address_links').where('id', '=', l.id).execute();
            continue;
        }
        await trx
            .updateTable('address_links')
            .set({ entity_id: targetId, position: position++, is_primary: hasPrimary ? false : l.is_primary })
            .where('id', '=', l.id)
            .execute();
        have.add(key(l));
    }

    // ---- Purchases, holds, invoices ----
    await trx.updateTable('works').set({ buyer_id: targetId }).where('buyer_id', '=', sourceId).execute();
    await trx.updateTable('invoices').set({ person_id: targetId }).where('person_id', '=', sourceId).execute();

    // ---- Collector profile ----
    if (sourceCollector) {
        const targetCollector = await trx.selectFrom('collector_profiles').selectAll().where('person_id', '=', targetId).executeTakeFirst();
        if (targetCollector) {
            const notes = [targetCollector.notes, sourceCollector.notes].filter((n) => n && n.trim()).join('\n\n') || null;
            await trx.updateTable('collector_profiles').set({ notes }).where('person_id', '=', targetId).execute();
            await trx.deleteFrom('collector_profiles').where('person_id', '=', sourceId).execute();
        } else {
            await trx.updateTable('collector_profiles').set({ person_id: targetId }).where('person_id', '=', sourceId).execute();
        }
    }

    // ---- Viewing rooms ----
    const sourceVisitors = await trx.selectFrom('viewing_room_visitors').selectAll().where('person_id', '=', sourceId).execute();
    for (const sv of sourceVisitors) {
        const tv = await trx.selectFrom('viewing_room_visitors').selectAll().where('room_id', '=', sv.room_id).where('person_id', '=', targetId).executeTakeFirst();
        if (!tv) {
            await trx.updateTable('viewing_room_visitors').set({ person_id: targetId }).where('id', '=', sv.id).execute();
            continue;
        }
        await combineVisitors(trx, sv.id, tv.id);
    }
    await trx.updateTable('viewing_room_visitors').set({ person_id: targetId }).where('person_id', '=', sourceId).execute();

    await trx.deleteFrom('persons').where('id', '=', sourceId).execute();
    await recordRevision(trx, { entity: 'person', entityId: targetId, action: 'update', snapshot: updated, userId });
}

/** Fold one room visitor into another (same room): cookies, visits, stats and pointer samples. */
async function combineVisitors(trx: Trx, fromId: string, intoId: string): Promise<void> {
    await trx.updateTable('viewing_room_cookies').set({ visitor_id: intoId }).where('visitor_id', '=', fromId).execute();
    await trx.updateTable('viewing_room_visits').set({ visitor_id: intoId }).where('visitor_id', '=', fromId).execute();
    await trx.updateTable('viewing_room_pointer').set({ visitor_id: intoId }).where('visitor_id', '=', fromId).execute();
    await sql`
INSERT INTO viewing_room_work_stats AS t (visitor_id, work_id, view_ms, hover_ms, zoom_ms, focus_count, zoom_count, max_zoom, clicks, inquiries, visits_seen, last_visit_id, last_seen_at)
SELECT ${intoId}, work_id, view_ms, hover_ms, zoom_ms, focus_count, zoom_count, max_zoom, clicks, inquiries, visits_seen, last_visit_id, last_seen_at
FROM viewing_room_work_stats WHERE visitor_id = ${fromId}
ON CONFLICT (visitor_id, work_id) DO UPDATE SET
  view_ms = t.view_ms + excluded.view_ms, hover_ms = t.hover_ms + excluded.hover_ms, zoom_ms = t.zoom_ms + excluded.zoom_ms,
  focus_count = t.focus_count + excluded.focus_count, zoom_count = t.zoom_count + excluded.zoom_count,
  max_zoom = greatest(t.max_zoom, excluded.max_zoom), clicks = t.clicks + excluded.clicks, inquiries = t.inquiries + excluded.inquiries,
  visits_seen = t.visits_seen + excluded.visits_seen,
  last_visit_id = CASE WHEN excluded.last_seen_at > t.last_seen_at THEN excluded.last_visit_id ELSE t.last_visit_id END,
  last_seen_at = greatest(t.last_seen_at, excluded.last_seen_at)`.execute(trx);
    await sql`
INSERT INTO viewing_room_artist_stats AS t (visitor_id, artist_id, read_ms, opens, cv_opens, press_clicks)
SELECT ${intoId}, artist_id, read_ms, opens, cv_opens, press_clicks FROM viewing_room_artist_stats WHERE visitor_id = ${fromId}
ON CONFLICT (visitor_id, artist_id) DO UPDATE SET
  read_ms = t.read_ms + excluded.read_ms, opens = t.opens + excluded.opens,
  cv_opens = t.cv_opens + excluded.cv_opens, press_clicks = t.press_clicks + excluded.press_clicks`.execute(trx);
    await sql`
UPDATE viewing_room_visitors t SET
  visit_count = t.visit_count + f.visit_count, active_ms = t.active_ms + f.active_ms,
  first_seen_at = least(t.first_seen_at, f.first_seen_at), last_seen_at = greatest(t.last_seen_at, f.last_seen_at)
FROM viewing_room_visitors f WHERE t.id = ${intoId} AND f.id = ${fromId}`.execute(trx);
    await trx.deleteFrom('viewing_room_visitors').where('id', '=', fromId).execute();
    await refreshEngagement(trx, intoId);
}
