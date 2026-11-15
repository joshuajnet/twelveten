import { test, expect } from '@playwright/test';

// Every public URL of the site. The baseline is captured from master before the refactor;
// later builds must match it.
export const PAGES = [
    '/',
    '/about',
    '/exhibitions',
    '/fairs',
    '/news',
    '/news/7-1-2026',
    '/documents/beech-von-sternberg-interview',
    '/exhibitions/beyond-the-black-rainbow',
    '/exhibitions/africh-signal',
    '/exhibitions/schippa-wildfong-liberte',
    '/exhibitions/leitch-darling-maneuver',
    '/exhibitions/rozell-as-above-so-below',
    '/exhibitions/terror-element',
    '/exhibitions/speedrunners',
    '/exhibitions/bullet-hell',
    '/exhibitions/beech-delphic-future',
    '/exhibitions/the-veil',
    '/exhibitions/brain-worms',
    '/exhibitions/halpern-stareeyed',
    '/exhibitions/coldbomb',
    '/exhibitions/ryleans',
    '/fairs/nada-miami-2026',
    '/fairs/neighbors-chicago-2026',
    '/fairs/nada-miami-2025',
    '/this-page-does-not-exist',
];

const name = (path: string) => (path === '/' ? 'home' : path.slice(1).replace(/\//g, '__'));

for (const path of PAGES) {
    test(`visual ${path}`, async ({ page }) => {
        // Freeze slideshow autoplay and other timers so screenshots are deterministic.
        await page.clock.install({ time: new Date('2026-11-12T12:00:00-06:00') });
        await page.goto(path, { waitUntil: 'networkidle' });
        // Trigger lazy-loaded images by scrolling through the page.
        await page.evaluate(async () => {
            for (let y = 0; y < document.body.scrollHeight; y += 400) {
                window.scrollTo(0, y);
                await new Promise((r) => setTimeout(r, 30));
            }
            window.scrollTo(0, 0);
        });
        await page.waitForLoadState('networkidle');
        await page.evaluate(() => Promise.all(Array.from(document.images).map((i) => i.decode().catch(() => {}))));
        await expect(page).toHaveScreenshot(`${name(path)}.png`, { fullPage: true, timeout: 30_000 });
    });
}
