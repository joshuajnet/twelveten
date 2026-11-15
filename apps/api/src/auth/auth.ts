import { betterAuth } from 'better-auth';
import { admin } from 'better-auth/plugins';
import { v7 as uuidv7 } from 'uuid';
import type { DB } from '../db/index.ts';
import { config } from '../config.ts';

export interface AuthOptions {
    db: DB;
    secret?: string;
    siteUrl?: string;
    trustedOrigins?: string[];
}

/**
 * Better Auth with email/password (public sign-up disabled; admins are created with
 * `npm run admin:create`), the admin plugin (roles), and Postgres for sessions and rate limits.
 */
export function createAuth({
    db,
    secret = config().BETTER_AUTH_SECRET,
    siteUrl = config().SITE_URL,
    trustedOrigins = config().TRUSTED_ORIGINS,
}: AuthOptions) {
    if (!secret) throw new Error('BETTER_AUTH_SECRET is not set');
    return betterAuth({
        appName: 'Twelve Ten',
        baseURL: siteUrl,
        basePath: '/api/auth',
        secret,
        trustedOrigins: [siteUrl, ...trustedOrigins],
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
            // Set by withClientIp from CloudFront's viewer address. Locally (no CloudFront) the Vite proxy's
            // single-value X-Forwarded-For is used instead.
            ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER, 'x-forwarded-for'] },
        },
        plugins: [admin({ defaultRole: 'user', adminRoles: ['admin'] })],
    });
}

export type Auth = ReturnType<typeof createAuth>;

/** Header carrying the visitor's address to Better Auth (for rate limits). Never taken from the client. */
export const CLIENT_IP_HEADER = 'x-twelveten-client-ip';

/** The IP from CloudFront-Viewer-Address ('198.51.100.10:46532', '2001:db8::1:46532' or '[2001:db8::1]:46532'). */
export function viewerIp(value: string | null): string | null {
    if (!value) return null;
    const v = value.trim();
    if (v.startsWith('[')) return v.slice(1, v.indexOf(']')) || null;
    const colon = v.lastIndexOf(':');
    return colon > 0 ? v.slice(0, colon) : null;
}

/**
 * The request as Better Auth should see it. X-Forwarded-For can't be trusted for rate limits: CloudFront
 * appends to whatever the client sent, and Better Auth falls back to one shared bucket for a multi-value
 * header, so a client could use up everyone's sign-in attempts. CloudFront-Viewer-Address is set by
 * CloudFront itself, and the origin check makes sure requests come through CloudFront.
 */
export function withClientIp(req: Request): Request {
    const headers = new Headers(req.headers);
    headers.delete(CLIENT_IP_HEADER);
    const ip = viewerIp(headers.get('cloudfront-viewer-address'));
    if (ip) headers.set(CLIENT_IP_HEADER, ip);
    return new Request(req, { headers });
}

/** Resolve the signed-in user (if any) from request headers. */
export async function resolveUserFrom(auth: Auth, headers: Headers): Promise<{ id: string; role: string } | null> {
    const session = await auth.api.getSession({ headers });
    if (!session) return null;
    const user = session.user as { id: string; role?: string | null; banned?: boolean | null };
    if (user.banned) return null;
    return { id: user.id, role: user.role ?? 'user' };
}
