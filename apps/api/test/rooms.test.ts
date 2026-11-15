import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.ts';
import { adminHarness } from './admin-harness.ts';

const { call, db } = adminHarness();

/** A browser: keeps the room cookie between requests (scoped to its path). */
function browser(opts: { ip?: string } = {}) {
    const jar = new Map<string, { value: string; path: string }>();
    const app = createApp({ db: () => db, siteUrl: 'http://localhost:5173' });
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
        expect(gate.body).toEqual({ gate: { title: 'Gate Room' } });
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
