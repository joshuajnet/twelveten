import { readFileSync } from 'node:fs';
import pg from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import type { Database } from './types.ts';
import { config } from '../config.ts';

// Return DATE columns as 'YYYY-MM-DD' strings (no timezone shifting) and
// TIMESTAMPTZ as ISO strings so API payloads are stable.
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (v) => new Date(v).toISOString());
// BIGINT (prices in cents, counts) as numbers; every value we store is far below 2^53.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (v) => new Date(`${v}Z`).toISOString());

export type DB = Kysely<Database>;

export function createDb(connectionString = config().DATABASE_URL, max = config().DATABASE_POOL_MAX): DB {
    const pool = new pg.Pool({
        connectionString,
        max,
        ssl: config().DATABASE_SSL
            ? { rejectUnauthorized: true, ca: config().DATABASE_SSL_CA_FILE ? readFileSync(config().DATABASE_SSL_CA_FILE!, 'utf8') : undefined }
            : undefined,
        idleTimeoutMillis: 30_000,
    });
    return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}

let shared: DB | undefined;

/** Process-wide instance (reused across warm Lambda invocations). */
export function db(): DB {
    shared ??= createDb();
    return shared;
}

export async function closeDb(): Promise<void> {
    await shared?.destroy();
    shared = undefined;
}
