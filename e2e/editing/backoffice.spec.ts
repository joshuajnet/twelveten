import { test, expect, type Page } from '@playwright/test';

/**
 * Back office (people, artist profiles, inventory) and linking exhibition slides to artists.
 * Runs against the local API with seeded data; everything created here is removed again.
 */
test.describe.configure({ mode: 'serial' });
test.use({ storageState: 'e2e/.auth/admin.json' });

// 1×1 PNG, uploaded as a work image.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

const errors: string[] = [];
test.beforeEach(async ({ page }) => {
    page.on('pageerror', (e) => errors.push(e.message));
});
test.afterEach(() => {
    expect(errors, 'no uncaught errors in the page').toEqual([]);
    errors.length = 0;
});

const api = (page: Page) => ({
    get: async (path: string) => (await page.request.get(`/api/admin${path}`)).json(),
    send: (method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', path: string, data?: unknown) => page.request.fetch(`/api/admin${path}`, { method, data }),
});

async function findPerson(page: Page, name: string): Promise<any | null> {
    const { items } = await api(page).get(`/persons?q=${encodeURIComponent(name)}&limit=50`);
    return items.find((p: { name: string }) => p.name === name) ?? null;
}

/** Delete a person (and their invoices, profiles and works) created by these tests. */
async function removePerson(page: Page, name: string) {
    const summary = await findPerson(page, name);
    if (!summary) return;
    const p = await api(page).get(`/persons/${summary.id}`);
    // Invoices first (their payments, then the invoice), then the collector profile.
    for (const i of p.collectorProfile?.invoices ?? []) {
        const inv = await api(page).get(`/invoices/${i.id}`);
        for (const pay of inv.payments) await api(page).send('DELETE', `/invoices/${i.id}/payments/${pay.id}`);
        await api(page).send('DELETE', `/invoices/${i.id}`);
    }
    if (p.collectorProfile) await api(page).send('DELETE', `/persons/${p.id}/collector-profile`);
    for (const w of p.artistProfile?.works ?? []) {
        const work = await api(page).get(`/works/${w.id}`);
        for (const s of work.slides) {
            const slide = (await api(page).get(`/exhibitions/${s.exhibitionId}`)).artworks.find((a: { id: string }) => a.id === s.artworkId);
            await api(page).send('PATCH', `/artworks/${s.artworkId}`, { updatedAt: slide.updatedAt, workId: null });
        }
        await api(page).send('DELETE', `/works/${w.id}`);
    }
    if (p.artistProfile) {
        // Unlinking direct press deletes items nothing else uses.
        for (const pr of p.artistProfile.press.filter((x: { direct: boolean }) => x.direct)) await api(page).send('DELETE', `/persons/${p.id}/artist-profile/press/${pr.id}`);
        await api(page).send('PUT', `/persons/${p.id}/artist-profile/exhibitions`, { exhibitionIds: [] });
        await api(page).send('DELETE', `/persons/${p.id}/artist-profile`);
    }
    await api(page).send('DELETE', `/persons/${p.id}`);
}

test('signed-out visitors are sent to sign in', async ({ browser }) => {
    const anon = await browser.newPage({ storageState: { cookies: [], origins: [] } });
    await anon.goto('/admin/people');
    await expect(anon).toHaveURL(/\/admin\/login\?next=/);
    await expect(anon.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await anon.close();
});

test('people list: profile filter, plain people, and opening an artist', async ({ page }) => {
    await removePerson(page, 'E2E Plain Person');
    try {
        await page.goto('/admin');
        await expect(page).toHaveURL(/\/admin\/people$/);
        await expect(page.getByRole('heading', { level: 1, name: 'People' })).toBeVisible();

        // A person without a profile.
        await page.getByRole('button', { name: '+ New person' }).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel('Name').fill('E2E Plain Person');
        await dialog.getByLabel('Add an artist profile').uncheck();
        await dialog.getByRole('button', { name: 'Create' }).click();
        await expect(page.getByRole('heading', { level: 1, name: 'E2E Plain Person' })).toBeVisible();
        await expect(page.getByText('E2E Plain Person has no profiles yet.')).toBeVisible();
        await expect(page.getByTestId('artist-panel')).toHaveCount(0);

        // Filters: Artists / No profile / All, kept in the URL across reloads.
        await page.getByRole('link', { name: '← Back to people' }).click();
        const group = page.getByRole('group', { name: 'Profile type' });
        await group.getByRole('button', { name: 'Artists' }).click();
        await expect(page).toHaveURL(/profile=artist/);
        await expect(page.getByRole('heading', { level: 1, name: 'Artists' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Noelle Africh', exact: true })).toBeVisible();
        await expect(page.getByRole('link', { name: 'E2E Plain Person' })).toHaveCount(0);
        await page.reload();
        await expect(group.getByRole('button', { name: 'Artists' })).toHaveAttribute('aria-pressed', 'true');

        // Numbered pages of 25; the page is in the URL and a filter change goes back to page 1.
        await expect(page.getByText(/^Showing 1–25 of \d+ people$/)).toBeVisible();
        await expect(page.getByRole('columnheader', { name: 'Born' })).toHaveCount(0);
        const pages = page.getByRole('navigation', { name: 'people pages' });
        await pages.getByRole('button', { name: 'Next →' }).click();
        await expect(page).toHaveURL(/page=2/);
        await expect(pages.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
        await expect(page.getByText(/^Showing 26–\d+ of \d+ people$/)).toBeVisible();
        await expect(page.getByRole('link', { name: 'Noelle Africh', exact: true })).toHaveCount(0);
        await page.reload();
        await expect(pages.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
        await pages.getByRole('button', { name: 'Page 1' }).click();
        await expect(page).not.toHaveURL(/page=/);

        await group.getByRole('button', { name: 'No profile' }).click();
        await expect(page.getByRole('link', { name: 'E2E Plain Person' })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Noelle Africh', exact: true })).toHaveCount(0);
        await group.getByRole('button', { name: 'All' }).click();
        await page.getByRole('searchbox', { name: 'Search people' }).fill('E2E Plain');
        await expect(page.getByRole('link', { name: 'E2E Plain Person' })).toBeVisible();

        // Clicking a row (any cell) with the Artists filter opens the artist profile; Back keeps the filter.
        await page.goto('/admin/people?profile=artist');
        const row = page.locator('tbody tr', { hasText: 'Collin Leitch' });
        // The name link's overlay covers the row, so a click on another cell lands on it.
        await row.locator('td').nth(2).click({ force: true });
        await expect(page).toHaveURL(/\/admin\/people\/[0-9a-f-]{36}\/artist$/);
        const name = page.getByRole('heading', { level: 1, name: 'Collin Leitch' });
        const panel = page.getByTestId('artist-panel');
        await expect(name).toBeVisible();
        await expect(panel).toBeVisible();
        // Details come first, then the profile's management features.
        expect((await name.boundingBox())!.y).toBeLessThan((await panel.boundingBox())!.y);
        await expect(panel.getByRole('link', { name: 'The Darling Maneuver', exact: true })).toBeVisible();
        // Press about that exhibition, linking out to the article.
        const press = panel.getByRole('region', { name: /^Press/ });
        await expect(press.getByRole('link', { name: /Collin Leitch Frames Nature Through the Machine/ })).toHaveAttribute('href', /art\.newcity\.com/);
        await expect(press.getByText('Newcity Art')).toBeVisible();
        await page.getByRole('link', { name: '← Back to people' }).click();
        await expect(page).toHaveURL(/profile=artist/);
    } finally {
        await removePerson(page, 'E2E Plain Person');
    }
});

test('artist: contact details, addresses, a priced work with history, a buyer, and the CV PDF', async ({ page }) => {
    await removePerson(page, 'E2E Artist');
    await removePerson(page, 'E2E Buyer');
    try {
        await page.goto('/admin/people?profile=artist');
        await page.getByRole('button', { name: '+ New artist' }).click();
        await page.getByRole('dialog').getByLabel('Name').fill('E2E Artist');
        await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
        await expect(page).toHaveURL(/\/artist$/);

        // Contact details
        await page.getByLabel('Email', { exact: true }).fill('e2e.artist@example.com');
        await page.getByLabel('Phone').fill('+1 312 555 0100');
        await expect(page.getByText('● Unsaved changes')).toBeVisible();
        await page.getByRole('button', { name: 'Save details' }).click();
        await expect(page.getByText('Saved', { exact: true })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Call' })).toHaveAttribute('href', 'tel:+13125550100');

        // Two addresses: the first is primary.
        const addAddress = async (label: string, street: string, city: string) => {
            await page.getByRole('button', { name: '+ Add address' }).click();
            const d = page.getByRole('dialog');
            await d.getByLabel('Label').fill(label);
            await d.getByLabel('Street address').fill(street);
            await d.getByLabel('City').fill(city);
            await d.getByRole('button', { name: 'Save address' }).click();
            await expect(d).toHaveCount(0);
        };
        await addAddress('Studio', '1210 W Studio St', 'Chicago');
        await addAddress('Home', '5 Home Ave', 'Tulsa');
        const cards = page.getByTestId('address-card');
        await expect(cards).toHaveCount(2);
        await expect(cards.nth(0)).toContainText('Studio');
        await expect(cards.nth(0)).toContainText('Primary');
        await expect(cards.nth(1)).not.toContainText('Primary');

        // A new work is only a form until saved: leaving it creates nothing.
        await page.getByRole('link', { name: '+ Add work' }).click();
        await expect(page.getByRole('heading', { name: 'New work' })).toBeVisible();
        await page.getByLabel('Title').fill('Abandoned');
        page.once('dialog', (d) => d.accept());
        await page.getByRole('link', { name: '← E2E Artist' }).click();
        await expect(page.getByText('No works yet.')).toBeVisible();

        // Add a work with an image and a price.
        await page.getByRole('link', { name: '+ Add work' }).click();
        await page.getByLabel('Title').fill('E2E Work');
        await page.getByRole('textbox', { name: /^Date\b/ }).fill('2026');
        await page.getByLabel('Inventory number').fill(`E2E-${Date.now()}`);
        const price = page.getByRole('textbox', { name: /^Price\b/ });
        await price.fill('4,500');
        await expect(page.getByText('$4,500')).toBeVisible();
        const chooser = page.waitForEvent('filechooser');
        await page.getByRole('button', { name: '+ Add images' }).click();
        await (await chooser).setFiles({ name: 'e2e-work.png', mimeType: 'image/png', buffer: PNG });
        await expect(page.locator('img[alt="e2e work"]')).toBeVisible();
        await page.getByRole('button', { name: 'Save work' }).click();
        await expect(page.getByText('Work added')).toBeVisible();
        await expect(page).toHaveURL(/\/admin\/works\/[0-9a-f-]{36}$/);

        // Change the price with a reason: the history shows both values.
        await price.fill('5200');
        await page.getByLabel('Reason for this change (optional)').fill('Fair pricing');
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(page.getByText('Saved', { exact: true })).toBeVisible();
        const history = page.getByTestId('work-history');
        await expect(history.locator('li').first()).toContainText('Price: $4,500 → $5,200');
        await expect(history.locator('li').first()).toContainText('“Fair pricing”');

        // Mark it sold to a buyer created inline.
        await page.getByLabel('Status', { exact: true }).selectOption('sold');
        await page.getByLabel('Buyer', { exact: true }).fill('E2E Buyer');
        await page.getByRole('option', { name: /Create new person “E2E Buyer”/ }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
        await expect(page.getByRole('link', { name: 'E2E Buyer' })).toBeVisible();
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(history.locator('li').filter({ hasText: 'Status' }).first()).toContainText('Available → Sold');
        await expect(history.locator('li').filter({ hasText: 'Sale' }).first()).toContainText('E2E Buyer');

        // The artist's gallery shows the work with its caption and price; the buyer shows the purchase.
        await page.getByRole('link', { name: '← E2E Artist' }).click();
        const card = page.getByRole('link', { name: /E2E Work, 2026/ });
        await expect(card).toContainText('$5,200');
        await expect(card).toContainText('Sold');

        // CV PDF
        const download = page.waitForEvent('download');
        await page.getByRole('link', { name: 'Download PDF' }).click();
        expect((await download).suggestedFilename()).toBe('e2e-artist-cv.pdf');

        // External press: added privately, edited, then removed.
        const pressSection = page.getByRole('region', { name: /^Press/ });
        await pressSection.getByRole('button', { name: '+ Add press' }).click();
        const pd = page.getByRole('dialog');
        await pd.getByLabel('Outlet').fill('E2E Quarterly');
        await pd.getByLabel('Headline').fill('E2E Artist abroad');
        await pd.getByLabel('Link').fill(`https://example.com/e2e-artist-abroad-${Date.now()}`);
        await pd.getByLabel('Date', { exact: true }).fill('2025-03-01');
        await pd.getByRole('button', { name: 'Add press' }).click();
        await expect(pressSection.getByRole('link', { name: 'E2E Artist abroad' })).toBeVisible();
        await expect(pressSection.getByText('External press')).toBeVisible();
        await expect(pressSection.getByText('Not on site')).toBeVisible();
        await pressSection.getByRole('button', { name: 'Edit E2E Artist abroad' }).click();
        await pd.getByLabel('Headline').fill('E2E Artist abroad, revised');
        await pd.getByRole('button', { name: 'Save' }).click();
        await expect(pressSection.getByRole('link', { name: 'E2E Artist abroad, revised' })).toBeVisible();
        page.once('dialog', (d) => void d.accept());
        await pressSection.getByRole('button', { name: 'Remove E2E Artist abroad, revised' }).click();
        await expect(pressSection.getByText('No press yet.')).toBeVisible();

        const buyer = await findPerson(page, 'E2E Buyer');
        await page.goto(`/admin/people/${buyer.id}`);
        await expect(page.getByRole('link', { name: 'E2E Work' })).toBeVisible();
    } finally {
        await removePerson(page, 'E2E Artist');
        await removePerson(page, 'E2E Buyer');
    }
});

test('inventory is paginated, with filters in the URL', async ({ page }) => {
    await page.goto('/admin/inventory');
    await expect(page.getByText(/^Showing 1–25 of \d+ works$/)).toBeVisible();
    const pages = page.getByRole('navigation', { name: 'works pages' });
    const firstTitle = await page.locator('tbody tr').first().textContent();
    await pages.getByRole('button', { name: 'Next →' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText(/^Showing 26–\d+ of \d+ works$/)).toBeVisible();
    await expect(page.locator('tbody tr').first()).not.toHaveText(firstTitle!);
    // A filter change goes back to page 1. Status is Available and On hold until changed.
    const status = page.getByTestId('work-status-filter');
    await expect(status).toHaveText('Available, On hold');
    await status.click();
    await page.getByRole('menuitemcheckbox', { name: 'Not for sale' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Available' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'On hold' }).click();
    await page.keyboard.press('Escape');
    await expect(status).toHaveText('Not for sale');
    await expect(page).not.toHaveURL(/page=/);
    await expect(page).toHaveURL(/status=nfs$/);
    await expect(page.locator('tbody tr').first()).toContainText('Not for sale');
});

test('exhibition slides link to artist profiles from the edit view', async ({ page }) => {
    await removePerson(page, 'E2E Linked Artist');
    try {
        // Already linked slides show artist and work chips that open the back office.
        await page.goto('/exhibitions/rozell-as-above-so-below');
        const edit = page.getByRole('button', { name: 'Edit site' });
        if (await edit.isVisible()) await edit.click();
        // The editing bar always offers the back office at its left.
        await expect(page.getByRole('toolbar', { name: 'Editing' }).getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');
        const chip = page.getByTestId('slide-link').first().getByRole('link', { name: /Trey Rozell/ });
        await expect(chip).toHaveAttribute('href', /^\/admin\/people\/[0-9a-f-]{36}\/artist$/);

        // An unlinked slide: look the artist up in People (creating them), and make a work from it.
        await page.goto('/exhibitions/terror-element');
        const unlinked = page.getByTestId('unlinked-count');
        await expect(unlinked).toBeVisible();
        const before = Number((await unlinked.textContent())!.replace(/\D/g, ''));
        await page.getByRole('button', { name: 'Link artist' }).first().click();
        const dialog = page.getByRole('dialog', { name: 'Link to an artist' });
        await dialog.getByLabel('Artist').fill('E2E Linked Artist');
        await page.getByRole('option', { name: /Create new person “E2E Linked Artist”/ }).click();
        await page.getByRole('dialog', { name: 'New person' }).getByRole('button', { name: 'Create' }).click();
        await expect(dialog.getByText('has no artist profile yet')).toBeVisible();
        await dialog.getByRole('button', { name: 'Link', exact: true }).click();
        await expect(page.getByText('Linked to E2E Linked Artist')).toBeVisible();
        await expect(page.getByRole('link', { name: 'E2E Linked Artist ↗' })).toBeVisible();
        await expect(unlinked).toContainText(String(before - 1));

        const href = await page.getByRole('link', { name: 'E2E Linked Artist ↗' }).getAttribute('href');
        await page.goto(href!);
        const panel = page.getByTestId('artist-panel');
        await expect(panel.getByRole('link', { name: /^terror element$/i })).toBeVisible();
        await expect(panel.getByText('Works (1)')).toBeVisible();
    } finally {
        await removePerson(page, 'E2E Linked Artist');
    }
});

test('collectors: hold a work, invoice it, pay it, see the collection by artist; a cancelled invoice leaves the collection', async ({ page }) => {
    const cleanup = async () => {
        await removePerson(page, 'E2E Collector');
        await removePerson(page, 'E2E Invoice Artist');
    };
    await cleanup();
    try {
        const artist = (await (await api(page).send('POST', '/persons', { name: 'E2E Invoice Artist', profiles: ['artist'] })).json()) as { id: string };
        const buyer = (await (await api(page).send('POST', '/persons', { name: 'E2E Collector', email: 'e2e.collector@example.com' })).json()) as { id: string };
        const work = (await (await api(page).send('POST', '/works', { artistId: artist.id, title: 'E2E Held Work', priceCents: 240000 })).json()) as { id: string };
        const declined = (await (await api(page).send('POST', '/works', { artistId: artist.id, title: 'E2E Declined Work', priceCents: 100000 })).json()) as { id: string };

        // Put the work on hold for the buyer, then invoice it from the work page.
        await page.goto(`/admin/works/${work.id}`);
        await page.getByLabel('Status', { exact: true }).selectOption('on_hold');
        await page.getByLabel('Buyer').fill('E2E Collector');
        // The existing person, not the "Create new person" option.
        await page.getByRole('option').filter({ hasText: 'E2E Collector' }).filter({ hasNotText: 'Create new person' }).click();
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await page.getByRole('button', { name: 'Create invoice for E2E Collector' }).click();
        await expect(page).toHaveURL(/\/admin\/invoices\/[0-9a-f-]{36}$/);
        const invoiceId = page.url().split('/').pop()!;
        const totals = page.getByTestId('invoice-totals');
        // $2,400 + 10.25% sales tax.
        await expect(totals).toContainText('$2,646.00');

        await page.getByLabel('Discount (%)').fill('10');
        await expect(totals).toContainText('$2,381.40');
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(page.getByText('Invoice saved')).toBeVisible();
        const pdf = await page.request.get(`/api/admin/invoices/${invoiceId}/invoice.pdf`);
        expect(pdf.headers()['content-type']).toBe('application/pdf');
        expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');

        // Paid in full → the work is sold to the collector.
        await page.getByRole('button', { name: /^Paid in full/ }).click();
        await expect(page.getByTestId('invoice-payments')).toContainText('$2,381.40');
        await expect(page.locator('h1').locator('..').getByText('Paid', { exact: true })).toBeVisible();
        expect((await api(page).get(`/works/${work.id}`)).status).toBe('sold');

        // The collector's collection, by artist, linking to the artist.
        await page.getByRole('link', { name: 'E2E Collector' }).click();
        await expect(page).toHaveURL(new RegExp(`/admin/people/${buyer.id}/collector$`));
        await expect(page.getByTestId('collected-artists').getByRole('link', { name: /E2E Invoice Artist/ })).toHaveAttribute('href', `/admin/people/${artist.id}/artist`);
        const group = page.getByTestId(`collection-${artist.id}`);
        await expect(group.getByText('E2E Held Work')).toBeVisible();

        // A second invoice the collector declines: cancelling takes the work out of the collection.
        const hold = await api(page).get(`/works/${declined.id}`);
        await api(page).send('PATCH', `/works/${declined.id}`, { updatedAt: hold.updatedAt, status: 'on_hold', buyerId: buyer.id });
        const second = (await (await api(page).send('POST', '/invoices', { personId: buyer.id, workIds: [declined.id] })).json()) as { id: string };
        await page.reload();
        await expect(group.getByText('E2E Declined Work')).toBeVisible();
        await page.goto(`/admin/invoices/${second.id}`);
        await page.locator('select').filter({ hasText: 'Cancelled' }).selectOption('cancelled');
        await expect(page.getByText(/removes its works from their collection/)).toBeVisible();
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(page.getByText('Invoice saved')).toBeVisible();
        expect((await api(page).get(`/works/${declined.id}`)).status).toBe('available');
        await page.goto(`/admin/people/${buyer.id}/collector`);
        await expect(group.getByText('E2E Held Work')).toBeVisible();
        await expect(group.getByText('E2E Declined Work')).toHaveCount(0);
        // The cancelled invoice stays on record.
        await expect(page.getByRole('row', { name: /E2E Declined Work/ })).toContainText('Cancelled');

        // The Collectors filter lists them.
        await page.goto('/admin/people?profile=collector&q=E2E%20Collector');
        await expect(page.getByRole('heading', { name: 'Collectors' })).toBeVisible();
        await expect(page.locator('tbody tr').first()).toContainText('E2E Collector');
    } finally {
        await cleanup();
    }
});

test('invoices screen: a new invoice for a new buyer with works by two artists', async ({ page }) => {
    const cleanup = async () => {
        await removePerson(page, 'E2E New Buyer');
        await removePerson(page, 'E2E Artist One');
        await removePerson(page, 'E2E Artist Two');
    };
    await cleanup();
    try {
        const one = (await (await api(page).send('POST', '/persons', { name: 'E2E Artist One', profiles: ['artist'] })).json()) as { id: string };
        const two = (await (await api(page).send('POST', '/persons', { name: 'E2E Artist Two', profiles: ['artist'] })).json()) as { id: string };
        const a = (await (await api(page).send('POST', '/works', { artistId: one.id, title: 'E2E Pick A', priceCents: 100000 })).json()) as { id: string };
        const b = (await (await api(page).send('POST', '/works', { artistId: two.id, title: 'E2E Pick B', priceCents: 50000 })).json()) as { id: string };

        await page.goto('/admin/invoices');
        // Unpaid invoices by default.
        await expect(page.getByTestId('invoice-status-filter')).toHaveText('Open, Partial payment');
        await page.getByRole('link', { name: '+ New invoice' }).click();
        await expect(page).toHaveURL(/\/admin\/invoices\/new$/);

        // A buyer who doesn't exist yet.
        await page.getByLabel('Buyer').fill('E2E New Buyer');
        await page.getByRole('option', { name: /Create new person/ }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Create' }).click();
        await expect(page.getByTestId('invoice-buyer')).toHaveText('E2E New Buyer');

        // Works by two artists.
        await page.getByLabel('Search works').fill('E2E Pick');
        await page.getByLabel('Sales tax (%)').fill('');
        await page.getByRole('checkbox', { name: 'E2E Artist One, E2E Pick A' }).check();
        await page.getByRole('checkbox', { name: 'E2E Artist Two, E2E Pick B' }).check();
        await page.getByLabel('Discount (%)').fill('10');
        await expect(page.getByTestId('invoice-new-totals')).toContainText('$1,350.00');
        await page.getByRole('button', { name: 'Create invoice' }).click();

        await expect(page).toHaveURL(/\/admin\/invoices\/[0-9a-f-]{36}$/);
        await expect(page.getByTestId('invoice-items')).toContainText('E2E Pick A');
        await expect(page.getByTestId('invoice-items')).toContainText('E2E Pick B');
        await expect(page.getByTestId('invoice-totals')).toContainText('$1,350.00');
        for (const w of [a, b]) {
            const work = await api(page).get(`/works/${w.id}`);
            expect([work.status, work.buyer?.name]).toEqual(['on_hold', 'E2E New Buyer']);
        }

        // Their collection lists both artists.
        await page.getByRole('link', { name: 'E2E New Buyer' }).click();
        const artists = page.getByTestId('collected-artists');
        await expect(artists.getByRole('link', { name: /E2E Artist One/ })).toBeVisible();
        await expect(artists.getByRole('link', { name: /E2E Artist Two/ })).toBeVisible();
    } finally {
        await cleanup();
    }
});
