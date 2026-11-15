import { sql } from 'kysely';
import type { DB } from './index.ts';

/** `seed_state` key recorded by an import; a second import is refused unless forced. */
export const IMPORT_KEY = 'data-import';

/**
 * Whole-database copy between environments (`npm run data:push`): every public table as JSON rows,
 * except migration bookkeeping and sign-in state. Users come across (other rows reference them),
 * but not their passwords or sessions, so the target's admins are created there.
 */
export const SKIPPED_TABLES = ['kysely_migration', 'kysely_migration_lock', 'account', 'session', 'verification', 'rateLimit'];

export interface DataDump {
    /** Latest migration applied to the source; the target must match. */
    migration: string;
    exportedAt: string;
    tables: Record<string, unknown[]>;
}

async function latestMigration(db: DB): Promise<string> {
    const r = await sql<{ name: string }>`select name from kysely_migration order by name desc limit 1`.execute(db);
    return r.rows[0]?.name ?? '';
}

async function publicTables(db: DB): Promise<string[]> {
    const r = await sql<{ tablename: string }>`select tablename from pg_tables where schemaname = 'public' order by tablename`.execute(db);
    return r.rows.map((t) => t.tablename);
}

export async function exportData(db: DB): Promise<DataDump> {
    const tables: Record<string, unknown[]> = {};
    for (const name of await publicTables(db)) {
        if (SKIPPED_TABLES.includes(name)) continue;
        const r = await sql<{ rows: unknown[] }>`select coalesce(json_agg(t), '[]'::json) as rows from ${sql.table(name)} t`.execute(db);
        tables[name] = r.rows[0]!.rows;
    }
    return { migration: await latestMigration(db), exportedAt: new Date().toISOString(), tables };
}

/**
 * Replaces the target's data with the dump in one transaction. Triggers and foreign-key checks are
 * paused (session_replication_role = replica), so rows load in any order with their values as-is.
 */
export async function importData(db: DB, dump: DataDump, { force = false } = {}): Promise<Record<string, number>> {
    const done = await sql<{ at: string }>`select applied_at::text as at from seed_state where key = ${IMPORT_KEY}`.execute(db);
    if (done.rows[0] && !force) throw new Error(`Data was already imported (${done.rows[0].at}); refusing to replace it. Use --force to replace it anyway.`);
    const target = await latestMigration(db);
    if (dump.migration !== target) throw new Error(`Schema mismatch: dump is at ${dump.migration}, target is at ${target}. Migrate both to the same version first.`);
    const existing = await publicTables(db);
    const unknown = Object.keys(dump.tables).filter((t) => !existing.includes(t));
    if (unknown.length) throw new Error(`Target has no table(s): ${unknown.join(', ')}`);

    return db.transaction().execute(async (trx) => {
        await sql`set local session_replication_role = replica`.execute(trx);
        const wipe = existing.filter((t) => !t.startsWith('kysely_migration'));
        await sql`truncate ${sql.join(wipe.map((t) => sql.table(t)))}`.execute(trx);
        const counts: Record<string, number> = {};
        for (const [name, rows] of Object.entries(dump.tables)) {
            if (rows.length) {
                await sql`insert into ${sql.table(name)} overriding system value select * from json_populate_recordset(null::${sql.table(name)}, ${JSON.stringify(rows)}::json)`.execute(trx);
            }
            counts[name] = rows.length;
        }
        // Identity columns: continue numbering after the copied rows.
        const identities = await sql<{ table_name: string; column_name: string }>`
            select table_name, column_name from information_schema.columns where table_schema = 'public' and is_identity = 'YES'`.execute(trx);
        for (const { table_name: t, column_name: c } of identities.rows) {
            await sql`select setval(pg_get_serial_sequence(${`"${t}"`}, ${c}), coalesce((select max(${sql.ref(c)}) from ${sql.table(t)}), 0) + 1, false)`.execute(trx);
        }
        await sql`insert into seed_state (key) values (${IMPORT_KEY}) on conflict (key) do update set applied_at = now()`.execute(trx);
        return counts;
    });
}
