import { test, expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';

/**
 * Viewing rooms end to end: an admin builds a room from the inventory, a visitor goes through the
 * gate and browses (grid, slideshow, zoom, artist details, Inquire), the collector profile shows the
 * room with an engagement rating and the visitor dashboard, unavailable works, and merging a duplicate
 * sign-up. Everything created here is removed again.
 */
test.describe.configure({ mode: 'serial' });
test.use({ storageState: 'e2e/.auth/admin.json' });

const ARTIST = 'Ezra Roomtest';
const VIEWER = 'Vera Viewer';
const VIEWER_EMAIL = 'vera.viewer@example.com';
const DUPE_EMAIL = 'vera.v@elsewhere.example';
const TITLE = 'E2E viewing room';

const errors: string[] = [];
test.beforeEach(async ({ page }) => {
    page.on('pageerror', (e) => errors.push(e.message));
});
test.afterEach(() => {
    expect(errors, 'no uncaught errors in the page').toEqual([]);
    errors.length = 0;
});

const admin = (r: APIRequestContext) => ({
    get: async (path: string) => (await r.get(`/api/admin${path}`)).json(),
    send: async (method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, data?: unknown) => {
        const res = await r.fetch(`/api/admin${path}`, { method, data });
        return res.status() === 204 ? null : res.json();
    },
});

const state = { artistId: '', workIds: [] as string[], roomId: '', link: '' };

async function cleanup(r: APIRequestContext) {
    const a = admin(r);
    for (const room of (await a.get(`/rooms?q=${encodeURIComponent(TITLE)}`)).items ?? []) {
        const dash = await a.get(`/rooms/${room.id}/dashboard`);
        for (const v of dash.visitors) await a.send('DELETE', `/rooms/${room.id}/visitors/${v.id}`);
        await a.send('DELETE', `/rooms/${room.id}`);
    }
    for (const q of [VIEWER, 'Vera V']) {
        for (const p of (await a.get(`/persons?q=${encodeURIComponent(q)}&limit=50`)).items ?? []) {
            if (!p.name.startsWith('Vera')) continue;
            await a.send('DELETE', `/persons/${p.id}/collector-profile`);
            await a.send('DELETE', `/persons/${p.id}`);
        }
    }
    for (const p of (await a.get(`/persons?q=${encodeURIComponent(ARTIST)}`)).items ?? []) {
        const full = await a.get(`/persons/${p.id}`);
        for (const w of full.artistProfile?.works ?? []) await a.send('DELETE', `/works/${w.id}`);
        for (const pr of full.artistProfile?.press.filter((x: { direct: boolean }) => x.direct) ?? []) await a.send('DELETE', `/persons/${p.id}/artist-profile/press/${pr.id}`);
        if (full.artistProfile) await a.send('DELETE', `/persons/${p.id}/artist-profile`);
        await a.send('DELETE', `/persons/${p.id}`);
    }
}

/** A visitor's browser: no admin session. */
async function visitor(browser: Browser): Promise<Page> {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    return page;
}

test.beforeAll(async ({ request }) => {
    await cleanup(request);
    const a = admin(request);
    // An image the site already has, so zoom has real pixels.
    const exhibitions = (await (await request.get('/api/exhibitions')).json()).items;
    let image = '';
    for (const e of exhibitions) {
        const ex = await (await request.get(`/api/exhibitions/${e.slug}`)).json();
        image = ex.artworks?.find((s: { image: string | null }) => s.image)?.image ?? '';
        if (image) break;
    }

    const artist = await a.send('POST', '/persons', { name: ARTIST, profiles: ['artist'] });
    state.artistId = artist.id;
    const doc = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] });
    await a.send('PUT', `/persons/${artist.id}/artist-profile`, { bio: doc('Ezra paints harbours.'), cv: doc('MFA, 2010'), updatedAt: artist.artistProfile.updatedAt });
    await a.send('POST', `/persons/${artist.id}/artist-profile/press`, { press: { outlet: 'Harbour Weekly', title: 'Ezra at sea', url: 'https://example.com/e2e-room/a', publishedOn: '2025-03-01' } });
    await a.send('POST', `/persons/${artist.id}/artist-profile/press`, { press: { outlet: 'Hidden Gazette', title: 'Not for this room', url: 'https://example.com/e2e-room/b', publishedOn: '2025-04-01' } });
    for (const [title, priceCents] of [
        ['Roomtest Harbour', 480000],
        ['Roomtest Dusk', 120000],
    ] as const) {
        state.workIds.push((await a.send('POST', '/works', { artistId: artist.id, title, dateText: '2025', medium: 'Oil on linen', priceCents, images: [{ url: image, alt: title }] })).id);
    }
});

test.afterAll(async ({ request }) => {
    await cleanup(request);
});

test('an admin creates a room from the inventory', async ({ page }) => {
    await page.goto('/admin/rooms');
    await page.getByRole('link', { name: '+ New room' }).click();
    await page.getByLabel('Title', { exact: true }).fill(TITLE);
    await page.getByLabel('Status', { exact: true }).selectOption('live');
    await page.getByTestId('add-room-works').click();
    await page.getByLabel('Search works').fill('Roomtest');
    const results = page.getByTestId('room-work-results');
    await results.getByLabel(`${ARTIST}, Roomtest Harbour`).check();
    await results.getByLabel(`${ARTIST}, Roomtest Dusk`).check();
    await page.getByRole('button', { name: 'Done (2)' }).click();
    await expect(page.getByTestId('room-works').locator('li')).toHaveCount(2);
    await page.getByTestId('save-room').click();
    await expect(page.getByTestId('room-link')).toHaveValue(/\/rooms\/[A-Za-z0-9_-]{43}$/);
    state.link = await page.getByTestId('room-link').inputValue();
    state.roomId = page.url().split('/').pop()!;

    // Hide one press item for this room.
    const settings = page.getByTestId('room-artist-settings');
    await settings.getByText('Choose press').click();
    await settings.getByLabel(/Not for this room/).uncheck();
    await page.getByTestId('save-room').click();
    await expect(page.getByText('● Unsaved changes')).toHaveCount(0);
});

test('a visitor enters through the gate and the browser is remembered', async ({ browser }) => {
    const page = await visitor(browser);
    const path = new URL(state.link).pathname;
    await page.goto(path);
    const gate = page.getByTestId('room-gate');
    await expect(gate.getByRole('heading', { name: TITLE })).toBeVisible();
    await expect(gate).toContainText('We record how you browse this room');
    await gate.getByLabel('Name').fill(VIEWER);
    await gate.getByLabel('Email').fill(VIEWER_EMAIL);
    await gate.getByRole('button', { name: 'View the room' }).click();
    await expect(page.getByText(`Welcome, ${VIEWER}.`)).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('room-gate')).toHaveCount(0);
    await expect(page.getByText(`Welcome, ${VIEWER}.`)).toBeVisible();

    // Prices are off: no price, and Inquire asks about the work.
    await expect(page.getByTestId('room-price')).toHaveCount(0);
    const href = await page.getByTestId('room-inquire').getAttribute('href');
    const mail = new URL(href!);
    expect(mail.searchParams.get('subject')).toBe(`Inquiry: ${ARTIST}, Roomtest Harbour, 2025`);
    expect(mail.searchParams.get('body')).toContain(`— ${VIEWER}`);
    await page.getByTestId('room-inquire').evaluate((a) => a.addEventListener('click', (e) => e.preventDefault()));
    await page.getByTestId('room-inquire').click();

    // Zoom with the keyboard, then close.
    await page.getByRole('button', { name: 'Zoom', exact: true }).click();
    const viewer = page.getByTestId('zoom-viewer');
    await expect(viewer).toBeVisible();
    const before = await viewer.getByTestId('zoom-level').textContent();
    await page.keyboard.press('+');
    await expect(viewer.getByTestId('zoom-level')).not.toHaveText(before!);
    await page.mouse.move(640, 400);
    await page.mouse.move(660, 420, { steps: 5 });
    await page.keyboard.press('Escape');
    await expect(viewer).toHaveCount(0);

    // Grid, then the next work in the slideshow.
    await page.getByRole('button', { name: 'Grid' }).click();
    await expect(page.getByTestId('room-tile')).toHaveCount(2);
    await page.getByRole('button', { name: `Open ${ARTIST}, Roomtest Dusk, 2025` }).click();
    await expect(page.getByTestId('room-slide')).toContainText('Roomtest Dusk');

    // The artist: bio, CV, press minus the hidden item.
    await page.getByRole('button', { name: 'About the artist' }).click();
    const artist = page.getByTestId('room-artist');
    await expect(artist).toContainText('Ezra paints harbours.');
    await artist.getByRole('button', { name: 'Read CV' }).click();
    await expect(artist.getByTestId('room-cv')).toContainText('MFA, 2010');
    await expect(artist.getByTestId('room-press')).toHaveCount(1);
    await expect(artist).not.toContainText('Not for this room');
    await expect(artist.getByRole('link', { name: 'Download CV (PDF)' })).toHaveAttribute('href', /cv\.pdf$/);

    // Leaving the page sends what was recorded.
    await page.close({ runBeforeUnload: true });
});

test('the collector profile shows the room, engagement and the visitor dashboard', async ({ page, request }) => {
    const a = admin(request);
    await expect
        .poll(async () => (await a.get(`/rooms/${state.roomId}/dashboard`)).totals.inquiries, { timeout: 15_000 })
        .toBe(1);
    const person = (await a.get(`/persons?q=${encodeURIComponent(VIEWER_EMAIL)}`)).items[0];
    expect(person).toMatchObject({ name: VIEWER, profiles: ['collector'] });

    await page.goto(`/admin/people/${person.id}/collector`);
    const rooms = page.getByTestId('collector-rooms');
    await expect(rooms.getByRole('link', { name: TITLE })).toBeVisible();
    await expect(rooms.getByText('Inquired')).toBeVisible();
    await expect(rooms.getByTestId('engagement')).toBeVisible();
    await rooms.getByRole('link', { name: TITLE }).click();

    await expect(page.getByRole('heading', { name: `${VIEWER} in “${TITLE}”` })).toBeVisible();
    await expect(page.getByTestId('visitor-work').first()).toContainText('Roomtest Harbour');
    await expect(page.getByTestId('visitor-timeline')).toContainText('Inquired about Roomtest Harbour');
    await expect(page.getByTestId('visitor-timeline')).toContainText('Read the CV of');
});

test('sold works show their status without Inquire, and can be hidden', async ({ browser, request }) => {
    const a = admin(request);
    const w = await a.get(`/works/${state.workIds[0]}`);
    await a.send('PATCH', `/works/${w.id}`, { updatedAt: w.updatedAt, status: 'sold' });
    const page = await visitor(browser);
    // A new browser goes through the gate again (same email: same person).
    await page.goto(new URL(state.link).pathname);
    await page.getByLabel('Name').fill(VIEWER);
    await page.getByLabel('Email').fill(VIEWER_EMAIL);
    await page.getByRole('button', { name: 'View the room' }).click();
    await expect(page.getByTestId('room-status')).toHaveText('Sold');
    await expect(page.getByTestId('room-inquire')).toHaveCount(0);

    const room = await a.get(`/rooms/${state.roomId}`);
    await a.send('PUT', `/rooms/${state.roomId}/works`, { works: room.works.map((x: { workId: string }) => ({ workId: x.workId, hidden: x.workId === w.id })) });
    await page.reload();
    await expect(page.getByTestId('room-slide')).toContainText('Roomtest Dusk');
    await expect(page.getByText('Roomtest Harbour')).toHaveCount(0);
    await page.context().close();
});

test('a duplicate sign-up is suggested and merged', async ({ browser, page, request }) => {
    const other = await visitor(browser);
    await other.goto(new URL(state.link).pathname);
    await other.getByLabel('Name').fill(VIEWER);
    await other.getByLabel('Email').fill(DUPE_EMAIL);
    await other.getByRole('button', { name: 'View the room' }).click();
    await expect(other.getByText(`Welcome, ${VIEWER}.`)).toBeVisible();
    await other.context().close();

    await page.goto('/admin/people/duplicates');
    const pair = page.getByTestId('duplicate-pair').filter({ hasText: DUPE_EMAIL });
    await expect(pair).toContainText('Same name');
    await pair.getByRole('button', { name: 'Compare & merge…' }).click();
    await page.getByTestId('confirm-merge').click();
    await expect(page.getByTestId('other-emails')).toContainText(/vera/);

    const a = admin(request);
    const people = (await a.get(`/persons?q=${encodeURIComponent(VIEWER)}`)).items;
    expect(people).toHaveLength(1);
    const merged = await a.get(`/persons/${people[0].id}`);
    expect([merged.email, ...merged.emails].sort()).toEqual([DUPE_EMAIL, VIEWER_EMAIL].sort());
    expect(merged.collectorProfile.viewingRooms).toHaveLength(1);
});
