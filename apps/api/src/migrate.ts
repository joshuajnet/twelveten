import { closeDb, db } from './db/index.ts';
import { migrateToLatest } from './db/migrate.ts';

/** Lambda: apply pending migrations (`sls invoke -f migrate`). Safe to run repeatedly. */
export async function handler() {
    try {
        const { results } = await migrateToLatest(db());
        return { ok: true, applied: (results ?? []).map((r) => `${r.status}: ${r.migrationName}`) };
    } finally {
        await closeDb();
    }
}
