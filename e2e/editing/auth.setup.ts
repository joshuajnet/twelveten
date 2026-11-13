import { test as setup, expect } from '@playwright/test';

/** Signs in once and saves the session for the editing tests (sign-in is rate limited). */
export const ADMIN_STATE = 'e2e/.auth/admin.json';
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? process.env.ADMIN_EMAIL ?? 'admin@twelveten.local';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? '';

setup('sign in as admin', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('/');
    await expect(page.getByRole('button', { name: '✎ Edit site' })).toBeVisible();
    await page.context().storageState({ path: ADMIN_STATE });
});
