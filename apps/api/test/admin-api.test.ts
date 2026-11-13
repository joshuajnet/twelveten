import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { migrateToLatest } from '../src/db/migrate.ts';
import { seed } from '../src/db/seed.ts';
import { upsertAdmin } from '../src/auth/users.ts';
import type { Publisher } from '../src/publish/publisher.ts';
import { createStorage } from '../src/storage/uploads.ts';
import { resetSchema, testDb } from './db.ts';

const db = testDb();
let adminId = '';
const rendered: string[][] = [];
const publisher: Publisher = {
    render: async (paths) => void rendered.push(paths),
    rebuildAll: async () => ({ pages: 0 }),
};
const storage = createStorage({ bucket: 'test-media', region: 'us-east-2', endpoint: 'http://localhost:4566', publicPrefix: '/media' });

const adminApp = () => createApp({ db: () => db, publisher, storage, resolveUser: async () => ({ id: adminId, role: 'admin' }) });
const userApp = createApp({ db: () => db, resolveUser: async () => ({ id: adminId, role: 'user' }) });
const anonApp = createApp({ db: () => db });

async function call(method: string, path: string, json?: unknown, app = adminApp()) {
    const res = await app.request(`/api${path}`, {
        method,
        headers: json === undefined ? {} : { 'Content-Type': 'application/json' },
        body: json === undefined ? undefined : JSON.stringify(json),
    });
    const text = await res.text();
    return { status: res.status, body: text ? (JSON.parse(text) as any) : null };
}

async function signal() {
    return (await call('GET', '/exhibitions/africh-signal', undefined, adminApp())).body;
}

beforeAll(async () => {
    await resetSchema(db);
    await migrateToLatest(db);
    await seed(db);
    adminId = (await upsertAdmin(db, { email: 'admin@example.com', password: 'correct horse battery' })).id;
});
beforeEach(() => void (rendered.length = 0));
afterAll(() => db.destroy());

describe('admin access', () => {
    it('requires a signed-in admin', async () => {
        expect((await call('POST', '/admin/news', { title: 'x' }, anonApp)).status).toBe(401);
        expect((await call('POST', '/admin/news', { title: 'x' }, userApp)).status).toBe(403);
    });
});

describe('exhibitions', () => {
    it('updates fields, sanitises rich text, records a revision and re-renders pages', async () => {
        const e = await signal();
        const res = await call('PATCH', `/admin/exhibitions/${e.id}`, {
            updatedAt: e.updatedAt,
            title: 'Signal (edited)',
            content: {
                type: 'doc',
                content: [
                    { type: 'paragraph', content: [{ type: 'text', text: 'Hello', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] },
                    { type: 'script', content: [{ type: 'text', text: 'bad' }] },
                ],
            },
        });
        expect(res.status).toBe(200);
        expect(res.body.title).toBe('Signal (edited)');
        expect(res.body.contentHtml).not.toMatch(/javascript:|script/);
        expect(res.body.contentHtml).toContain('Hello');
        expect(rendered.flat()).toEqual(expect.arrayContaining(['/exhibitions/africh-signal', '/exhibitions']));
        const revs = await call('GET', `/admin/revisions?entity=exhibition&id=${e.id}`);
        expect(revs.body.items[0]).toMatchObject({ action: 'update', userName: 'admin' });
    });

    it('rejects stale edits with 409 and returns the current copy', async () => {
        const e = await signal();
        const first = await call('PATCH', `/admin/exhibitions/${e.id}`, { updatedAt: e.updatedAt, subtitle: 'one' });
        expect(first.status).toBe(200);
        const stale = await call('PATCH', `/admin/exhibitions/${e.id}`, { updatedAt: e.updatedAt, subtitle: 'two' });
        expect(stale.status).toBe(409);
        expect(stale.body.details.current.subtitle).toBe('one');
    });

    it('validates input', async () => {
        const e = await signal();
        expect((await call('PATCH', `/admin/exhibitions/${e.id}`, { updatedAt: e.updatedAt, startsOn: 'tomorrow' })).status).toBe(400);
        expect((await call('PATCH', `/admin/exhibitions/${e.id}`, { updatedAt: e.updatedAt, startsOn: '2027-01-01', endsOn: '2026-01-01' })).status).toBe(400);
        expect((await call('PATCH', `/admin/exhibitions/${e.id}`, { updatedAt: e.updatedAt, slug: 'coldbomb' })).status).toBe(409);
        expect((await call('PATCH', `/admin/exhibitions/${e.id}`, { updatedAt: e.updatedAt, heroImage: 'javascript:x' })).status).toBe(400);
    });

    it('creates a draft with a unique slug, hidden from the public until published', async () => {
        const res = await call('POST', '/admin/exhibitions', { kind: 'fair', title: 'NADA Miami 2026', startsOn: '2027-12-01', endsOn: '2027-12-05' });
        expect(res.status).toBe(201);
        expect(res.body.slug).toBe('nada-miami-2026-2');
        expect(res.body.published).toBe(false);
        expect(res.body.slideshowVisible).toBe(false);
        expect((await anonApp.request('/api/exhibitions/nada-miami-2026-2')).status).toBe(404);
        const pub = await call('PATCH', `/admin/exhibitions/${res.body.id}`, { updatedAt: res.body.updatedAt, published: true });
        expect(pub.body.published).toBe(true);
        expect((await anonApp.request('/api/exhibitions/nada-miami-2026-2?kind=fair')).status).toBe(200);
        expect((await call('DELETE', `/admin/exhibitions/${res.body.id}`)).status).toBe(204);
    });

    it('replaces events', async () => {
        const e = await signal();
        const res = await call('PUT', `/admin/exhibitions/${e.id}/events`, {
            events: [
                { label: 'Opening', startsAt: '2026-04-04T23:00:00.000Z', endsAt: '2026-04-05T02:00:00.000Z' },
                { label: 'Artist Talk', startsAt: '2026-04-10T20:00:00.000Z', endsAt: null },
            ],
        });
        expect(res.status).toBe(200);
        expect(res.body.events.map((ev: any) => ev.label)).toEqual(['Opening', 'Artist Talk']);
        expect(
            (await call('PUT', `/admin/exhibitions/${e.id}/events`, { events: [{ label: 'Bad', startsAt: '2026-04-05T00:00:00Z', endsAt: '2026-04-04T00:00:00Z' }] })).status,
        ).toBe(400);
    });
});

describe('slides', () => {
    it('adds, edits, reorders and deletes slides keeping positions contiguous', async () => {
        const e = await signal();
        const before = e.artworks.length;
        const added = await call('POST', `/admin/exhibitions/${e.id}/artworks`, { image: '/media/uploads/x.jpg', alt: 'New work' });
        expect(added.status).toBe(201);
        expect(added.body.position).toBe(before);
        expect((await call('POST', `/admin/exhibitions/${e.id}/artworks`, { alt: 'no media' })).status).toBe(400);

        const edited = await call('PATCH', `/admin/artworks/${added.body.id}`, { updatedAt: added.body.updatedAt, title: 'Titled', available: true });
        expect(edited.body).toMatchObject({ title: 'Titled', available: true });

        const ids = [added.body.id, ...e.artworks.map((a: any) => a.id)];
        const ordered = await call('PUT', `/admin/exhibitions/${e.id}/artworks/order`, { ids });
        expect(ordered.status).toBe(200);
        expect(ordered.body.map((a: any) => a.id)).toEqual(ids);
        expect((await call('PUT', `/admin/exhibitions/${e.id}/artworks/order`, { ids: ids.slice(1) })).status).toBe(400);

        expect((await call('DELETE', `/admin/artworks/${ids[1]}`)).status).toBe(204);
        const after = (await signal()).artworks;
        expect(after.map((a: any) => a.position)).toEqual(after.map((_: unknown, i: number) => i));
        expect(after).toHaveLength(before);
    });
});

describe('news & press', () => {
    it('creates a draft post, sanitises HTML, publishes it', async () => {
        const created = await call('POST', '/admin/news', { title: 'Winter Hours', bodyHtml: '<p>Hi<script>x()</script></p>' });
        expect(created.status).toBe(201);
        expect(created.body).toMatchObject({ slug: 'winter-hours', published: false, bodyHtml: '<p>Hi</p>' });
        const anonList = (await call('GET', '/news', undefined, anonApp)).body.items.map((p: any) => p.slug);
        expect(anonList).not.toContain('winter-hours');
        const adminList = (await call('GET', '/news', undefined, adminApp())).body.items.map((p: any) => p.slug);
        expect(adminList[0]).toBe('winter-hours');
        const pub = await call('PATCH', `/admin/news/${created.body.id}`, { updatedAt: created.body.updatedAt, published: true });
        expect(pub.body.published).toBe(true);
        expect(rendered.flat()).toContain('/news/winter-hours');
        expect((await call('DELETE', `/admin/news/${created.body.id}`)).status).toBe(204);
    });

    it('adds press linked to an exhibition and re-renders that exhibition', async () => {
        const e = await signal();
        const created = await call('POST', '/admin/press', {
            outlet: 'Artforum',
            title: 'Review of Signal',
            url: 'https://artforum.example/signal',
            publishedOn: '2026-05-01',
            exhibitionId: e.id,
            published: true,
        });
        expect(created.status).toBe(201);
        expect(rendered.flat()).toEqual(expect.arrayContaining(['/news', '/exhibitions/africh-signal']));
        expect((await signal()).press.map((p: any) => p.outlet)).toContain('Artforum');
        expect((await call('POST', '/admin/press', { outlet: 'X', title: 'Y', url: 'not a url', publishedOn: '2026-01-01' })).status).toBe(400);
        await call('DELETE', `/admin/press/${created.body.id}`);
    });
});

describe('home', () => {
    it('updates the splash and its link', async () => {
        const home = (await call('GET', '/home')).body;
        const e = await signal();
        const res = await call('PATCH', '/admin/home', { updatedAt: home.updatedAt, headline: 'New headline', linkExhibitionId: e.id, textColor: 'white' });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ headline: 'New headline', textColor: 'white', link: { slug: 'africh-signal' } });
        expect(rendered.flat()).toContain('/');
        expect((await call('PATCH', '/admin/home', { updatedAt: home.updatedAt, headline: 'stale' })).status).toBe(409);
    });
});

describe('revisions', () => {
    it('restores an earlier version of an exhibition', async () => {
        const e = await signal();
        await call('PATCH', `/admin/exhibitions/${e.id}`, { updatedAt: e.updatedAt, title: 'Before restore' });
        const e2 = await signal();
        await call('PATCH', `/admin/exhibitions/${e.id}`, { updatedAt: e2.updatedAt, title: 'After' });
        const revs = (await call('GET', `/admin/revisions?entity=exhibition&id=${e.id}`)).body.items;
        const target = revs[1]; // the "Before restore" save
        expect((await call('POST', `/admin/revisions/${target.id}/restore`)).status).toBe(200);
        expect((await signal()).title).toBe('Before restore');
    });

    it('brings back a deleted exhibition with its slides', async () => {
        const created = (await call('POST', '/admin/exhibitions', { kind: 'exhibition', title: 'Temp Show', startsOn: '2027-01-01', endsOn: '2027-02-01' })).body;
        await call('POST', `/admin/exhibitions/${created.id}/artworks`, { image: '/media/a.jpg', alt: 'a' });
        await call('DELETE', `/admin/exhibitions/${created.id}`);
        const revs = (await call('GET', `/admin/revisions?entity=exhibition&id=${created.id}`)).body.items;
        expect(revs[0].action).toBe('delete');
        await call('POST', `/admin/revisions/${revs[0].id}/restore`);
        const back = (await call('GET', `/admin/exhibitions/${created.id}`)).body;
        expect(back.title).toBe('Temp Show');
        expect(back.artworks).toHaveLength(1);
    });
});

describe('uploads', () => {
    it('issues a presigned upload for allowed types only', async () => {
        const ok = await call('POST', '/admin/uploads', { filename: 'Installation View 01.JPG', contentType: 'image/jpeg', size: 1234 });
        expect(ok.status).toBe(201);
        expect(ok.body.url).toMatch(/^\/media\/uploads\/\d{4}\/\d{2}\/[0-9a-f-]+-installation-view-01\.jpg$/);
        expect(ok.body.uploadUrl).toContain('X-Amz-Signature=');
        expect((await call('POST', '/admin/uploads', { filename: 'x.exe', contentType: 'application/x-msdownload', size: 10 })).status).toBe(400);
        expect((await call('POST', '/admin/uploads', { filename: 'huge.mp4', contentType: 'video/mp4', size: 10 ** 10 })).status).toBe(400);
    });
});
