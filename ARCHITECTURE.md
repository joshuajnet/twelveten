# Architecture

## Overview
Twelve Ten Gallery website: a Vue 3 single-page app built with Vite and styled with Tailwind CSS 4. All content (exhibitions, fairs, slideshows, news, press, home splash) is currently bundled in the frontend source.

## Repo layout
npm workspaces:

| Path | Contents |
|---|---|
| `apps/web` | Vue 3 SPA (`@twelveten/web`): pages, components, JSON content, `public/` images and PDFs |
| `e2e/` | Playwright tests; `e2e/visual` holds full-page screenshot tests for every public URL |
| `vitest.config.ts` | Root Vitest config; each workspace defines a Vitest project |
| `playwright.config.ts` | Playwright config (desktop + mobile projects; serves the built site with `vite preview`) |

## Frontend (`apps/web`)
- Entry: `src/main.js` mounts `App.vue` with `vue-router` (`src/router.js`, HTML5 history) and `vue3-lazyload`.
- Pages: `src/pages/` (one `.vue` file per exhibition and fair under `exhibitions/` and `fairs/`), shared components in `src/components/`.
- Content: slideshows in `src/json/*-slideshow.json`, news in `src/json/news.json`, press list in `src/components/Press.vue`.
- Styling: `src/style.css` imports Tailwind and defines theme fonts. SFC `<style>` blocks that use `@apply` start with `@reference "@/style.css";`. Global element styles in `App.vue` live in `@layer base` so utility classes override them.
- `@` resolves to `apps/web/src`.

## Local development
- `npm install`, then `npm run dev` (Vite dev server).
- `npm run build` builds all workspaces.

## Testing
- `npm test`: Vitest across workspaces. `apps/web` tests run in happy-dom with `@vue/test-utils` (`src/**/*.test.js`).
- `npm run test:e2e`: builds the site and runs Playwright. Visual tests compare each page against the committed baseline in `e2e/__screenshots__/`; refresh it intentionally with `npx playwright test --update-snapshots`.
