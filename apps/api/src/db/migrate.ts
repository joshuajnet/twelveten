import { Migrator, type Migration, type MigrationResultSet } from 'kysely/migration';
import type { DB } from './index.ts';
import * as m0001 from './migrations/0001_initial.ts';

/** Static list (not a filesystem scan) so migrations survive bundling into the Lambda image. */
export const migrations: Record<string, Migration> = {
    '0001_initial': m0001,
};

export function migrator(db: DB): Migrator {
    return new Migrator({
        db,
        provider: { getMigrations: async () => migrations },
    });
}

/** Apply pending migrations. Kysely takes a Postgres advisory lock, so concurrent runs are safe. */
export async function migrateToLatest(db: DB): Promise<MigrationResultSet> {
    const result = await migrator(db).migrateToLatest();
    if (result.error) throw result.error instanceof Error ? result.error : new Error(String(result.error));
    return result;
}
