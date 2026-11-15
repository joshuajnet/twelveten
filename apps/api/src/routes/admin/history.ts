import { Hono } from 'hono';
import type { Transaction } from 'kysely';
import { exhibitionPath, newsPath, revisionEntity, type RevisionSummary } from '@twelveten/shared';
import type { AppEnv } from '../../env.ts';
import type { Database } from '../../db/types.ts';
import { HttpError } from './errors.ts';
import { recordRevision } from './revisions.ts';
import { recordWorkChanges } from './inventory.ts';
import { exhibitionPages } from './exhibitions.ts';
import { pressPages } from './site.ts';
import { idParam, nextPosition, type Publish } from './util.ts';

/** How each kind of deleted item is described in the "Recently deleted" list. */
const DELETED_DETAIL = {
    exhibition: (s: { kind?: string }) => (s.kind === 'fair' ? 'Fair' : 'Exhibition'),
    news_post: () => 'News post',
    press_item: (s: { outlet?: string }) => `Press · ${s.outlet ?? ''}`,
    person: () => 'Person',
    work: () => 'Work',
};

/**
 * A deleted person's collector profile and addresses (both removed with them; see the person delete
 * snapshot). Addresses still shared with someone else are linked again rather than copied.
 */
async function restorePersonExtras(trx: Transaction<Database>, personId: string, snap: Record<string, unknown>) {
    const collector = snap.collector_profile as { notes: string | null } | null | undefined;
    if (collector) {
        await trx.insertInto('collector_profiles').values({ person_id: personId, notes: collector.notes }).onConflict((oc) => oc.column('person_id').doNothing()).execute();
    }
    const links = (snap.addresses as { label: string | null; is_primary: boolean; position: number; address: Record<string, unknown> }[] | undefined) ?? [];
    for (const link of links) {
        const { created_at: _c, updated_at: _u, ...address } = link.address;
        await trx.insertInto('addresses').values(address as never).onConflict((oc) => oc.column('id').doNothing()).execute();
        await trx
            .insertInto('address_links')
            .values({ address_id: String(address.id), entity: 'person', entity_id: personId, label: link.label, is_primary: link.is_primary, position: link.position })
            .execute();
    }
}

/** Revision history, the "Recently deleted" list, and restoring either. */
export function historyRoutes({ publish }: { publish: Publish }) {
    const app = new Hono<AppEnv>();

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
            .where('r.entity', 'in', ['exhibition', 'news_post', 'press_item', 'person', 'work'])
            .where(({ not, exists, selectFrom }) =>
                not(
                    exists(
                        selectFrom('content_revisions as later')
                            .select('later.id')
                            .whereRef('later.entity', '=', 'r.entity')
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
            const snap = r.snapshot as { title?: string; name?: string; kind?: string; outlet?: string };
            return {
                revisionId: r.id,
                entity: r.entity,
                entityId: r.entity_id,
                title: (r.entity === 'person' ? snap.name : snap.title) || '(untitled)',
                detail: DELETED_DETAIL[r.entity as keyof typeof DELETED_DETAIL]?.(snap) ?? r.entity,
                deletedAt: r.created_at,
                userName: r.user_name,
            };
        });
        return c.json({ items });
    });

    app.post('/revisions/:id/restore', async (c) => {
        const db = c.var.db;
        const rev = await db.selectFrom('content_revisions').selectAll().where('id', '=', idParam(c)).executeTakeFirst();
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
                        row.position = await nextPosition(trx, 'artworks', { exhibition_id: String(snap.exhibition_id) });
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
                    const row = strip(snap, ['artist_ids']);
                    if (row.exhibition_id && !(await trx.selectFrom('exhibitions').select('id').where('id', '=', String(row.exhibition_id)).executeTakeFirst())) {
                        row.exhibition_id = null;
                    }
                    await trx.insertInto('press_items').values(row as never).onConflict((oc) => oc.column('id').doUpdateSet(row as never)).execute();
                    // Deleting press dropped its artist links; bring back those whose artist profile still exists.
                    const artistIds = ((snap.artist_ids as string[] | undefined) ?? []).filter(Boolean);
                    const live = artistIds.length ? await trx.selectFrom('artist_profiles').select('person_id').where('person_id', 'in', artistIds).execute() : [];
                    for (const { person_id } of live) {
                        await trx
                            .insertInto('press_artists')
                            .values({ press_item_id: String(snap.id), artist_id: person_id })
                            .onConflict((oc) => oc.columns(['press_item_id', 'artist_id']).doNothing())
                            .execute();
                    }
                    pages.push(...(await pressPages(trx, [row.exhibition_id as string | null])));
                    break;
                }
                case 'home_page': {
                    const row = strip(snap);
                    await trx.updateTable('home_page').set(row as never).where('id', '=', 1).execute();
                    pages.push('/');
                    break;
                }
                case 'person': {
                    const row = strip(snap, ['addresses', 'collector_profile']);
                    await trx.insertInto('persons').values(row as never).onConflict((oc) => oc.column('id').doUpdateSet(row as never)).execute();
                    if (rev.action === 'delete') await restorePersonExtras(trx, String(snap.id), snap);
                    break;
                }
                case 'artist_profile': {
                    const row = strip(snap, ['exhibition_ids', 'exhibitions', 'press_ids']);
                    if (!(await trx.selectFrom('persons').select('id').where('id', '=', String(snap.person_id)).executeTakeFirst())) {
                        throw new HttpError(409, 'Restore the person first');
                    }
                    await trx.insertInto('artist_profiles').values(row as never).onConflict((oc) => oc.column('person_id').doUpdateSet(row as never)).execute();
                    // Newer snapshots carry each exhibition's position for the artist; older ones only the ids.
                    const links =
                        (snap.exhibitions as { exhibition_id: string; position: number }[] | undefined) ??
                        ((snap.exhibition_ids as string[] | undefined) ?? []).map((exhibition_id) => ({ exhibition_id, position: null }));
                    const ids = links.map((l) => l.exhibition_id).filter(Boolean);
                    const existing = ids.length ? (await trx.selectFrom('exhibitions').select('id').where('id', 'in', ids).execute()).map((r) => r.id) : [];
                    await trx.deleteFrom('exhibition_artists').where('artist_id', '=', String(snap.person_id)).execute();
                    for (const link of links.filter((l) => existing.includes(l.exhibition_id))) {
                        const position = link.position ?? (await nextPosition(trx, 'exhibition_artists', { exhibition_id: link.exhibition_id }));
                        await trx.insertInto('exhibition_artists').values({ exhibition_id: link.exhibition_id, artist_id: String(snap.person_id), position }).execute();
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

    return app;
}
