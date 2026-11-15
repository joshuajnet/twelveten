import { sql } from 'kysely';
import { slugify } from '@twelveten/shared';
import type { Transaction } from 'kysely';
import type { DB } from '../../db/index.ts';
import type { Database } from '../../db/types.ts';
import { HttpError } from './errors.ts';

/** Build a column → value map from a patch, skipping keys that weren't sent. */
export function columns<P extends Record<string, unknown>>(patch: P, map: Partial<Record<keyof P, string>>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, column] of Object.entries(map)) {
        if (column && key in patch && patch[key] !== undefined) out[column] = patch[key];
    }
    return out;
}

type SlugTable = 'exhibitions' | 'news_posts' | 'artist_profiles';

/** A slug based on `base` that isn't used yet in `table`. */
export async function uniqueSlug(db: DB, table: SlugTable, base: string, exceptId?: string): Promise<string> {
    const root = slugify(base);
    const idColumn = table === 'artist_profiles' ? 'person_id' : 'id';
    for (let n = 1; n < 1000; n++) {
        const candidate = n === 1 ? root : `${root}-${n}`;
        let q = db.selectFrom(table).select(sql<string>`1`.as('one')).where('slug', '=', candidate);
        if (exceptId) q = q.where(sql.ref(idColumn), '!=', exceptId);
        if (!(await q.executeTakeFirst())) return candidate;
    }
    throw new HttpError(409, 'Could not find a free slug');
}

/**
 * Optimistic-lock check. Postgres keeps microseconds but clients only see milliseconds,
 * so compare at millisecond precision.
 */
export const sameVersion = (version: string) => sql<boolean>`date_trunc('milliseconds', updated_at) = ${version}::timestamptz`;

/** Throw 409 (with the current server copy) or 404 when an optimistic update matched nothing. */
export async function conflictOr404(exists: boolean, current: () => Promise<unknown>): Promise<never> {
    if (!exists) throw new HttpError(404, 'Not found');
    throw new HttpError(409, 'This was changed by someone else since you opened it', { current: await current() });
}

/** Postgres rejects malformed uuids with an error; treat them as "not found" instead. */
export function isUuid(v: string | undefined | null): v is string {
    return Boolean(v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v));
}

/** Give a person a collector profile if they don't have one (buying or holding a work makes them a collector). */
export async function ensureCollectorProfile(trx: Transaction<Database> | DB, personId: string): Promise<void> {
    await trx.insertInto('collector_profiles').values({ person_id: personId }).onConflict((oc) => oc.column('person_id').doNothing()).execute();
}

type Exec = Transaction<Database> | DB;

/** `?page=&limit=` for numbered lists, validated (limit 1–100). */
export function pageParams(c: { req: { query: (k: string) => string | undefined } }, defaultSize: number): { page: number; pageSize: number } {
    const page = Number(c.req.query('page') ?? 1);
    const pageSize = Number(c.req.query('limit') ?? defaultSize);
    if (!Number.isInteger(page) || page < 1) throw new HttpError(400, 'Invalid page');
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new HttpError(400, 'limit must be 1–100');
    return { page, pageSize };
}

/** Load something by uuid or answer 404 (malformed ids included). */
export async function findOr404<T>(load: (id: string) => Promise<T | null | undefined>, id: string | undefined): Promise<T> {
    const found = isUuid(id) ? await load(id) : null;
    if (!found) throw new HttpError(404, 'Not found');
    return found;
}

/** Tables whose rows keep a 0..n-1 `position` within a scope (e.g. a work's images). */
type PositionedTable = 'artworks' | 'work_images' | 'invoice_items' | 'address_links' | 'exhibition_artists';

const whereScope = (scope: Record<string, string>) =>
    sql.join(
        Object.entries(scope).map(([column, value]) => sql`${sql.ref(column)} = ${value}`),
        sql` AND `,
    );

/** The position after the last row in the scope. */
export async function nextPosition(db: Exec, table: PositionedTable, scope: Record<string, string>): Promise<number> {
    const { rows } = await sql<{ max: number | null }>`SELECT max(position) AS max FROM ${sql.table(table)} WHERE ${whereScope(scope)}`.execute(db);
    return Number(rows[0]?.max ?? -1) + 1;
}

/** After removing the row at `position`, move the later ones up so positions stay 0..n-1. */
export async function closeGap(trx: Exec, table: PositionedTable, scope: Record<string, string>, position: number): Promise<void> {
    await sql`UPDATE ${sql.table(table)} SET position = position - 1 WHERE ${whereScope(scope)} AND position > ${position}`.execute(trx);
}

/**
 * Set positions from `ids`, which must list every row in the scope exactly once. The position
 * uniqueness constraints are deferred, so swaps are fine inside the transaction.
 */
export async function reorder(trx: Transaction<Database>, table: 'artworks' | 'work_images', scope: Record<string, string>, ids: string[], what: string): Promise<void> {
    const { rows } = await sql<{ id: string }>`SELECT id FROM ${sql.table(table)} WHERE ${whereScope(scope)}`.execute(trx);
    const known = new Set(rows.map((r) => r.id));
    if (ids.length !== known.size || new Set(ids).size !== ids.length || ids.some((x) => !known.has(x))) {
        throw new HttpError(400, `The order must list every ${what} exactly once`);
    }
    for (const [position, id] of ids.entries()) await sql`UPDATE ${sql.table(table)} SET position = ${position} WHERE id = ${id}`.execute(trx);
}

/** Bump `updated_at` (the version clients send back) after changing a row's children. */
export async function touch(trx: Exec, table: 'works' | 'invoices' | 'artist_profiles' | 'exhibitions', id: string): Promise<void> {
    const key = table === 'artist_profiles' ? 'person_id' : 'id';
    await sql`UPDATE ${sql.table(table)} SET updated_at = now() WHERE ${sql.ref(key)} = ${id}`.execute(trx);
}

/** A PDF download (or inline view) that is never cached. */
export function pdfResponse(c: { body: (data: Uint8Array, status: 200, headers: Record<string, string>) => Response }, pdf: Uint8Array | Buffer, filename: string, inline = false): Response {
    return c.body(new Uint8Array(pdf), 200, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename.replace(/["\\\r\n]/g, '')}"`,
        'Cache-Control': 'private, no-store',
    });
}

/** A uuid route parameter; anything else is a 404 (rather than a Postgres "invalid input" 400). */
export function idParam(c: { req: { param: (name: string) => string | undefined } }, name = 'id'): string {
    const v = c.req.param(name);
    if (!isUuid(v)) throw new HttpError(404, 'Not found');
    return v;
}

/** Re-render public pages after a change (failures are logged; the next save or a rebuild retries). */
export type Publish = (paths: string[]) => Promise<void>;
