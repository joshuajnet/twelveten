import type { Transaction } from 'kysely';
import { v7 as uuidv7 } from 'uuid';
import type { Database, RevisionEntity } from '../../db/types.ts';

export async function recordRevision(
    trx: Transaction<Database>,
    rev: { entity: RevisionEntity; entityId: string | null; action: 'create' | 'update' | 'delete' | 'restore'; snapshot: unknown; userId: string | null },
) {
    await trx
        .insertInto('content_revisions')
        .values({
            // Time-ordered ids keep revisions written in one transaction in order.
            id: uuidv7(),
            entity: rev.entity,
            entity_id: rev.entityId,
            action: rev.action,
            snapshot: JSON.stringify(rev.snapshot),
            user_id: rev.userId,
        })
        .execute();
}

/**
 * Items that have never been edited (e.g. seeded content) have no history yet. Before their first
 * change, store the current state so the original version can always be restored.
 */
export async function ensureBaseline(
    trx: Transaction<Database>,
    entity: RevisionEntity,
    entityId: string | null,
    loadCurrent: () => Promise<unknown>,
) {
    let q = trx.selectFrom('content_revisions').select('id').where('entity', '=', entity).limit(1);
    q = entityId ? q.where('entity_id', '=', entityId) : q.where('entity_id', 'is', null);
    if (await q.executeTakeFirst()) return;
    const current = await loadCurrent();
    if (current) await recordRevision(trx, { entity, entityId, action: 'create', snapshot: current, userId: null });
}
