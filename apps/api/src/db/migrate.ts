import { Migrator, type Migration, type MigrationResultSet } from 'kysely/migration';
import type { DB } from './index.ts';
import * as m0001 from './migrations/0001_initial.ts';
import * as m0002 from './migrations/0002_people_inventory.ts';
import * as m0003 from './migrations/0003_collectors_invoices.ts';
import * as m0004 from './migrations/0004_inventory_numbers.ts';
import * as m0005 from './migrations/0005_press_artists.ts';
import * as m0006 from './migrations/0006_viewing_rooms.ts';
import * as m0007 from './migrations/0007_inquiries.ts';
import * as m0008 from './migrations/0008_room_pdf.ts';

/** Static list (not a filesystem scan) so migrations survive bundling into the Lambda image. */
export const migrations: Record<string, Migration> = {
    '0001_initial': m0001,
    '0002_people_inventory': m0002,
    '0003_collectors_invoices': m0003,
    '0004_inventory_numbers': m0004,
    '0005_press_artists': m0005,
    '0006_viewing_rooms': m0006,
    '0007_inquiries': m0007,
    '0008_room_pdf': m0008,
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
