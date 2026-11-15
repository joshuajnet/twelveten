import { randomBytes } from 'node:crypto';
import { upsertAdmin } from './auth/users.ts';
import { closeDb, db } from './db/index.ts';
import { migrateToLatest } from './db/migrate.ts';
import { seed } from './db/seed.ts';

interface MigrateEvent {
    /** Load the original site content (skipped once applied). */
    seed?: boolean;
    /** Create or reset an admin; the generated password is returned once. */
    admin?: { email: string; name?: string };
}

/**
 * Lambda: apply pending migrations, then optionally seed and create an admin. Safe to run repeatedly.
 *   osls invoke -f migrate -d '{"seed":true}'
 *   osls invoke -f migrate -d '{"admin":{"email":"you@example.com","name":"You"}}'
 */
export async function handler(event: MigrateEvent | null = {}) {
    try {
        const { results } = await migrateToLatest(db());
        const out: Record<string, unknown> = { ok: true, applied: (results ?? []).map((r) => `${r.status}: ${r.migrationName}`) };
        if (event?.seed) {
            const r = await seed(db(), {});
            out.seed = r.skipped ? 'already applied' : { exhibitions: r.exhibitions, slides: r.artworks, press: r.press, news: r.news };
        }
        if (event?.admin?.email) {
            const password = randomBytes(12).toString('base64url');
            const { created } = await upsertAdmin(db(), { email: event.admin.email, password, name: event.admin.name });
            out.admin = { email: event.admin.email, created, password };
        }
        return out;
    } finally {
        await closeDb();
    }
}
