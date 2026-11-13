import { hashPassword } from 'better-auth/crypto';
import { v7 as uuidv7 } from 'uuid';
import type { DB } from '../db/index.ts';
import { sql } from 'kysely';

/**
 * Create (or update) an admin account directly in the database, in the same format
 * Better Auth uses for email/password ("credential") accounts.
 */
export async function upsertAdmin(db: DB, input: { email: string; password: string; name?: string }): Promise<{ id: string; created: boolean }> {
    const email = input.email.trim().toLowerCase();
    if (input.password.length < 12) throw new Error('Password must be at least 12 characters');
    const hash = await hashPassword(input.password);
    return db.transaction().execute(async (trx) => {
        const existing = await sql<{ id: string }>`SELECT id FROM "user" WHERE email = ${email}`.execute(trx);
        const now = new Date();
        if (existing.rows[0]) {
            const id = existing.rows[0].id;
            await sql`UPDATE "user" SET role = 'admin', banned = false, "updatedAt" = ${now} WHERE id = ${id}`.execute(trx);
            const updated = await sql`UPDATE account SET password = ${hash}, "updatedAt" = ${now} WHERE "userId" = ${id} AND "providerId" = 'credential'`.execute(trx);
            if (!Number(updated.numAffectedRows ?? 0)) {
                await sql`INSERT INTO account (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
                          VALUES (${uuidv7()}, ${id}, ${id}, 'credential', ${hash}, ${now}, ${now})`.execute(trx);
            }
            return { id, created: false };
        }
        const id = uuidv7();
        await sql`INSERT INTO "user" (id, name, email, "emailVerified", role, "createdAt", "updatedAt")
                  VALUES (${id}, ${input.name ?? email.split('@')[0]}, ${email}, true, 'admin', ${now}, ${now})`.execute(trx);
        await sql`INSERT INTO account (id, "userId", "accountId", "providerId", password, "createdAt", "updatedAt")
                  VALUES (${uuidv7()}, ${id}, ${id}, 'credential', ${hash}, ${now}, ${now})`.execute(trx);
        return { id, created: true };
    });
}
