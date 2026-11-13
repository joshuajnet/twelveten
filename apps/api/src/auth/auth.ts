import { betterAuth } from 'better-auth';
import { admin } from 'better-auth/plugins';
import { v7 as uuidv7 } from 'uuid';
import type { DB } from '../db/index.ts';
import { config } from '../config.ts';

export interface AuthOptions {
    db: DB;
    secret?: string;
    siteUrl?: string;
}

/**
 * Better Auth with email/password (public sign-up disabled; admins are created with
 * `npm run admin:create`), the admin plugin (roles), and Postgres for sessions and rate limits.
 */
export function createAuth({ db, secret = config().BETTER_AUTH_SECRET, siteUrl = config().SITE_URL }: AuthOptions) {
    if (!secret) throw new Error('BETTER_AUTH_SECRET is not set');
    return betterAuth({
        appName: 'Twelve Ten',
        baseURL: siteUrl,
        basePath: '/api/auth',
        secret,
        trustedOrigins: [siteUrl],
        database: { db, type: 'postgres' },
        emailAndPassword: {
            enabled: true,
            disableSignUp: true,
            minPasswordLength: 12,
        },
        session: {
            expiresIn: 60 * 60 * 24 * 7, // 7 days
            updateAge: 60 * 60 * 24, // refresh daily while in use
        },
        rateLimit: {
            enabled: true,
            storage: 'database',
            window: 60,
            max: 100,
            customRules: { '/sign-in/email': { window: 60, max: 5 } },
        },
        advanced: {
            database: { generateId: () => uuidv7() },
            cookiePrefix: 'twelveten',
            useSecureCookies: siteUrl.startsWith('https://'),
            defaultCookieAttributes: { sameSite: 'lax', httpOnly: true },
        },
        plugins: [admin({ defaultRole: 'user', adminRoles: ['admin'] })],
    });
}

export type Auth = ReturnType<typeof createAuth>;

/** Resolve the signed-in user (if any) from request headers. */
export async function resolveUserFrom(auth: Auth, headers: Headers): Promise<{ id: string; role: string } | null> {
    const session = await auth.api.getSession({ headers });
    if (!session) return null;
    const user = session.user as { id: string; role?: string | null; banned?: boolean | null };
    if (user.banned) return null;
    return { id: user.id, role: user.role ?? 'user' };
}
