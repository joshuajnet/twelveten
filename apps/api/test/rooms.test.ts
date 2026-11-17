import { beforeAll, describe, expect, it } from 'vitest';
import { CreateBucketCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { createApp } from '../src/app.ts';
import { prepareRoomImages, roomPdfDownload } from '../src/rooms/pdfExport.ts';
import { PAGE_H, PAGE_W, pageKey, pixelsFor, workImagePlacement, type RoomPdfModel } from '../src/rooms/roomPdf.ts';
import { createStorage } from '../src/storage/uploads.ts';
import { adminHarness } from './admin-harness.ts';

// Generated room PDFs go to a LocalStack bucket of their own.
const storage = createStorage({ bucket: `twelveten-test-rooms-${Date.now()}`, region: 'us-east-2', endpoint: process.env.AWS_ENDPOINT_URL, publicPrefix: '/media' });
beforeAll(async () => {
    await storage.client.send(new CreateBucketCommand({ Bucket: storage.bucket, CreateBucketConfiguration: { LocationConstraint: 'us-east-2' } }));
});
const { call, db } = adminHarness({ storage });

/** A browser: keeps the room cookie between requests (scoped to its path). */
function browser(opts: { ip?: string } = {}) {
    const jar = new Map<string, { value: string; path: string }>();
    const app = createApp({ db: () => db, siteUrl: 'http://localhost:5173', storage });
    async function req(method: string, path: string, json?: unknown, headers: Record<string, string> = {}) {
        const url = `/api${path}`;
        const cookie = [...jar.entries()].filter(([, c]) => url.startsWith(c.path)).map(([k, c]) => `${k}=${c.value}`).join('; ');
        const res = await app.request(url, {
            method,
            headers: {
                ...(json === undefined ? {} : { 'Content-Type': 'application/json' }),
                ...(cookie ? { cookie } : {}),
                'x-forwarded-for': opts.ip ?? '203.0.113.1',
                ...headers,
            },
            body: json === undefined ? undefined : typeof json === 'string' ? json : JSON.stringify(json),
        });
        for (const sc of res.headers.getSetCookie()) {
            const [pair, ...attrs] = sc.split(';').map((s) => s.trim());
            const [k, v] = pair!.split('=');
            const path = attrs.find((a) => a.toLowerCase().startsWith('path='))?.slice(5) ?? '/';
            jar.set(k!, { value: v!, path });
        }
        const type = res.headers.get('content-type') ?? '';
        const body = type.includes('json') ? await res.json() : null;
        return { status: res.status, body: body as any, headers: res.headers };
    }
    return { req, jar };
}

async function setupRoom(title: string, opts: Record<string, unknown> = {}) {
    const artist = (await call('POST', '/admin/persons', { name: `${title} Artist`, profiles: ['artist'] })).body;
    const bio = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Born somewhere.' }] }] };
    await call('PUT', `/admin/persons/${artist.id}/artist-profile`, { bio, cv: bio, updatedAt: artist.artistProfile.updatedAt });
    const slug = title.toLowerCase().replace(/\W+/g, '-');
    await call('POST', `/admin/persons/${artist.id}/artist-profile/press`, { press: { outlet: 'Paper', title: 'Review A', url: `https://example.com/${slug}/a`, publishedOn: '2025-01-01' } });
    const withPress = await call('POST', `/admin/persons/${artist.id}/artist-profile/press`, { press: { outlet: 'Mag', title: 'Review B', url: `https://example.com/${slug}/b`, publishedOn: '2025-02-01' } });
    // Newest first.
    const press = [...withPress.body.artistProfile.press].reverse();
    const works = [];
    for (const [i, priceCents] of [120000, 50000, 75000].entries()) {
        const w = (await call('POST', '/admin/works', { artistId: artist.id, title: `${title} ${i + 1}`, priceCents, images: [{ url: `/media/x${i}.jpg`, alt: '' }] })).body;
        works.push(w);
    }
    const room = (await call('POST', '/admin/rooms', { title, works: works.map((w) => w.id), ...opts })).body;
    return { artist, works, room, press };
}

describe('admin rooms', () => {
    it('creates a room with works, syncs its artists, and edits settings with a version check', async () => {
        const { room, works, artist } = await setupRoom('Admin Room');
        expect(room.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
        expect(room.status).toBe('draft');
        expect(room.works.map((w: any) => w.workId)).toEqual(works.map((w) => w.id));
        expect(room.artists).toHaveLength(1);
        expect(room.artists[0]).toMatchObject({ artistId: artist.id, showBio: true, showCv: true, showPress: true, hasBio: true, hasCv: true });
        expect(room.artists[0].press).toHaveLength(2);

        const patched = await call('PATCH', `/admin/rooms/${room.id}`, { updatedAt: room.updatedAt, status: 'live', showPrices: true });
        expect(patched.status).toBe(200);
        expect(patched.body).toMatchObject({ status: 'live', showPrices: true });
        expect((await call('PATCH', `/admin/rooms/${room.id}`, { updatedAt: room.updatedAt, title: 'x' })).status).toBe(409);

        // Removing every work of an artist drops their settings.
        const cleared = await call('PUT', `/admin/rooms/${room.id}/works`, { works: [] });
        expect(cleared.body.artists).toEqual([]);
        const list = await call('GET', '/admin/rooms?q=admin%20room');
        expect(list.body.items[0]).toMatchObject({ id: room.id, works: 0, visitors: 0 });

        const regenerated = await call('POST', `/admin/rooms/${room.id}/token`);
        expect(regenerated.body.token).not.toBe(room.token);
        expect((await call('DELETE', `/admin/rooms/${room.id}`)).status).toBe(204);
        expect((await call('GET', `/admin/rooms/${room.id}`)).status).toBe(404);
    });

    it('rejects an artists list that doesn’t match the room', async () => {
        const { room } = await setupRoom('Artist List');
        expect((await call('PUT', `/admin/rooms/${room.id}/artists`, { artists: [] })).status).toBe(400);
    });

    it('duplicates a room as a new draft with the same works and artist settings', async () => {
        const { room, works, artist, press } = await setupRoom('Dup Room', { subtitle: 'Miami 2026', showPrices: true, hideUnavailable: true });
        const live = await call('PATCH', `/admin/rooms/${room.id}`, { updatedAt: room.updatedAt, status: 'live', opensAt: '2026-01-01T00:00:00Z', closesAt: '2030-01-01T00:00:00Z', coverImage: '/media/cover.jpg', pdfHidden: true });
        expect(live.status).toBe(200);
        await call('PUT', `/admin/rooms/${room.id}/works`, { works: [works[2]!.id, works[0]!.id].map((id, i) => ({ workId: id, showPrice: i === 0 ? false : null, hidden: i === 1 })) });
        await call('PUT', `/admin/rooms/${room.id}/artists`, { artists: [{ artistId: artist.id, showBio: false, showCv: true, showPress: true, hiddenPressIds: [press[0].id], bioBackgroundColor: '#112233' }] });
        const source = (await call('GET', `/admin/rooms/${room.id}`)).body;

        const res = await call('POST', `/admin/rooms/${room.id}/duplicate`);
        expect(res.status).toBe(201);
        const copy = res.body;
        expect(copy.id).not.toBe(room.id);
        expect(copy.token).not.toBe(room.token);
        expect(copy).toMatchObject({ title: 'Dup Room (copy)', subtitle: 'Miami 2026', status: 'draft', opensAt: null, closesAt: null, showPrices: true, hideUnavailable: true, coverImage: '/media/cover.jpg', pdfHidden: true, visitors: 0 });
        expect(copy.intro).toEqual(source.intro);
        expect(copy.works.map((w: any) => [w.workId, w.showPrice, w.hidden])).toEqual([
            [works[2]!.id, false, false],
            [works[0]!.id, null, true],
        ]);
        expect(copy.artists).toHaveLength(1);
        expect(copy.artists[0]).toMatchObject({ artistId: artist.id, showBio: false, showCv: true, showPress: true, hiddenPressIds: [press[0].id], bioBackgroundColor: '#112233' });
        expect((await call('GET', `/admin/rooms/${copy.id}/pdf`)).body).toBeNull();
        const revs = await db.selectFrom('content_revisions').select('action').where('entity', '=', 'viewing_room').where('entity_id', '=', copy.id).execute();
        expect(revs.map((r) => r.action)).toEqual(['create']);

        // The source is untouched.
        expect((await call('GET', `/admin/rooms/${room.id}`)).body).toMatchObject({ title: 'Dup Room', status: 'live', token: room.token, updatedAt: source.updatedAt });
        expect((await call('POST', `/admin/rooms/00000000-0000-4000-8000-000000000000/duplicate`)).status).toBe(404);
    });

    it('lists rooms by one or more statuses', async () => {
        const tag = `Status ${Date.now()}`;
        const draft = (await call('POST', '/admin/rooms', { title: `${tag} draft` })).body;
        const live = (await call('POST', '/admin/rooms', { title: `${tag} live`, status: 'live' })).body;
        const closed = (await call('POST', '/admin/rooms', { title: `${tag} closed`, status: 'closed' })).body;
        const ids = async (qs: string) => (await call('GET', `/admin/rooms?q=${encodeURIComponent(tag)}${qs}`)).body.items.map((r: any) => r.id).sort();
        expect(await ids('&status=draft,live')).toEqual([draft.id, live.id].sort());
        expect(await ids('&status=closed')).toEqual([closed.id]);
        expect(await ids('')).toEqual([draft.id, live.id, closed.id].sort());
        expect((await call('GET', '/admin/rooms?status=live,gone')).status).toBe(400);
    });
});

describe('viewing a room', () => {
    it('gates, creates a person with a collector profile, remembers the browser, and hides prices', async () => {
        const { room } = await setupRoom('Gate Room');
        const b = browser();
        const path = `/rooms/${room.token}`;
        // Draft rooms don't exist publicly.
        expect((await b.req('GET', path)).status).toBe(404);
        await call('PATCH', `/admin/rooms/${room.id}`, { updatedAt: room.updatedAt, status: 'live' });

        const gate = await b.req('GET', path);
        expect(gate.status).toBe(200);
        expect(gate.body).toEqual({ gate: { title: 'Gate Room', subtitle: null } });
        expect(gate.headers.get('cache-control')).toBe('private, no-store');
        expect((await b.req('POST', `${path}/enter`, { name: 'Pat', email: 'not-an-email' })).status).toBe(400);
        // Another site can't post on the viewer's behalf.
        expect((await b.req('POST', `${path}/enter`, { name: 'Pat', email: 'pat@example.com' }, { origin: 'https://evil.example' })).status).toBe(403);

        const entered = await b.req('POST', `${path}/enter`, { name: 'Pat Viewer', email: ' Pat.Viewer@Example.com ' });
        expect(entered.status).toBe(200);
        const cookies = entered.headers.getSetCookie();
        const set = cookies.find((c) => c.startsWith('twelveten_vr='))!;
        expect(set).toContain('HttpOnly');
        expect(set).toContain(`Path=/api/rooms/${room.token}`);
        expect(set).toContain('SameSite=Lax');
        expect(set).toContain('Max-Age=31536000');
        // Also known across the public site (Inquire skips name and email).
        expect(cookies.find((c) => c.startsWith('twelveten_who='))).toContain('Path=/api;');
        const r = entered.body.room;
        expect(r.viewer).toEqual({ name: 'Pat Viewer' });
        expect(r.visitId).toBeTruthy();
        expect(r.works).toHaveLength(3);
        expect(r.works[0]).toMatchObject({ available: true, price: null, statusLabel: null });
        // Nothing private leaks.
        const json = JSON.stringify(r);
        for (const leak of ['inventoryNumber', 'priceCents', 'buyer', 'notes', 'pat.viewer@example.com', 'birth']) expect(json).not.toContain(leak);
        expect(r.artists[0].bioHtml).toContain('Born somewhere.');
        expect(r.artists[0].press).toHaveLength(2);

        // Same browser: straight in, same visit.
        const again = await b.req('GET', path);
        expect(again.body.room.visitId).toBe(r.visitId);
        // A different browser sees the gate.
        expect((await browser().req('GET', path)).body.gate).toBeTruthy();

        const people = (await call('GET', '/admin/persons?q=pat.viewer')).body.items;
        expect(people).toHaveLength(1);
        expect(people[0]).toMatchObject({ name: 'Pat Viewer', email: 'pat.viewer@example.com', profiles: ['collector'] });
        const person = (await call('GET', `/admin/persons/${people[0].id}`)).body;
        expect(person.collectorProfile.viewingRooms[0]).toMatchObject({ roomId: room.id, match: 'new', visits: 1, worksTotal: 3 });
    });

    it('matches an existing person by email or alias', async () => {
        const { room } = await setupRoom('Match Room', { status: 'live' });
        const existing = (await call('POST', '/admin/persons', { name: 'Morgan Known', email: 'morgan@example.com' })).body;
        await call('PUT', `/admin/persons/${existing.id}/emails`, { emails: ['mo@alias.example'] });

        await browser().req('POST', `/rooms/${room.token}/enter`, { name: 'Mo', email: 'MORGAN@example.com' });
        await browser().req('POST', `/rooms/${room.token}/enter`, { name: 'Mo K', email: 'mo@alias.example' });
        const person = (await call('GET', `/admin/persons/${existing.id}`)).body;
        expect(person.profiles).toEqual(['collector']);
        expect(person.collectorProfile.viewingRooms).toHaveLength(1);
        // Entering again within 30 minutes continues the same visit.
        expect(person.collectorProfile.viewingRooms[0]).toMatchObject({ enteredName: 'Mo K', match: 'email', visits: 1 });
        expect((await call('GET', '/admin/persons?q=Mo%20K')).body.total).toBe(0);
    });

    it('shows prices per room and work, labels unavailable works, and hides them on request', async () => {
        const { room, works } = await setupRoom('Price Room', { status: 'live', showPrices: true });
        const b = browser();
        const path = `/rooms/${room.token}`;
        await b.req('POST', `${path}/enter`, { name: 'Price Viewer', email: 'price@example.com' });

        await call('PUT', `/admin/rooms/${room.id}/works`, {
            works: [
                { workId: works[0].id },
                { workId: works[1].id, showPrice: false },
                { workId: works[2].id },
            ],
        });
        const w2 = (await call('GET', `/admin/works/${works[2].id}`)).body;
        await call('PATCH', `/admin/works/${works[2].id}`, { updatedAt: w2.updatedAt, status: 'sold' });

        let r = (await b.req('GET', path)).body.room;
        expect(r.works.map((w: any) => [w.price, w.available, w.statusLabel])).toEqual([
            ['$1,200', true, null],
            [null, true, null],
            [null, false, 'Sold'],
        ]);

        await call('PUT', `/admin/rooms/${room.id}/works`, { works: [{ workId: works[0].id }, { workId: works[1].id }, { workId: works[2].id, hidden: true }] });
        r = (await b.req('GET', path)).body.room;
        expect(r.works).toHaveLength(2);

        const cur = (await call('GET', `/admin/rooms/${room.id}`)).body;
        await call('PUT', `/admin/rooms/${room.id}/works`, { works: cur.works.map((w: any) => ({ workId: w.workId, hidden: false })) });
        const cur2 = (await call('GET', `/admin/rooms/${room.id}`)).body;
        await call('PATCH', `/admin/rooms/${room.id}`, { updatedAt: cur2.updatedAt, hideUnavailable: true });
        r = (await b.req('GET', path)).body.room;
        expect(r.works.map((w: any) => w.id)).toEqual([works[0].id, works[1].id]);

        // Tracking a hidden work is ignored.
        const res = await b.req('POST', `${path}/track`, { visitId: r.visitId, activeMs: 1000, works: [{ workId: works[2].id, viewMs: 1000 }] });
        expect(res.status).toBe(204);
        expect(await db.selectFrom('viewing_room_work_stats').select('work_id').where('work_id', '=', works[2].id).execute()).toEqual([]);
    });

    it('respects artist toggles and hidden press; the CV PDF needs the cookie', async () => {
        const { room, artist, press } = await setupRoom('Artist Room', { status: 'live' });
        const b = browser();
        const path = `/rooms/${room.token}`;
        expect((await b.req('GET', `${path}/artists/${artist.id}/cv.pdf`)).status).toBe(401);
        await b.req('POST', `${path}/enter`, { name: 'Reader', email: 'reader@example.com' });
        const pdf = await b.req('GET', `${path}/artists/${artist.id}/cv.pdf`);
        expect(pdf.status).toBe(200);
        expect(pdf.headers.get('content-type')).toBe('application/pdf');

        await call('PUT', `/admin/rooms/${room.id}/artists`, { artists: [{ artistId: artist.id, showBio: false, showCv: false, showPress: true, hiddenPressIds: [press[0].id] }] });
        const r = (await b.req('GET', path)).body.room;
        expect(r.artists[0]).toMatchObject({ bioHtml: null, cvHtml: null });
        expect(r.artists[0].press.map((p: any) => p.title)).toEqual(['Review B']);
        expect((await b.req('GET', `${path}/artists/${artist.id}/cv.pdf`)).status).toBe(404);
    });

    it('records tracking, clamps time, and builds the dashboards and engagement', async () => {
        const { room, works, artist } = await setupRoom('Track Room', { status: 'live' });
        const b = browser();
        const path = `/rooms/${room.token}`;
        const r = (await b.req('POST', `${path}/enter`, { name: 'Tracy Tracker', email: 'tracy@example.com' })).body.room;
        expect((await browser().req('POST', `${path}/track`, { visitId: r.visitId, activeMs: 0 })).status).toBe(401);

        const now = new Date().toISOString();
        const batch = {
            visitId: r.visitId,
            activeMs: 10 * 60_000, // more than has passed: clamped
            works: [{ workId: works[0].id, viewMs: 9000, hoverMs: 4000, zooms: 2, maxZoom: 3.5, clicks: 1, focus: 1, inquiries: 1 }],
            artists: [{ artistId: artist.id, readMs: 5000, opens: 1 }],
            events: [
                { type: 'zoom', at: now, workId: works[0].id, data: { level: 3.5 } },
                { type: 'inquire', at: now, workId: works[0].id },
            ],
            pointer: [{ workId: works[0].id, points: [0, 0, 10, 65535, 65535, 35] }],
        };
        const res = await b.req('POST', `${path}/track`, JSON.stringify(batch), { 'Content-Type': 'text/plain' });
        expect(res.status).toBe(204);

        const visitor = await db.selectFrom('viewing_room_visitors').selectAll().where('entered_email', '=', 'tracy@example.com').executeTakeFirstOrThrow();
        expect(Number(visitor.active_ms)).toBeLessThan(60_000);
        expect(visitor.engagement).toBeGreaterThanOrEqual(25);

        const dash = (await call('GET', `/admin/rooms/${room.id}/dashboard`)).body;
        expect(dash.totals).toMatchObject({ visitors: 1, visits: 1, inquiries: 1 });
        expect(dash.works[0]).toMatchObject({ workId: works[0].id, viewers: 1, zoomCount: 2, inquiries: 1 });

        const vd = (await call('GET', `/admin/rooms/${room.id}/visitors/${visitor.id}`)).body;
        expect(vd.visitor).toMatchObject({ personName: 'Tracy Tracker', inquiries: 1, worksViewed: 1 });
        expect(vd.works[0]).toMatchObject({ workId: works[0].id, maxZoom: 3.5, visitsSeen: 1 });
        expect(vd.works[0].interest).toBeGreaterThan(30);
        expect(vd.artists[0]).toMatchObject({ artistId: artist.id, readMs: 5000, opens: 1 });
        expect(vd.events.map((e: any) => e.type).sort()).toEqual(['enter', 'inquire', 'zoom']);

        const pointer = (await call('GET', `/admin/rooms/${room.id}/visitors/${visitor.id}/pointer?work=${works[0].id}`)).body;
        expect(pointer.items).toHaveLength(1);
        expect(Buffer.from(pointer.items[0].points, 'base64')).toHaveLength(10);

        // The collector panel lists the room and the work they looked at most.
        const person = (await call('GET', `/admin/persons/${visitor.person_id}`)).body;
        expect(person.collectorProfile.viewingRooms[0]).toMatchObject({ roomId: room.id, inquiries: 1 });
        expect(person.collectorProfile.topWorks[0].workId).toBe(works[0].id);

        // A room with visitors can't be deleted, and the person can't be either.
        expect((await call('DELETE', `/admin/rooms/${room.id}`)).status).toBe(409);
        expect((await call('DELETE', `/admin/persons/${visitor.person_id}`)).status).toBe(409);

        // Forgetting the visitor removes their activity; then both can go.
        expect((await call('DELETE', `/admin/rooms/${room.id}/visitors/${visitor.id}`)).status).toBe(204);
        expect(await db.selectFrom('viewing_room_work_stats').select('work_id').where('visitor_id', '=', visitor.id).execute()).toEqual([]);
        expect((await b.req('GET', path)).body.gate).toBeTruthy();
        expect((await call('DELETE', `/admin/rooms/${room.id}`)).status).toBe(204);
    });

    it('starts a new visit after 30 minutes away and counts revisits per work', async () => {
        const { room, works } = await setupRoom('Visit Room', { status: 'live' });
        const b = browser();
        const path = `/rooms/${room.token}`;
        const r1 = (await b.req('POST', `${path}/enter`, { name: 'Vic', email: 'vic@example.com' })).body.room;
        await b.req('POST', `${path}/track`, { visitId: r1.visitId, activeMs: 1000, works: [{ workId: works[0].id, viewMs: 1000 }] });
        await db
            .updateTable('viewing_room_visits')
            .set({ last_activity_at: new Date(Date.now() - 31 * 60_000).toISOString() })
            .where('id', '=', r1.visitId)
            .execute();
        const r2 = (await b.req('GET', path)).body.room;
        expect(r2.visitId).not.toBe(r1.visitId);
        await b.req('POST', `${path}/track`, { visitId: r2.visitId, activeMs: 1000, works: [{ workId: works[0].id, viewMs: 1000 }] });
        const stat = await db.selectFrom('viewing_room_work_stats').selectAll().where('work_id', '=', works[0].id).executeTakeFirstOrThrow();
        expect(stat.visits_seen).toBe(2);
        expect(Number(stat.view_ms)).toBe(2000);
    });

    it('merging two visitors of one room combines their stats', async () => {
        const { room, works } = await setupRoom('Merge Room', { status: 'live' });
        const path = `/rooms/${room.token}`;
        const one = browser();
        const two = browser();
        const r1 = (await one.req('POST', `${path}/enter`, { name: 'Dana Double', email: 'dana@one.example' })).body.room;
        const r2 = (await two.req('POST', `${path}/enter`, { name: 'Dana Double', email: 'dana@two.example' })).body.room;
        await one.req('POST', `${path}/track`, { visitId: r1.visitId, activeMs: 1000, works: [{ workId: works[0].id, viewMs: 4000, zooms: 1 }] });
        await two.req('POST', `${path}/track`, { visitId: r2.visitId, activeMs: 1000, works: [{ workId: works[0].id, viewMs: 5000, zooms: 2 }] });

        const people = (await call('GET', '/admin/persons?q=dana%20double')).body.items;
        expect(people).toHaveLength(2);
        const [a, b] = await Promise.all(people.map(async (p: any) => (await call('GET', `/admin/persons/${p.id}`)).body));
        const dupes = (await call('GET', `/admin/persons/${a.id}/duplicates`)).body.items;
        expect(dupes[0].reasons).toContain('Same name');
        expect(dupes[0].a.source).toBe('viewing_room');

        const merged = (await call('POST', `/admin/persons/${b.id}/merge`, { intoId: a.id, updatedAt: b.updatedAt, intoUpdatedAt: a.updatedAt })).body;
        expect(merged.emails).toEqual([b.email]);
        expect(merged.collectorProfile.viewingRooms).toHaveLength(1);
        expect(merged.collectorProfile.viewingRooms[0].visits).toBe(2);
        const stats = await db.selectFrom('viewing_room_work_stats').selectAll().where('work_id', '=', works[0].id).execute();
        expect(stats).toHaveLength(1);
        expect(Number(stats[0]!.view_ms)).toBe(9000);
        expect(stats[0]!.zoom_count).toBe(3);
        // Both browsers still get in, now as the same visitor.
        expect((await two.req('GET', path)).body.room).toBeTruthy();
        // Next time, either email finds the merged person.
        await browser().req('POST', `${path}/enter`, { name: 'D', email: 'dana@two.example' });
        expect((await call('GET', '/admin/persons?q=dana')).body.total).toBe(1);
    });

    it('takes inquiries about available works and counts them toward engagement', async () => {
        const { room, works } = await setupRoom('Inquiry Room', { status: 'live', showPrices: true });
        const b = browser({ ip: '198.51.100.40' });
        const path = `/rooms/${room.token}`;
        expect((await b.req('POST', `${path}/inquiries`, { workId: works[0].id, note: 'x' })).status).toBe(401);
        await b.req('POST', `${path}/enter`, { name: 'Ida Inquirer', email: 'ida@example.com' });
        const res = await b.req('POST', `${path}/inquiries`, { workId: works[0].id, note: 'Shipping to Toronto?' });
        expect(res.status).toBe(201);
        const w1 = (await call('GET', `/admin/works/${works[1].id}`)).body;
        await call('PATCH', `/admin/works/${works[1].id}`, { updatedAt: w1.updatedAt, status: 'sold' });
        expect((await b.req('POST', `${path}/inquiries`, { workId: works[1].id, note: '' })).status).toBe(400);

        const visitor = await db.selectFrom('viewing_room_visitors').selectAll().where('entered_email', '=', 'ida@example.com').executeTakeFirstOrThrow();
        expect(visitor.engagement).toBeGreaterThanOrEqual(25);
        const vd = (await call('GET', `/admin/rooms/${room.id}/visitors/${visitor.id}`)).body;
        expect(vd.visitor.inquiries).toBe(1);
        expect(vd.events.find((e: any) => e.type === 'inquire').data).toEqual({ note: 'Shipping to Toronto?' });
        const person = (await call('GET', `/admin/persons/${visitor.person_id}`)).body;
        expect(person.collectorProfile.inquiries[0]).toMatchObject({ source: 'room', room: { id: room.id }, workId: works[0].id, match: 'known' });
        expect(person.collectorProfile.inquiries[0].item).toMatchObject({ price: '$1,200', context: 'Inquiry Room' });
    });

    it('limits gate attempts per address', async () => {
        const { room } = await setupRoom('Limit Room', { status: 'live' });
        const b = browser({ ip: '198.51.100.99' });
        let last = 0;
        for (let i = 0; i < 11; i++) last = (await b.req('POST', `/rooms/${room.token}/enter`, { name: 'x', email: 'bad' })).status;
        expect(last).toBe(429);
    });

    it('sets a subtitle and cover image, shown at the gate and in the room', async () => {
        const { room } = await setupRoom('Subtitled Room', { status: 'live', subtitle: '  NADA Miami 2026 ' });
        expect(room).toMatchObject({ subtitle: 'NADA Miami 2026', coverImage: null });
        const b = browser({ ip: '203.0.113.61' });
        const patched = await call('PATCH', `/admin/rooms/${room.id}`, { updatedAt: room.updatedAt, coverImage: '/media/cover.jpg' });
        expect(patched.body.coverImage).toBe('/media/cover.jpg');
        const list = await call('GET', '/admin/rooms?q=subtitled');
        expect(list.body.items[0]).toMatchObject({ subtitle: 'NADA Miami 2026', cover: '/media/cover.jpg' });
        expect((await b.req('GET', `/rooms/${room.token}`)).body.gate).toEqual({ title: 'Subtitled Room', subtitle: 'NADA Miami 2026' });
        await b.req('POST', `/rooms/${room.token}/enter`, { name: 'Sub Viewer', email: 'sub@example.com' });
        expect((await b.req('GET', `/rooms/${room.token}`)).body.room.subtitle).toBe('NADA Miami 2026');
        // An empty subtitle clears it.
        const cleared = await call('PATCH', `/admin/rooms/${room.id}`, { updatedAt: patched.body.updatedAt, subtitle: '' });
        expect(cleared.body.subtitle).toBeNull();
    });

    it('generates the PDF only when an admin asks; admins and visitors download the stored one (tracked)', async () => {
        const { room } = await setupRoom('PDF Room', { subtitle: 'Fair 2026', status: 'live' });
        expect((await call('GET', `/admin/rooms/${room.id}/pdf`)).body).toBeNull();
        expect((await call('GET', `/admin/rooms/${room.id}/room.pdf`)).status).toBe(404);
        const b = browser({ ip: '203.0.113.60' });
        expect((await b.req('GET', `/rooms/${room.token}/room.pdf`)).status).toBe(401);
        const entered = await b.req('POST', `/rooms/${room.token}/enter`, { name: 'Pdf Reader', email: 'pdf-reader@example.com' });
        expect(entered.body.room.hasPdf).toBe(false);
        expect((await b.req('GET', `/rooms/${room.token}/room.pdf`)).status).toBe(404);

        const generated = await call('POST', `/admin/rooms/${room.id}/pdf`);
        expect(generated.status).toBe(201);
        expect(generated.body).toMatchObject({ filename: 'pdf-room-artist-fair-2026.pdf', outdated: false });
        expect(generated.body.bytes).toBeGreaterThan(1000);
        const admin = await call('GET', `/admin/rooms/${room.id}/room.pdf`);
        expect(admin.status).toBe(200);
        expect(admin.headers.get('content-disposition')).toBe('attachment; filename="pdf-room-artist-fair-2026.pdf"');
        expect(admin.bytes!.subarray(0, 5).toString()).toBe('%PDF-');

        expect((await b.req('GET', `/rooms/${room.token}`)).body.room.hasPdf).toBe(true);
        const res = await b.req('GET', `/rooms/${room.token}/room.pdf`);
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('application/pdf');
        const events = await db
            .selectFrom('viewing_room_events as e')
            .innerJoin('viewing_room_visits as v', 'v.id', 'e.visit_id')
            .innerJoin('viewing_room_visitors as r', 'r.id', 'v.visitor_id')
            .select('e.type')
            .where('r.room_id', '=', room.id)
            .execute();
        expect(events.map((e) => e.type)).toContain('room_pdf');

        // Changing the room flags the PDF as out of date; downloads keep serving the stored one until regenerated.
        const fresh = (await call('GET', `/admin/rooms/${room.id}`)).body;
        await call('PATCH', `/admin/rooms/${room.id}`, { updatedAt: fresh.updatedAt, subtitle: 'Fair 2027' });
        expect((await call('GET', `/admin/rooms/${room.id}/pdf`)).body).toMatchObject({ outdated: true, filename: 'pdf-room-artist-fair-2026.pdf' });
        expect((await call('GET', `/admin/rooms/${room.id}/room.pdf`)).headers.get('content-disposition')).toContain('fair-2026');
        await call('POST', `/admin/rooms/${room.id}/pdf`);
        expect((await call('GET', `/admin/rooms/${room.id}/pdf`)).body).toMatchObject({ outdated: false, filename: 'pdf-room-artist-fair-2027.pdf' });

        // A bio background is a per-artist room setting; it changes the PDF too.
        const artistId = fresh.artists[0].artistId;
        const withBg = await call('PUT', `/admin/rooms/${room.id}/artists`, { artists: [{ artistId, showBio: true, showCv: true, showPress: true, bioBackground: '/media/bio-bg.jpg' }] });
        expect(withBg.body.artists[0].bioBackground).toBe('/media/bio-bg.jpg');
        expect((await call('GET', `/admin/rooms/${room.id}/pdf`)).body.outdated).toBe(true);
        const colored = await call('PUT', `/admin/rooms/${room.id}/artists`, { artists: [{ artistId, showBio: true, showCv: true, showPress: true, bioBackground: '', bioBackgroundColor: '#1A2B3C' }] });
        expect(colored.body.artists[0]).toMatchObject({ bioBackground: null, bioBackgroundColor: '#1a2b3c' });
        expect((await call('PUT', `/admin/rooms/${room.id}/artists`, { artists: [{ artistId, showBio: true, showCv: true, showPress: true, bioBackgroundColor: 'red' }] })).status).toBe(400);
    });

    it('can hide the PDF from visitors, or withdraw it entirely', async () => {
        const { room } = await setupRoom('Hidden PDF Room');
        await call('POST', `/admin/rooms/${room.id}/pdf`);
        // Admin preview downloads it in any status, without a visitor and without recording anything.
        expect((await call('GET', `/rooms/${room.token}?preview=1`)).body.room.hasPdf).toBe(true);
        const preview = await call('GET', `/rooms/${room.token}/room.pdf?preview=1`);
        expect(preview.status).toBe(200);
        expect(preview.bytes!.subarray(0, 5).toString()).toBe('%PDF-');
        expect((await call('GET', `/rooms/${room.token}/room.pdf?preview=1`, undefined, 'anon')).status).toBe(404);
        expect(await db.selectFrom('viewing_room_visitors').select('id').where('room_id', '=', room.id).execute()).toEqual([]);
        await call('PATCH', `/admin/rooms/${room.id}`, { updatedAt: room.updatedAt, status: 'live' });
        room.updatedAt = (await call('GET', `/admin/rooms/${room.id}`)).body.updatedAt;
        const b = browser({ ip: '203.0.113.62' });
        await b.req('POST', `/rooms/${room.token}/enter`, { name: 'Hide Reader', email: 'hide-reader@example.com' });
        expect((await b.req('GET', `/rooms/${room.token}`)).body.room.hasPdf).toBe(true);

        // Hidden: kept for admins, not offered to visitors.
        const hidden = await call('PATCH', `/admin/rooms/${room.id}`, { updatedAt: room.updatedAt, pdfHidden: true });
        expect(hidden.body.pdfHidden).toBe(true);
        expect((await b.req('GET', `/rooms/${room.token}`)).body.room.hasPdf).toBe(false);
        expect((await b.req('GET', `/rooms/${room.token}/room.pdf`)).status).toBe(404);
        expect((await call('GET', `/admin/rooms/${room.id}/room.pdf`)).status).toBe(200);
        await call('PATCH', `/admin/rooms/${room.id}`, { updatedAt: hidden.body.updatedAt, pdfHidden: false });
        expect((await b.req('GET', `/rooms/${room.token}/room.pdf`)).status).toBe(200);

        // Withdrawn: offered to nobody until a new one is generated; the file is kept for the retention period.
        expect((await call('DELETE', `/admin/rooms/${room.id}/pdf`)).status).toBe(204);
        expect((await call('DELETE', `/admin/rooms/${room.id}/pdf`)).status).toBe(404);
        expect((await call('GET', `/admin/rooms/${room.id}/pdf`)).body).toBeNull();
        expect((await call('GET', `/admin/rooms/${room.id}/room.pdf`)).status).toBe(404);
        expect((await b.req('GET', `/rooms/${room.token}`)).body.room.hasPdf).toBe(false);
        expect((await b.req('GET', `/rooms/${room.token}/room.pdf`)).status).toBe(404);
        const [row] = await db.selectFrom('viewing_room_pdfs').select(['s3_key', 'withdrawn_at']).where('room_id', '=', room.id).execute();
        expect(row!.withdrawn_at).not.toBeNull();
        expect(await storage.client.send(new HeadObjectCommand({ Bucket: storage.bucket, Key: row!.s3_key })).then(() => true)).toBe(true);

        await call('POST', `/admin/rooms/${room.id}/pdf`);
        expect((await b.req('GET', `/rooms/${room.token}/room.pdf`)).status).toBe(200);
    });

    it('keeps replaced PDFs for 30 days and the newest until it is replaced', async () => {
        const { room } = await setupRoom('Kept PDF Room');
        const keys = async () => (await db.selectFrom('viewing_room_pdfs').select(['s3_key', 'created_at']).where('room_id', '=', room.id).orderBy('created_at').execute()).map((r) => r.s3_key);
        const stored = async (key: string) =>
            storage.client.send(new HeadObjectCommand({ Bucket: storage.bucket, Key: key })).then(
                () => true,
                () => false,
            );
        await call('POST', `/admin/rooms/${room.id}/pdf`);
        await call('POST', `/admin/rooms/${room.id}/pdf`);
        const [oldest, middle] = await keys();
        expect(oldest).toMatch(new RegExp(`^exports/rooms/${room.id}/[0-9a-f-]{36}\\.pdf$`));
        // The oldest was made 31 days ago, the other 29: only the oldest goes on the next generation.
        await db.updateTable('viewing_room_pdfs').set({ created_at: new Date(Date.now() - 31 * 86_400_000).toISOString() } as never).where('s3_key', '=', oldest!).execute();
        await db.updateTable('viewing_room_pdfs').set({ created_at: new Date(Date.now() - 29 * 86_400_000).toISOString() } as never).where('s3_key', '=', middle!).execute();
        await call('POST', `/admin/rooms/${room.id}/pdf`);
        const after = await keys();
        expect(after).toHaveLength(2);
        expect(after).not.toContain(oldest);
        expect(await stored(oldest!)).toBe(false);
        expect(await stored(middle!)).toBe(true);

        // In AWS the download is a short-lived signed link to the stored file.
        const c = { var: { db }, redirect: (url: string, status: 302) => new Response(null, { status, headers: { location: url } }), body: () => new Response() };
        const res = await roomPdfDownload(c as never, storage, room.id, { direct: false });
        expect(res.status).toBe(302);
        const location = new URL(res.headers.get('location')!);
        expect(location.pathname).toContain(after[1]!);
        expect(location.searchParams.get('response-content-disposition')).toBe('attachment; filename="kept-pdf-room-artist.pdf"');
        expect(location.searchParams.get('X-Amz-Expires')).toBe('600');
    });

    it('saves crops for the cover and bio photos, clears them with the image, and copies and restores them', async () => {
        const { room, artist } = await setupRoom('Crop Room');
        expect(room.coverCrop).toBeNull();
        expect(room.works[0].images).toEqual(['/media/x0.jpg']);
        const crop = { x: 0.1, y: 0.2, w: 0.5, h: 0.4 };
        const withCover = await call('PATCH', `/admin/rooms/${room.id}`, { updatedAt: room.updatedAt, coverImage: '/media/x1.jpg', coverCrop: crop });
        expect(withCover.body).toMatchObject({ coverImage: '/media/x1.jpg', coverCrop: crop });
        expect((await call('PATCH', `/admin/rooms/${room.id}`, { updatedAt: withCover.body.updatedAt, coverCrop: { x: 0.6, y: 0, w: 0.5, h: 0.5 } })).status).toBe(400);
        const list = await call('GET', '/admin/rooms?q=crop%20room');
        expect(list.body.items[0]).toMatchObject({ cover: '/media/x1.jpg', coverCrop: crop });

        const bioCrop = { x: 0, y: 0, w: 1, h: 0.7 };
        const put = (bioBackground: string | null, bioBackgroundCrop: unknown) =>
            call('PUT', `/admin/rooms/${room.id}/artists`, { artists: [{ artistId: artist.id, showBio: true, showCv: true, showPress: true, bioBackground, bioBackgroundCrop }] });
        expect((await put('/media/x2.jpg', bioCrop)).body.artists[0]).toMatchObject({ bioBackground: '/media/x2.jpg', bioBackgroundCrop: bioCrop });

        // Copied on duplicate.
        const copy = (await call('POST', `/admin/rooms/${room.id}/duplicate`)).body;
        expect(copy.coverCrop).toEqual(crop);
        expect(copy.artists[0].bioBackgroundCrop).toEqual(bioCrop);

        // Cleared with the image.
        expect((await put(null, bioCrop)).body.artists[0]).toMatchObject({ bioBackground: null, bioBackgroundCrop: null });
        const current = (await call('GET', `/admin/rooms/${room.id}`)).body;
        const cleared = await call('PATCH', `/admin/rooms/${room.id}`, { updatedAt: current.updatedAt, coverImage: null });
        expect(cleared.body).toMatchObject({ coverImage: null, coverCrop: null });

        // Restored from history: the revision saved with the bio crop brings it back.
        const revs = await db.selectFrom('content_revisions').select(['id', 'snapshot']).where('entity', '=', 'viewing_room').where('entity_id', '=', room.id).orderBy('id').execute();
        const withBoth = revs.find((r) => (r.snapshot as any).artists?.[0]?.bio_background_crop && (r.snapshot as any).cover_crop)!;
        expect((await call('POST', `/admin/revisions/${withBoth.id}/restore`)).status).toBe(200);
        const restored = (await call('GET', `/admin/rooms/${room.id}`)).body;
        expect(restored).toMatchObject({ coverImage: '/media/x1.jpg', coverCrop: crop });
        expect(restored.artists[0].bioBackgroundCrop).toEqual(bioCrop);

        // A new crop makes the PDF out of date.
        await call('POST', `/admin/rooms/${room.id}/pdf`);
        expect((await call('GET', `/admin/rooms/${room.id}/pdf`)).body.outdated).toBe(false);
        await call('PATCH', `/admin/rooms/${room.id}`, { updatedAt: restored.updatedAt, coverCrop: { x: 0, y: 0, w: 0.5, h: 0.5 } });
        expect((await call('GET', `/admin/rooms/${room.id}/pdf`)).body.outdated).toBe(true);
    });

    it('crops page photos to the chosen area', async () => {
        // Left half red, right half blue.
        const half = await sharp({ create: { width: 1000, height: 707, channels: 3, background: '#0000ff' } })
            .composite([{ input: await sharp({ create: { width: 500, height: 707, channels: 3, background: '#ff0000' } }).png().toBuffer(), left: 0, top: 0 }])
            .jpeg()
            .toBuffer();
        await storage.client.send(new PutObjectCommand({ Bucket: storage.bucket, Key: 'media/crop/two.jpg', Body: half, ContentType: 'image/jpeg' }));
        const left = { x: 0, y: 0.25, w: 0.45, h: 0.45 };
        const model: RoomPdfModel = {
            heading: 'A',
            subtitle: null,
            gallery: { name: 'Twelve Ten', email: '', phone: '' },
            cover: '/media/crop/two.jpg',
            coverCrop: left,
            works: [],
            bios: [{ name: 'B', paragraphs: ['Bio.'], background: '/media/crop/two.jpg', crop: { x: 0.55, y: 0.25, w: 0.45, h: 0.45 }, color: null }],
        };
        const images = await prepareRoomImages(storage, model);
        const stats = async (key: string) => (await sharp(images.get(key)!.data).stats()).channels.map((c) => c.mean);
        const cover = images.get(pageKey('/media/crop/two.jpg', left))!;
        expect(cover).toMatchObject({ width: pixelsFor(PAGE_W), height: pixelsFor(PAGE_H) });
        const [r1, , b1] = await stats(pageKey('/media/crop/two.jpg', left));
        expect(r1).toBeGreaterThan(200);
        expect(b1).toBeLessThan(40);
        const [r2, , b2] = await stats(pageKey('/media/crop/two.jpg', model.bios[0]!.crop));
        expect(r2).toBeLessThan(40);
        expect(b2).toBeGreaterThan(200);
    });

    it('sizes PDF images to 250 dpi where they are drawn, using the zoom copy or original when the display copy is too small', async () => {
        const put = async (key: string, width: number, height: number, background = '#778899') => {
            const body = await sharp({ create: { width, height, channels: 3, background } }).jpeg().toBuffer();
            await storage.client.send(new PutObjectCommand({ Bucket: storage.bucket, Key: key, Body: body, ContentType: 'image/jpeg' }));
        };
        // Portrait work with a 2400px display copy and a 6000px zoom copy; landscape work with only a huge original.
        await put('media/dpi/portrait.jpg', 4500, 6000);
        await put('media/derived/dpi/portrait.jpg/w2400.webp', 1800, 2400, '#ff0000');
        await put('media/derived/dpi/portrait.jpg/zoom.jpg', 4500, 6000, '#0000ff');
        await put('media/dpi/wide.jpg', 8000, 5000);
        const work = (image: string) => ({ artistName: 'A', title: 'T', dateText: '2026', medium: null, dimensions: null, edition: null, price: null, statusLabel: null, image });
        const model: RoomPdfModel = {
            heading: 'A',
            subtitle: null,
            gallery: { name: 'Twelve Ten', email: '', phone: '' },
            cover: '/media/dpi/portrait.jpg',
            coverCrop: null,
            works: [work('/media/dpi/portrait.jpg'), work('/media/dpi/wide.jpg')],
            bios: [],
        };
        const images = await prepareRoomImages(storage, model);
        const expectDpi = (key: string, w: number, h: number) => {
            const p = workImagePlacement(model.works[0]!, w, h);
            const img = images.get(key)!;
            expect(img.width).toBeLessThanOrEqual(pixelsFor(p.width));
            expect(img.height).toBeLessThanOrEqual(pixelsFor(p.height));
            // At least as sharp as 250 dpi, give or take rounding.
            expect(img.width).toBeGreaterThanOrEqual(pixelsFor(p.width) - 2);
        };
        expectDpi('/media/dpi/portrait.jpg', 4500, 6000);
        expectDpi('/media/dpi/wide.jpg', 8000, 5000);
        // The portrait work fills the page height (2067px at 250 dpi): the 2400px display copy (red) is enough.
        const color = async (key: string) => (await sharp(images.get(key)!.data).stats()).dominant;
        expect(images.get('/media/dpi/portrait.jpg')!.height).toBe(pixelsFor(PAGE_H));
        expect((await color('/media/dpi/portrait.jpg')).r).toBeGreaterThan(200);
        // The cover fills the page (2924px wide): too much for the display copy, so the zoom copy (blue) is used.
        expect(images.get(pageKey('/media/dpi/portrait.jpg'))).toMatchObject({ width: pixelsFor(PAGE_W), height: pixelsFor(PAGE_H) });
        expect((await color(pageKey('/media/dpi/portrait.jpg'))).b).toBeGreaterThan(200);
    });

    it('lets admins preview any room without tracking', async () => {
        const { room } = await setupRoom('Preview Room');
        const res = await call('GET', `/rooms/${room.token}?preview=1`);
        expect(res.status).toBe(200);
        expect(res.body.room).toMatchObject({ visitId: null, viewer: null });
        expect(res.body.room.works).toHaveLength(3);
        // Malformed tokens are plain 404s.
        expect((await call('GET', '/rooms/short')).status).toBe(404);
    });
});
