import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { createAuth } from '../src/auth/auth.ts';
import { upsertAdmin } from '../src/auth/users.ts';
import { migrateToLatest } from '../src/db/migrate.ts';
import { resetSchema, testDb } from './db.ts';

const db = testDb();
const app = createApp({ db: () => db, auth: createAuth({ db, secret: 'test-secret-test-secret-test-secret-123', siteUrl: 'http://localhost:5173' }) });
const origin = 'http://localhost:5173';

async function signIn(email: string, password: string) {
    return app.request('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({ email, password }),
    });
}

const cookieFrom = (res: Response) =>
    res.headers
        .getSetCookie()
        .map((c) => c.split(';')[0])
        .join('; ');

beforeAll(async () => {
    await resetSchema(db);
    await migrateToLatest(db);
    await upsertAdmin(db, { email: 'Admin@Example.com', password: 'correct horse battery' });
});
afterAll(() => db.destroy());

describe('admin login', () => {
    it('signs in an admin and reports the session', async () => {
        const res = await signIn('admin@example.com', 'correct horse battery');
        expect(res.status).toBe(200);
        const cookie = cookieFrom(res);
        expect(cookie).toContain('twelveten.session_token=');
        const setCookie = res.headers.getSetCookie().join('\n');
        expect(setCookie).toMatch(/HttpOnly/i);
        expect(setCookie).toMatch(/SameSite=Lax/i);

        const session = await app.request('/api/session', { headers: { cookie } });
        expect(await session.json()).toMatchObject({ user: { email: 'admin@example.com', role: 'admin' } });
        expect(session.headers.get('cache-control')).toBe('private, no-store');
    });

    it('rejects a wrong password', async () => {
        expect((await signIn('admin@example.com', 'wrong password!!')).status).toBe(401);
    });

    it('does not allow public sign-up', async () => {
        const res = await app.request('/api/auth/sign-up/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Origin: origin },
            body: JSON.stringify({ email: 'new@example.com', password: 'another long password', name: 'New' }),
        });
        expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('signs out and the session stops working', async () => {
        const cookie = cookieFrom(await signIn('admin@example.com', 'correct horse battery'));
        const out = await app.request('/api/auth/sign-out', { method: 'POST', headers: { cookie, Origin: origin } });
        expect(out.status).toBe(200);
        const session = await app.request('/api/session', { headers: { cookie } });
        expect(await session.json()).toEqual({ user: null });
    });

    it('upsertAdmin resets the password of an existing admin', async () => {
        const r = await upsertAdmin(db, { email: 'admin@example.com', password: 'a brand new password' });
        expect(r.created).toBe(false);
        expect((await signIn('admin@example.com', 'a brand new password')).status).toBe(200);
        await expect(upsertAdmin(db, { email: 'x@example.com', password: 'short' })).rejects.toThrow(/12 characters/);
    });

    it('anonymous requests have no session', async () => {
        expect(await (await app.request('/api/session')).json()).toEqual({ user: null });
    });
});
