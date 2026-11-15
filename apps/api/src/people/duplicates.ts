import { sql, type RawBuilder } from 'kysely';
import type { NumberedPage, PersonBrief, PersonDuplicate, ProfileType } from '@twelveten/shared';
import type { DB } from '../db/index.ts';

type Q = Pick<DB, 'selectFrom'> & { getExecutor: DB['getExecutor'] };

/**
 * Candidate pairs of people who may be the same person, with the reasons and a score:
 * the same email (main or alias), the same email name on another domain, a similar or identical
 * name (pg_trgm), or the same phone number. Pairs dismissed as "not the same" are left out.
 */
function candidatePairs(onlyFor: string | null): RawBuilder<{ a_id: string; b_id: string; reasons: string[]; score: number }> {
    const only = onlyFor ? sql`AND (x.a_id = ${onlyFor} OR x.b_id = ${onlyFor})` : sql``;
    const nameScope = onlyFor ? sql`AND (a.id = ${onlyFor} OR b.id = ${onlyFor})` : sql``;
    return sql`
WITH emails AS (
  SELECT id AS person_id, lower(btrim(email)) AS email FROM persons WHERE email IS NOT NULL AND btrim(email) <> ''
  UNION
  SELECT person_id, email FROM person_emails
),
phones AS (
  SELECT id AS person_id, regexp_replace(phone, '\\D', '', 'g') AS digits FROM persons WHERE phone IS NOT NULL
),
signals AS (
  SELECT least(e1.person_id, e2.person_id) AS a_id, greatest(e1.person_id, e2.person_id) AS b_id, 'Same email' AS reason, 100 AS weight
  FROM emails e1 JOIN emails e2 ON e1.email = e2.email AND e1.person_id <> e2.person_id
  UNION ALL
  SELECT least(e1.person_id, e2.person_id), greatest(e1.person_id, e2.person_id), 'Same email name, other domain', 35
  FROM emails e1 JOIN emails e2
    ON split_part(e1.email, '@', 1) = split_part(e2.email, '@', 1)
   AND split_part(e1.email, '@', 2) <> split_part(e2.email, '@', 2)
   AND e1.person_id <> e2.person_id
  WHERE length(split_part(e1.email, '@', 1)) >= 5
    AND split_part(e1.email, '@', 1) NOT IN ('info','contact','hello','office','admin','studio','sales','gallery','mail')
  UNION ALL
  SELECT a.id, b.id,
    CASE WHEN lower(btrim(a.name)) = lower(btrim(b.name)) THEN 'Same name' ELSE 'Similar name' END,
    CASE WHEN lower(btrim(a.name)) = lower(btrim(b.name)) THEN 60 ELSE round(similarity(lower(a.name), lower(b.name)) * 50)::int END
  FROM persons a JOIN persons b ON a.id < b.id AND lower(a.name) % lower(b.name)
  WHERE similarity(lower(a.name), lower(b.name)) >= 0.6 ${nameScope}
  UNION ALL
  SELECT least(p1.person_id, p2.person_id), greatest(p1.person_id, p2.person_id), 'Same phone', 50
  FROM phones p1 JOIN phones p2 ON p1.digits = p2.digits AND p1.person_id <> p2.person_id
  WHERE length(p1.digits) >= 7
)
SELECT x.a_id, x.b_id, array_agg(DISTINCT x.reason ORDER BY x.reason) AS reasons, least(100, sum(x.weight))::int AS score
FROM (SELECT DISTINCT a_id, b_id, reason, weight FROM signals) x
WHERE NOT EXISTS (SELECT 1 FROM person_duplicate_dismissals d WHERE d.a_id = x.a_id AND d.b_id = x.b_id) ${only}
GROUP BY x.a_id, x.b_id`;
}

async function briefs(db: Q, ids: string[]): Promise<Map<string, PersonBrief>> {
    if (!ids.length) return new Map();
    const rows = await db
        .selectFrom('persons as p')
        .leftJoin('artist_profiles as ap', 'ap.person_id', 'p.id')
        .leftJoin('collector_profiles as cp', 'cp.person_id', 'p.id')
        .select(['p.id', 'p.name', 'p.email', 'p.phone', 'p.created_at', 'ap.person_id as artist', 'cp.person_id as collector'])
        .select((eb) => [
            eb.exists(eb.selectFrom('viewing_room_visitors as v').select('v.id').whereRef('v.person_id', '=', 'p.id').where('v.match', '=', 'new')).as('from_room'),
            eb.exists(eb.selectFrom('inquiries as q').select('q.id').whereRef('q.person_id', '=', 'p.id').where('q.match', '=', 'new')).as('from_inquiry'),
        ])
        .where('p.id', 'in', ids)
        .execute();
    return new Map(
        rows.map((r) => [
            r.id,
            {
                id: r.id,
                name: r.name,
                email: r.email,
                phone: r.phone,
                createdAt: r.created_at,
                profiles: [...(r.artist ? ['artist'] : []), ...(r.collector ? ['collector'] : [])] as ProfileType[],
                source: r.from_room ? 'viewing_room' : r.from_inquiry ? 'inquiry' : null,
            },
        ]),
    );
}

async function hydrate(db: Q, rows: { a_id: string; b_id: string; reasons: string[]; score: number }[]): Promise<PersonDuplicate[]> {
    const people = await briefs(db, [...new Set(rows.flatMap((r) => [r.a_id, r.b_id]))]);
    return rows
        .filter((r) => people.has(r.a_id) && people.has(r.b_id))
        .map((r) => {
            let a = people.get(r.a_id)!;
            let b = people.get(r.b_id)!;
            // The older record first: it is usually the one to keep.
            if (a.createdAt > b.createdAt) [a, b] = [b, a];
            return { a, b, reasons: r.reasons, score: Number(r.score) };
        });
}

/** Every candidate pair, best first; pairs involving a viewing-room sign-up rank first among equals. */
export async function listDuplicates(db: Q, page: number, pageSize: number): Promise<NumberedPage<PersonDuplicate>> {
    const rows = await sql<{ a_id: string; b_id: string; reasons: string[]; score: number; total: number }>`
SELECT c.*, count(*) OVER () AS total FROM (${candidatePairs(null)}) c
ORDER BY c.score DESC,
  (EXISTS (SELECT 1 FROM viewing_room_visitors v WHERE v.person_id IN (c.a_id, c.b_id) AND v.match = 'new')
   OR EXISTS (SELECT 1 FROM inquiries q WHERE q.person_id IN (c.a_id, c.b_id) AND q.match = 'new')) DESC,
  c.a_id, c.b_id
LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`.execute(db);
    const total = Number(rows.rows[0]?.total ?? 0);
    return { items: await hydrate(db, rows.rows), page, pageSize, total };
}

/** How many candidate pairs there are (sidebar badge). */
export async function countDuplicates(db: Q): Promise<number> {
    const r = await sql<{ n: number }>`SELECT count(*)::int AS n FROM (${candidatePairs(null)}) c`.execute(db);
    return Number(r.rows[0]?.n ?? 0);
}

/** Candidates for one person, best first. */
export async function duplicatesOf(db: Q, personId: string): Promise<PersonDuplicate[]> {
    const rows = await sql<{ a_id: string; b_id: string; reasons: string[]; score: number }>`
SELECT c.* FROM (${candidatePairs(personId)}) c ORDER BY c.score DESC LIMIT 10`.execute(db);
    return hydrate(db, rows.rows);
}
