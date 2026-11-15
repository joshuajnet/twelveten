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
