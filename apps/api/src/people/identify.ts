import { sql, type Transaction } from 'kysely';
import { normalizeEmail } from '@twelveten/shared';
import type { Database } from '../db/types.ts';
import { recordRevision } from '../routes/admin/revisions.ts';
import { ensureCollectorProfile } from '../routes/admin/util.ts';

export type IdentityMatch = 'email' | 'alias' | 'new';

/**
 * The person behind a name and email typed on the public site (a viewing room gate or an inquiry).
 * Nothing is verified: the same email (main or other) is the same person; otherwise a new person is
 * created with a note saying where they came from. Either way they get a collector profile.
 */
export async function identifyPerson(
    trx: Transaction<Database>,
    input: { name: string; email: string; createdFrom: string },
): Promise<{ personId: string; match: IdentityMatch }> {
    const email = normalizeEmail(input.email);
    const byEmail = await trx
        .selectFrom('persons')
        .select('id')
        .where(sql<string>`lower(btrim(email))`, '=', email)
        .orderBy('created_at')
        .limit(1)
        .executeTakeFirst();
    let personId = byEmail?.id;
    let match: IdentityMatch = 'email';
    if (!personId) {
        personId = (await trx.selectFrom('person_emails').select('person_id').where('email', '=', email).executeTakeFirst())?.person_id;
        match = 'alias';
    }
    if (!personId) {
        const created = await trx
            .insertInto('persons')
            .values({ name: input.name, email, notes: `Created from ${input.createdFrom}` })
            .returningAll()
            .executeTakeFirstOrThrow();
        await recordRevision(trx, { entity: 'person', entityId: created.id, action: 'create', snapshot: created, userId: null });
        personId = created.id;
        match = 'new';
    }
    await ensureCollectorProfile(trx, personId);
    return { personId, match };
}
