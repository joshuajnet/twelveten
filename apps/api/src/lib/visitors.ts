import { createHash, randomBytes } from 'node:crypto';
import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { sql, type Transaction } from 'kysely';
import type { AppEnv } from '../env.ts';
import type { DB } from '../db/index.ts';
import type { Database } from '../db/types.ts';
import { viewerIp } from '../auth/auth.ts';
import { HttpError } from '../routes/admin/errors.ts';
import { config } from '../config.ts';

type Ctx = Context<AppEnv>;
type Exec = Transaction<Database> | DB;

/** One year. */
export const VISITOR_COOKIE_MAX_AGE = 365 * 24 * 3600;
/** Site-wide: who this browser is (set by a room gate or an inquiry). */
export const WHO_COOKIE = 'twelveten_who';

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
export const newCookieValue = () => randomBytes(32).toString('base64url');

/** The visitor's address: CloudFront's viewer address, else the local proxy's X-Forwarded-For. */
export function clientIp(c: Ctx): string {
    return viewerIp(c.req.header('cloudfront-viewer-address') ?? null) ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

/** Fixed-window limit shared across API instances (Better Auth's rateLimit table, our own key prefixes). */
export async function rateLimit(db: DB, key: string, max: number, windowMs: number, message = 'Too many attempts; try again in a minute'): Promise<void> {
    const now = Date.now();
    const r = await sql<{ count: number }>`
INSERT INTO "rateLimit" (key, count, "lastRequest") VALUES (${key}, 1, ${now})
ON CONFLICT (key) DO UPDATE SET
  count = CASE WHEN "rateLimit"."lastRequest" < ${now - windowMs} THEN 1 ELSE "rateLimit".count + 1 END,
  "lastRequest" = CASE WHEN "rateLimit"."lastRequest" < ${now - windowMs} THEN ${now} ELSE "rateLimit"."lastRequest" END
RETURNING count`.execute(db);
    if (Number(r.rows[0]?.count ?? 0) > max) throw new HttpError(429, message);
}

/**
 * Limit a public action per visitor address. In development, requests from this machine are not
 * limited (the e2e tests and local testing all come from 127.0.0.1).
 */
export async function limitByIp(c: Ctx, prefix: string, max: number, windowMs: number, message?: string): Promise<void> {
    const ip = clientIp(c);
    if (config().NODE_ENV === 'development' && /^(127\.|::1$|::ffff:127\.|unknown$)/.test(ip)) return;
    await rateLimit(c.var.db, `${prefix}:${ip}`, max, windowMs, message);
}

/** Writes only from the site itself (browsers send Origin on POST): the same origins Better Auth trusts. */
export function originGuard(siteUrl: string, trustedOrigins: string[] = []) {
    const origins = new Set([siteUrl, ...trustedOrigins].map((o) => new URL(o).origin));
    return (c: Ctx) => {
        if (c.req.method !== 'POST') return;
        const origin = c.req.header('origin');
        if (origin && !origins.has(origin)) throw new HttpError(403, 'Forbidden');
    };
}

/** Remember this browser as `personId` across the public site (HttpOnly cookie on /api). */
export async function rememberVisitor(c: Ctx, trx: Exec, personId: string, secure: boolean): Promise<void> {
    const value = newCookieValue();
    await trx.insertInto('visitor_identities').values({ hash: sha256(value), person_id: personId }).execute();
    setCookie(c, WHO_COOKIE, value, { path: '/api', httpOnly: true, secure, sameSite: 'Lax', maxAge: VISITOR_COOKIE_MAX_AGE });
}

/** The person this browser identified as, if any. */
export async function knownVisitor(c: Ctx): Promise<{ personId: string; name: string; hash: string } | null> {
    const raw = getCookie(c, WHO_COOKIE);
    if (!raw || raw.length > 100) return null;
    const row = await c.var.db
        .selectFrom('visitor_identities as v')
        .innerJoin('persons as p', 'p.id', 'v.person_id')
        .select(['v.person_id', 'p.name', 'v.hash'])
        .where('v.hash', '=', sha256(raw))
        .executeTakeFirst();
    return row ? { personId: row.person_id, name: row.name, hash: row.hash } : null;
}

/** "Not you?": forget this browser. */
export async function forgetVisitor(c: Ctx): Promise<void> {
    const known = await knownVisitor(c);
    if (known) await c.var.db.deleteFrom('visitor_identities').where('hash', '=', known.hash).execute();
    deleteCookie(c, WHO_COOKIE, { path: '/api' });
}
