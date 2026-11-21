import { test, expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';

/**
 * Viewing rooms end to end: an admin builds a room from the inventory, a visitor goes through the
 * gate and browses (grid, zoom, artist details, Inquire), the collector profile shows the
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
const SUBTITLE = 'Test Fair 2026';

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
            const full = await a.get(`/persons/${p.id}`);
            for (const i of full.collectorProfile?.inquiries ?? []) await a.send('DELETE', `/inquiries/${i.id}`);
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
    await page.getByLabel('Subtitle (optional)').fill(SUBTITLE);
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
    await settings.getByText('Choose which press to show').click();
    await settings.getByLabel(/Not for this room/).uncheck();
    await page.getByTestId('save-room').click();
    await expect(page.getByText('● Unsaved changes')).toHaveCount(0);

    // The PDF is made on request from the saved room, then offered for download.
    const status = page.getByTestId('room-pdf-status');
    await expect(status).toContainText('Not generated yet');
    await expect(page.getByRole('link', { name: 'Download PDF' })).toHaveCount(0);
    await page.getByLabel('Subtitle (optional)').fill(`${SUBTITLE} (draft)`);
    await expect(page.getByTestId('generate-room-pdf')).toBeDisabled();
    await page.getByLabel('Subtitle (optional)').fill(SUBTITLE);
    await page.getByTestId('generate-room-pdf').click();
    await expect(status).toContainText('Generated');
    await expect(page.getByTestId('generate-room-pdf')).toHaveText('Regenerate PDF');
    const pdfLink = page.getByRole('link', { name: 'Download PDF' });
    await expect(pdfLink).toHaveAttribute('href', `/api/admin/rooms/${state.roomId}/room.pdf`);
    const pdf = await page.request.get(`/api/admin/rooms/${state.roomId}/room.pdf`);
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');

    // A solid colour behind the artist's bio page: saved with the room, and the PDF is then out of date.
    const bioBg = page.getByTestId('bio-background');
    // White until a colour is picked.
    await expect(bioBg.getByLabel(`Bio page colour for ${ARTIST}`)).toHaveValue('#ffffff');
    await bioBg.getByLabel(`Bio page colour for ${ARTIST}`).fill('#203040');
    await page.getByTestId('save-room').click();
    await expect(page.getByText('● Unsaved changes')).toHaveCount(0);
    await expect(status).toContainText('Out of date');
    await page.reload();
    await expect(page.getByTestId('bio-background').getByLabel(`Bio page colour for ${ARTIST}`)).toHaveValue('#203040');
    await page.getByTestId('generate-room-pdf').click();
    await expect(page.getByTestId('room-pdf-status')).toContainText('Generated');

    // Shipping labels for the room's works: a typed destination, the gallery's return address by default.
    await page.getByRole('button', { name: 'Room settings' }).click();
    await page.getByTestId('room-shipping-labels').click();
    const labels = page.getByRole('dialog', { name: 'Shipping labels' });
    await expect(labels.getByTestId('label-make')).toBeDisabled();
    await expect(labels.getByTestId('label-return-gallery')).toBeChecked();
    await labels.getByLabel('Ship to').fill('Avery Sample\n100 Example Street\nTulsa, OK 74103');
    await labels.getByTestId('label-return-other').check();
    await expect(labels.getByTestId('label-make')).toBeDisabled();
    await labels.getByLabel('Other return address').fill('Studio\n1 Back Lane');
    await labels.getByTestId('label-make').click();
    await expect(labels.getByTestId('label-download')).toHaveAttribute('download', `Shipping labels - ${TITLE}.pdf`);
    await expect(labels.getByTestId('label-open')).toHaveAttribute('href', /^blob:/);
});

test('a visitor enters through the gate and the browser is remembered', async ({ browser }) => {
    const page = await visitor(browser);
    const path = new URL(state.link).pathname;
    await page.goto(path);
    const gate = page.getByTestId('room-gate');
    await expect(gate.getByRole('heading', { name: TITLE })).toBeVisible();
    await expect(gate).toContainText(SUBTITLE);
    await expect(gate).toContainText('We record how you browse this room');
    await gate.getByLabel('Name').fill(VIEWER);
    await gate.getByLabel('Email').fill(VIEWER_EMAIL);
    await gate.getByRole('button', { name: 'View the room' }).click();
    await expect(page.getByText(`Welcome, ${VIEWER}.`)).toBeVisible();
    await expect(page.getByTestId('room-subtitle')).toHaveText(SUBTITLE);
    await expect(page.getByRole('link', { name: 'Download PDF' })).toHaveAttribute('href', /\/api\/rooms\/[A-Za-z0-9_-]{43}\/room\.pdf$/);
    await page.reload();
    await expect(page.getByTestId('room-gate')).toHaveCount(0);
    await expect(page.getByText(`Welcome, ${VIEWER}.`)).toBeVisible();

    // The room opens on the grid with every work's details; prices are off: no price.
    await expect(page.getByTestId('room-tile')).toHaveCount(2);
    await expect(page.getByTestId('room-price')).toHaveCount(0);

    // An image opens zoom on that work; closing it returns to the grid.
    const viewer = page.getByTestId('zoom-viewer');
    await page.getByRole('button', { name: `Zoom ${ARTIST}, Roomtest Dusk, 2025` }).click();
    await expect(viewer.getByTestId('zoom-details')).toContainText('Roomtest Dusk');
    await viewer.getByRole('button', { name: 'Close' }).click();
    await expect(viewer).toHaveCount(0);
    await expect(page.getByTestId('room-tile')).toHaveCount(2);

    // Zoom with the keyboard, move between works, then Inquire from zoom: a form that already knows the viewer.
    await page.getByRole('button', { name: new RegExp(`^Zoom ${ARTIST}, Roomtest Harbour`) }).click();
    await expect(viewer.getByTestId('zoom-details')).toContainText('Roomtest Harbour');
    const before = await viewer.getByTestId('zoom-level').textContent();
    await page.keyboard.press('+');
    await expect(viewer.getByTestId('zoom-level')).not.toHaveText(before!);
    await page.mouse.move(640, 400);
    await page.mouse.move(660, 420, { steps: 5 });
    await page.keyboard.press('0');
    await page.keyboard.press('ArrowRight');
    await expect(viewer.getByTestId('zoom-details')).toContainText('Roomtest Dusk');
    await page.keyboard.press('ArrowLeft');
    await expect(viewer.getByTestId('zoom-details')).toContainText('Roomtest Harbour');
    await viewer.getByTestId('room-inquire').click();
    await expect(viewer).toHaveCount(0);
    const inquiry = page.getByTestId('inquiry-dialog');
    await expect(inquiry.getByTestId('inquiry-item')).toContainText('Roomtest Harbour');
    await expect(inquiry.getByTestId('inquiry-known')).toContainText(VIEWER);
    await inquiry.getByLabel(/Note/).fill('Is this framed?');
    await inquiry.getByRole('button', { name: 'Send inquiry' }).click();
    await expect(inquiry.getByTestId('inquiry-sent')).toBeVisible();
    await inquiry.getByRole('button', { name: 'Close' }).last().click();
    await expect(inquiry).not.toBeVisible();

    // The artist: bio, CV, press minus the hidden item.
    // One artist in this room: no "About the artist" on the works, the Artist tab instead.
    await expect(page.getByRole('button', { name: 'About the artist' })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Artist' }).click();
    const artist = page.getByTestId('room-artist');
    await expect(artist).toHaveCount(1);
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
    await expect(page.getByTestId('visitor-timeline')).toContainText('Inquired about Roomtest Harbour: “Is this framed?”');
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
    const harbour = page.getByTestId('room-tile').filter({ hasText: 'Roomtest Harbour' });
    await expect(harbour.getByTestId('room-status')).toHaveText('Sold');
    await expect(harbour.getByTestId('room-inquire')).toHaveCount(0);

    const room = await a.get(`/rooms/${state.roomId}`);
    await a.send('PUT', `/rooms/${state.roomId}/works`, { works: room.works.map((x: { workId: string }) => ({ workId: x.workId, hidden: x.workId === w.id })) });
    await page.reload();
    await expect(page.getByTestId('room-tile')).toHaveCount(1);
    await expect(page.getByTestId('room-tile')).toContainText('Roomtest Dusk');
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

test('the PDF can be hidden from visitors, then removed', async ({ page, browser }) => {
    await page.goto(`/admin/rooms/${state.roomId}`);
    const status = page.getByTestId('room-pdf-status');
    // Generated in the first test (out of date by now: works were sold and hidden since).
    await expect(status).toContainText(/\d MB/);

    // Admin preview offers the download too, without recording it.
    const roomPath = new URL(state.link).pathname;
    await page.goto(`${roomPath}?preview=1`);
    const previewLink = page.getByRole('link', { name: 'Download PDF' });
    await expect(previewLink).toHaveAttribute('href', /\/room\.pdf\?preview=1$/);
    expect((await page.request.get((await previewLink.getAttribute('href'))!)).status()).toBe(200);
    await page.goto(`/admin/rooms/${state.roomId}`);

    await page.getByRole('switch', { name: 'Offer to visitors' }).click();
    await page.getByTestId('save-room').click();
    await expect(page.getByText('● Unsaved changes')).toHaveCount(0);
    await expect(status).toContainText('Hidden from visitors');

    // A returning visitor no longer sees the download.
    const visitorPage = await visitor(browser);
    const path = new URL(state.link).pathname;
    await visitorPage.goto(path);
    await visitorPage.getByTestId('room-gate').getByLabel('Name').fill(VIEWER);
    await visitorPage.getByTestId('room-gate').getByLabel('Email').fill(VIEWER_EMAIL);
    await visitorPage.getByRole('button', { name: 'View the room' }).click();
    await expect(visitorPage.getByText(`Welcome, ${VIEWER}.`)).toBeVisible();
    await expect(visitorPage.getByRole('link', { name: 'Download PDF' })).toHaveCount(0);
    await visitorPage.close();

    await page.getByTestId('remove-room-pdf').click();
    await page.getByTestId('confirm-remove-pdf').click();
    await expect(status).toContainText('Not generated yet');
    await expect(page.getByRole('link', { name: 'Download PDF' })).toHaveCount(0);
    expect((await page.request.get(`/api/admin/rooms/${state.roomId}/room.pdf`)).status()).toBe(404);
});

test('a room is duplicated as a draft, and closed rooms are hidden from the list until asked for', async ({ page }) => {
    await page.goto(`/admin/rooms/${state.roomId}`);
    await page.getByRole('button', { name: 'Room settings' }).click();
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${TITLE} (copy)`);
    const copyId = page.url().split('/').pop()!;
    expect(copyId).not.toBe(state.roomId);
    await expect(page.getByTestId('room-works').locator('li')).toHaveCount(2);
    await expect(page.getByTestId('room-link')).not.toHaveValue(state.link);

    // Close the original: it leaves the default list, and ticking Closed brings it back.
    await page.goto(`/admin/rooms/${state.roomId}`);
    await page.getByLabel('Status', { exact: true }).selectOption('closed');
    await page.getByTestId('save-room').click();
    await expect(page.getByText('● Unsaved changes')).toHaveCount(0);

    await page.goto(`/admin/rooms?q=${encodeURIComponent(TITLE)}`);
    const rows = page.getByTestId('room-row');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText(`${TITLE} (copy)`);
    // The status dropdown: Draft and Live by default.
    const filter = page.getByTestId('room-status-filter');
    await expect(filter).toHaveText('Draft, Live');
    await filter.click();
    const option = (name: string) => page.getByRole('menuitemcheckbox', { name });
    await option('Closed').click();
    await expect(rows).toHaveCount(2);
    await expect(filter).toHaveText('All');
    await expect(page).toHaveURL(/status=draft%2Clive%2Cclosed|status=draft,live,closed/);
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(rows).toHaveCount(2);

    // Only Closed; the last ticked status can't be unticked.
    await filter.click();
    await option('Draft').click();
    await option('Live').click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).not.toContainText('(copy)');
    await expect(option('Closed')).toHaveAttribute('data-disabled', '');
    await page.keyboard.press('Escape');
    await expect(filter).toHaveText('Closed');

    // A room that has gone live opens on its dashboard, with Edit beside it; a draft opens in the editor.
    await expect(rows.first().getByRole('link', { name: 'Edit' })).toBeVisible();
    await rows.first().getByRole('link', { name: new RegExp(TITLE) }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/rooms/${state.roomId}/dashboard$`));
    await page.goto(`/admin/rooms?q=${encodeURIComponent(TITLE)}`);
    await rows.first().getByRole('link', { name: /\(copy\)/ }).click();
    await expect(page).toHaveURL(/\/admin\/rooms\/[0-9a-f-]{36}$/);
});

test('the PDF cover and bio photo are chosen from the room’s images and cropped', async ({ page }) => {
    await page.goto(`/admin/rooms/${state.roomId}`);
    const cover = page.getByTestId('room-cover');
    // No cover chosen: the picker opens on the first work, already framed.
    await cover.getByRole('button', { name: 'Choose…' }).click();
    const dialog = page.getByRole('dialog', { name: 'PDF cover image' });
    await expect(dialog.getByRole('button', { name: 'Roomtest Harbour', exact: true })).toHaveAttribute('aria-pressed', 'true');
    const frame = dialog.getByTestId('crop-frame');
    await expect(frame).toBeVisible();
    // Shrink from a corner, then drag the frame.
    const handle = await dialog.getByTestId('crop-se').boundingBox();
    await page.mouse.move(handle!.x + 6, handle!.y + 6);
    await page.mouse.down();
    await page.mouse.move(handle!.x - 80, handle!.y - 80, { steps: 5 });
    await page.mouse.up();
    const box = await frame.boundingBox();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2 + 30, box!.y + box!.height / 2 + 20, { steps: 5 });
    await page.mouse.up();
    await dialog.getByTestId('use-image').click();
    await expect(dialog).toBeHidden();
    await expect(cover.getByRole('button', { name: 'Change…' })).toBeVisible();
    await page.getByTestId('save-room').click();
    await expect(page.getByText('● Unsaved changes')).toHaveCount(0);

    const saved = await (await page.request.get(`/api/admin/rooms/${state.roomId}`)).json();
    expect(saved.coverCrop.w).toBeLessThan(1);
    expect(saved.coverCrop.x).toBeGreaterThan(0);

    // A bio photo from the same images; the colour input gives way to it.
    const bioBg = page.getByTestId('bio-background');
    await bioBg.getByRole('button', { name: 'Choose…' }).click();
    const bioDialog = page.getByRole('dialog', { name: `PDF bio page photo for ${ARTIST}` });
    await expect(bioDialog.getByTestId('crop-frame')).toBeVisible();
    await bioDialog.getByTestId('use-image').click();
    await expect(bioBg.getByLabel(`Bio page colour for ${ARTIST}`)).toHaveCount(0);
    await page.getByTestId('save-room').click();
    await expect(page.getByText('● Unsaved changes')).toHaveCount(0);
    await page.getByTestId('generate-room-pdf').click();
    // (Hidden from visitors since an earlier test.)
    await expect(page.getByTestId('room-pdf-status')).toContainText(/generated .* MB/i);
});
