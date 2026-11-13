import { test, expect, type Page } from '@playwright/test';

/**
 * End-to-end editing flows against a running API with seeded data and the local admin
 * (created by `npm run dev`, or `npm run admin:create -w apps/api`).
 */
test.describe.configure({ mode: 'serial' });
test.use({ storageState: 'e2e/.auth/admin.json' });

/** The saved admin session (see auth.setup.ts) — just open the site. */
async function signIn(page: Page) {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Edit site' }).or(page.getByRole('toolbar', { name: 'Editing' }))).toBeVisible();
}

async function startEditing(page: Page) {
    const edit = page.getByRole('button', { name: 'Edit site' });
    if (await edit.isVisible()) await edit.click();
    await expect(page.getByRole('toolbar', { name: 'Editing' })).toBeVisible();
}

const errors: string[] = [];

test.beforeEach(async ({ page }) => {
    page.on('pageerror', (e) => {
        errors.push(e.message);
    });
});
test.afterEach(() => {
    expect(errors, 'no uncaught errors in the page').toEqual([]);
    errors.length = 0;
});

test('wrong password is rejected', async ({ browser }) => {
    const anon = await browser.newPage({ storageState: { cookies: [], origins: [] } });
    await anon.goto('/admin/login');
    await anon.getByLabel('Email').fill('admin@twelveten.local');
    await anon.getByLabel('Password').fill('not the password');
    await anon.getByRole('button', { name: 'Sign in' }).click();
    await expect(anon.getByRole('alert')).toContainText(/incorrect|Too many/);
    await anon.close();
});

test('edit an exhibition in place, save, and see it published', async ({ page, browser }) => {
    await signIn(page);
    await page.goto('/exhibitions/africh-signal');
    await startEditing(page);

    const title = page.getByRole('textbox', { name: 'Title' });
    await expect(title).toHaveText('Signal');
    await title.fill('Signal (edited)');
    await expect(page.getByText('● Unsaved changes')).toBeVisible();

    const body = page.locator('.tt-rich .ProseMirror');
    await body.locator('p').first().click();
    await page.keyboard.press('End');
    await page.keyboard.type(' Added in the editor.');

    await page.keyboard.press('Control+s');
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await expect(page.getByText('● Unsaved changes')).toHaveCount(0);

    // A logged-out visitor sees the change.
    const visitor = await browser.newPage({ storageState: { cookies: [], origins: [] } });
    await visitor.goto('/exhibitions/africh-signal');
    await expect(visitor.locator('#press-release')).toContainText('Signal (edited)');
    await expect(visitor.locator('#press-release')).toContainText('Added in the editor.');
    await visitor.close();

    // Restore the previous version from History.
    await page.getByRole('button', { name: 'History' }).click();
    await page.getByRole('button', { name: 'Restore' }).first().click();
    await expect(page.getByText(/Restored the version/)).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Title' })).toHaveText('Signal');
});

test('change exhibition dates with the range picker', async ({ page }) => {
    await signIn(page);
    await page.goto('/exhibitions/africh-signal');
    await startEditing(page);
    await page.getByTitle('Change dates').click();
    const cal = page.locator('[data-reka-popper-content-wrapper]');
    await cal.getByRole('button', { name: /April 6/ }).first().click();
    await cal.getByRole('button', { name: /April 20/ }).first().click();
    await expect(page.getByTitle('Change dates')).toHaveText('April 6th — 20th, 2026');
    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(page.getByTitle('Change dates')).toHaveText('April 4th — May 23rd, 2026');
});

test('create a fair draft, publish it, link the home splash to it', async ({ page, browser }) => {
    await signIn(page);
    await startEditing(page);
    await page.getByRole('button', { name: 'Create new' }).click();
    await page.getByRole('menuitem', { name: 'New fair' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Title').fill('E2E Art Fair');
    await dialog.getByRole('button', { name: 'Create draft' }).click();
    await page.waitForURL('/fairs/e2e-art-fair');
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();

    // Not visible to the public while a draft.
    const visitor = await browser.newPage({ storageState: { cookies: [], origins: [] } });
    expect((await visitor.request.get('/api/exhibitions/e2e-art-fair')).status()).toBe(404);

    await page.getByRole('switch', { name: 'Published' }).click();
    await expect(page.getByText('Published', { exact: false }).first()).toBeVisible();
    await expect.poll(async () => (await visitor.request.get('/api/exhibitions/e2e-art-fair?kind=fair')).status()).toBe(200);

    // Home splash → link to the new fair (edit mode survives the reload).
    await page.goto('/');
    await expect(page.getByRole('toolbar', { name: 'Editing' })).toBeVisible();
    await page.getByLabel('Clicking the image opens').selectOption({ label: 'Fair: E2E Art Fair' });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await visitor.goto('/');
    await expect(visitor.locator('main a[href="/fairs/e2e-art-fair"]')).toBeVisible();

    // Clean up: point home back and delete the fair.
    await page.getByLabel('Clicking the image opens').selectOption({ label: 'Fair: NADA Miami 2026' });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await page.goto('/fairs/e2e-art-fair');
    await page.getByRole('button', { name: 'More options' }).click();
    await page.getByRole('menuitem', { name: 'Delete this page…' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await page.waitForURL('/fairs');
    await visitor.close();
});

test('turning on edit mode on the home page shows the splash editor', async ({ page }) => {
    await signIn(page);
    const done = page.getByRole('button', { name: 'Done' });
    if (await done.isVisible()) await done.click();
    await expect(page.getByRole('button', { name: 'Edit site' })).toBeVisible();
    await startEditing(page);
    const select = page.getByLabel('Clicking the image opens');
    await expect(select).toBeVisible();
    // toBeVisible ignores opacity; the page fade must finish (nothing above the editor left transparent).
    await expect
        .poll(() => select.evaluate((el) => { let o = 1; for (let n: Element | null = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity); return o; }))
        .toBe(1);
});

test('add, edit and delete a news post and a press item', async ({ page }) => {
    await signIn(page);
    await page.goto('/news');
    await startEditing(page);

    await page.getByRole('button', { name: '+ New post' }).click();
    const post = page.locator('.posts .border-t').first();
    await expect(post.getByRole('textbox').first()).toHaveText('New post');
    await post.getByRole('textbox').first().fill('E2E post');
    await post.getByRole('button', { name: 'Save post' }).click();
    await expect(page.getByText('Post saved')).toBeVisible();
    await post.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Post deleted')).toBeVisible();

    // A new press item is only a form until it is saved; discarding leaves nothing behind.
    await page.getByRole('button', { name: '+ Add press' }).click();
    const draft = page.locator('[data-new]');
    await expect(draft.getByText('New — not saved yet')).toBeVisible();
    await draft.getByRole('button', { name: 'Discard' }).click();
    await expect(draft).toHaveCount(0);

    // Save creates it; then delete it again.
    await page.getByRole('button', { name: '+ Add press' }).click();
    await draft.getByRole('textbox').nth(0).fill('E2E Outlet');
    await draft.getByRole('textbox').nth(1).fill('E2E press article');
    await draft.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Add the article link first')).toBeVisible();
    await page.getByRole('dialog').getByLabel('Article link').fill('https://example.com/e2e-press');
    await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
    await draft.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Press item added')).toBeVisible();
    const saved = page.locator('.mb-6', { hasText: 'E2E press article' });
    await expect(saved.getByText('Draft', { exact: true })).toBeVisible();
    await saved.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(saved).toHaveCount(0);
});

test('infinite loading fetches news 10 at a time until the end', async ({ browser }) => {
    const page = await browser.newPage({ storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 600 } });
    const batches: number[] = [];
    page.on('response', async (r) => {
        if (r.url().includes('/api/news?') || r.url().endsWith('/api/news')) batches.push(((await r.json()) as { items: unknown[] }).items.length);
    });
    await page.goto('/news');
    const posts = page.locator('.posts .border-t');
    await expect(posts.first()).toBeVisible();
    for (let i = 0; i < 6 && (await posts.count()) < 24; i++) {
        await page.mouse.wheel(0, 20000);
        await page.waitForTimeout(300);
    }
    await expect(posts).toHaveCount(24);
    expect(batches).toEqual([10, 10, 4]);
    await page.close();
});
