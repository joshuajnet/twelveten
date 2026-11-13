import type { Transaction } from 'kysely';
import type { Database, RevisionEntity } from '../../db/types.ts';

export async function recordRevision(
    trx: Transaction<Database>,
    rev: { entity: RevisionEntity; entityId: string | null; action: 'create' | 'update' | 'delete' | 'restore'; snapshot: unknown; userId: string | null },
) {
    await trx
        .insertInto('content_revisions')
        .values({
            entity: rev.entity,
            entity_id: rev.entityId,
            action: rev.action,
            snapshot: JSON.stringify(rev.snapshot),
            user_id: rev.userId,
        })
        .execute();
}
