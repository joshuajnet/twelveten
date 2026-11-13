import { sql } from 'kysely';
import { createDb, type DB } from '../src/db/index.ts';

/** Fresh connection to the test database. */
export function testDb(): DB {
    return createDb(process.env.DATABASE_URL!, 2);
}

/** Drop everything in the public schema (including Kysely's bookkeeping tables). */
export async function resetSchema(db: DB): Promise<void> {
    await sql`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`.execute(db);
}

/** Canonical description of the schema, for comparing two migration runs. */
export async function schemaSnapshot(db: DB): Promise<string> {
    const columns = await sql<{ line: string }>`
        SELECT table_name || '.' || column_name || ':' || data_type || ':' || is_nullable || ':' || coalesce(column_default, '') AS line
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name NOT LIKE 'kysely_%'
        ORDER BY table_name, column_name`.execute(db);
    const constraints = await sql<{ line: string }>`
        SELECT conrelid::regclass || ':' || conname || ':' || pg_get_constraintdef(oid) AS line
        FROM pg_constraint WHERE connamespace = 'public'::regnamespace
        ORDER BY 1`.execute(db);
    const indexes = await sql<{ line: string }>`
        SELECT indexdef AS line FROM pg_indexes
        WHERE schemaname = 'public' AND tablename NOT LIKE 'kysely_%' ORDER BY indexname`.execute(db);
    const triggers = await sql<{ line: string }>`
        SELECT event_object_table || ':' || trigger_name || ':' || event_manipulation AS line
        FROM information_schema.triggers WHERE trigger_schema = 'public' ORDER BY 1`.execute(db);
    return [...columns.rows, ...constraints.rows, ...indexes.rows, ...triggers.rows].map((r) => r.line).join('\n');
}
