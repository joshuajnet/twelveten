import { test, expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';

/**
 * Inquire as a form on an exhibition page (slide and exhibition), the visitor remembered across the
 * site, the admin alert (dismiss) and the collector profile; plus responsive image derivatives and
 * the zoom copy. The exhibition's settings are restored and everything created is removed.
 */
test.describe.configure({ mode: 'serial' });
test.use({ storageState: 'e2e/.auth/admin.json' });

const NAME = 'Nico Inquirer';
const EMAIL = 'nico.inquirer@example.com';

const errors: string[] = [];
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

const state = {
    path: '',
    exhibitionId: '',
    slideId: '',
    slideTitle: '',
    original: null as null | { slideshowVisible: boolean; worksAvailable: boolean; showInquire: boolean; slideAvailable: boolean },
};

async function visitor(browser: Browser): Promise<Page> {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    return page;
}

async function cleanup(r: APIRequestContext) {
    const a = admin(r);
    for (const p of (await a.get(`/persons?q=${encodeURIComponent(EMAIL)}`)).items ?? []) {
        const full = await a.get(`/persons/${p.id}`);
        for (const i of full.collectorProfile?.inquiries ?? []) await a.send('DELETE', `/inquiries/${i.id}`);
        await a.send('DELETE', `/persons/${p.id}/collector-profile`);
        await a.send('DELETE', `/persons/${p.id}`);
    }
}

test.beforeAll(async ({ request }) => {
    await cleanup(request);
    const a = admin(request);
    // A published exhibition with an image slide whose image has derivatives.
    const list = (await (await request.get('/api/exhibitions?kind=exhibition')).json()).items;
    for (const e of list) {
        const ex = await a.get(`/exhibitions/${e.id}`);
        const slide = ex.artworks.find((s: { image: string | null; hidden: boolean }) => s.image && !s.hidden && /\.(jpe?g|png)$/i.test(s.image));
        if (!ex.published || !slide) continue;
        if ((await request.get(`/media/derived/${slide.image.slice('/media/'.length)}/w480.webp`)).status() !== 200) continue;
        state.original = { slideshowVisible: ex.slideshowVisible, worksAvailable: ex.worksAvailable, showInquire: ex.showInquire, slideAvailable: slide.available };
        Object.assign(state, { path: `/exhibitions/${ex.slug}`, exhibitionId: ex.id, slideId: slide.id, slideTitle: slide.title || 'Untitled' });
        await a.send('PATCH', `/exhibitions/${ex.id}`, { updatedAt: ex.updatedAt, slideshowVisible: true, worksAvailable: true, showInquire: true });
        await a.send('PATCH', `/artworks/${slide.id}`, { updatedAt: slide.updatedAt, available: true });
        break;
    }
    expect(state.slideId, 'an exhibition slide with image derivatives (run npm run media:derive)').not.toBe('');
});

test.afterAll(async ({ request }) => {
    await cleanup(request);
    if (!state.original) return;
    const a = admin(request);
    const ex = await a.get(`/exhibitions/${state.exhibitionId}`);
    await a.send('PATCH', `/exhibitions/${ex.id}`, {
        updatedAt: ex.updatedAt,
        slideshowVisible: state.original.slideshowVisible,
        worksAvailable: state.original.worksAvailable,
        showInquire: state.original.showInquire,
    });
    const slide = ex.artworks.find((s: { id: string }) => s.id === state.slideId);
    await a.send('PATCH', `/artworks/${slide.id}`, { updatedAt: slide.updatedAt, available: state.original.slideAvailable });
});

test('exhibition images use derivatives, and zoom loads the high-resolution copy', async ({ browser }) => {
    const page = await visitor(browser);
    await page.goto(state.path);
    const derived = page.locator('img[srcset*="/media/derived/"]');
    await expect(derived.first()).toBeAttached();
    await page.getByTestId('slideshow-zoom').click();
    const zoomImg = page.getByTestId('zoom-viewer').locator('img');
    await expect(zoomImg).toHaveAttribute('data-source', 'zoom', { timeout: 15_000 });
    await expect(zoomImg).toHaveAttribute('src', /\/media\/derived\/.+\/zoom\.jpg$/);
    await page.keyboard.press('Escape');
    await page.context().close();
});

test('images sharpen in the background when drawn larger than the first pick', async ({ browser }) => {
    // A tall phone at 2× with the square home image cropped to fill it: it is drawn ~2× wider than the viewport.
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: 400, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    const splash = page.locator('img.home-bg').filter({ visible: true });
    await expect(splash).toHaveAttribute('src', /\/media\/derived\/.+\/(w2400\.webp|zoom\.jpg)$/, { timeout: 15_000 });
    // Same size on screen after the swap.
    const box = await splash.boundingBox();
    expect(Math.round(box!.width)).toBeGreaterThanOrEqual(400);
    await ctx.close();
});

test('a visitor inquires about a work, then is remembered', async ({ browser }) => {
    const page = await visitor(browser);
    await page.goto(state.path);
    await page.getByText('Works Available').click();
    await page.getByTestId('slide-inquire').filter({ visible: true }).first().click();
    const dialog = page.getByTestId('inquiry-dialog').filter({ visible: true });
    await expect(dialog.getByTestId('inquiry-item')).toBeVisible();
    await dialog.getByRole('button', { name: 'Send inquiry' }).click();
    await expect(dialog.getByText('Please enter your name')).toBeVisible();
    await dialog.getByLabel('Name').fill(NAME);
    await dialog.getByLabel('Email').fill(EMAIL);
    await dialog.getByLabel(/Note/).fill('Could you send more photos?\nThanks');
    await dialog.getByRole('button', { name: 'Send inquiry' }).click();
    await expect(dialog.getByTestId('inquiry-sent')).toContainText('Thank you');
    await dialog.getByRole('button', { name: 'Close' }).last().click();

    // The exhibition's Inquire button: already known, just a note. "Not you?" brings the fields back.
    await page.getByTestId('exhibition-inquire').click();
    const again = page.getByTestId('inquiry-dialog').filter({ visible: true });
    await expect(again.getByTestId('inquiry-known')).toContainText(NAME);
    await again.getByLabel(/Note/).fill('And about the show in general.');
    await again.getByRole('button', { name: 'Send inquiry' }).click();
    await expect(again.getByTestId('inquiry-sent')).toBeVisible();
    await again.getByRole('button', { name: 'Close' }).last().click();
    await page.getByTestId('exhibition-inquire').click();
    await again.getByRole('button', { name: 'Not you?' }).click();
    await expect(again.getByLabel('Email')).toBeVisible();
    await page.context().close();
});

test('the inquiry alerts admins until dismissed and stays on the collector profile', async ({ page }) => {
    errors.length = 0;
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/admin/people');
    const alerts = page.getByTestId('inquiry-alerts');
    const mine = alerts.getByTestId('inquiry-alert').filter({ hasText: NAME });
    await expect(mine).toHaveCount(2);
    await expect(mine.first()).toContainText('And about the show in general.');
    await mine.first().getByRole('link', { name: 'Open' }).click();

    const section = page.getByTestId('collector-inquiries');
    await expect(section.getByTestId('inquiry-row')).toHaveCount(2);
    await expect(section).toContainText('Could you send more photos?');
    await expect(section).toContainText(state.slideTitle);

    for (let i = 0; i < 2; i++) await page.getByTestId('inquiry-alert').filter({ hasText: NAME }).first().getByRole('button', { name: /Dismiss/ }).click();
    await expect(page.getByTestId('inquiry-alert').filter({ hasText: NAME })).toHaveCount(0);
    await expect(section.getByText('New', { exact: true })).toHaveCount(0);

    await page.goto('/admin/inquiries');
    await expect(page.getByTestId('inquiry-row').filter({ hasText: NAME })).toHaveCount(2);
});
