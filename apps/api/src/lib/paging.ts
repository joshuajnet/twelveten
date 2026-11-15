import { sql, type SelectQueryBuilder } from 'kysely';
import type { NumberedPage } from '@twelveten/shared';

/** `%text%` for ILIKE, with the user's %, _ and \ matched literally. */
export const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

/**
 * One numbered page of a list query, with the total number of matches. `query` must not be
 * limited yet; its rows are mapped with `map`.
 */
export async function numberedPage<DB, TB extends keyof DB, O, T>(
    query: SelectQueryBuilder<DB, TB, O>,
    page: number,
    pageSize: number,
    map: (row: O) => T,
): Promise<NumberedPage<T>> {
    const q = query.select(sql<number>`count(*) over ()`.as('total'));
    const rows = (await q.limit(pageSize).offset((page - 1) * pageSize).execute()) as unknown as (O & { total: number })[];
    let total = Number(rows[0]?.total ?? 0);
    // Past the last page: count the matches so the client can go back.
    if (!rows.length && page > 1) total = Number(((await q.limit(1).execute()) as unknown as { total: number }[])[0]?.total ?? 0);
    return { items: rows.map(map), page, pageSize, total };
}
