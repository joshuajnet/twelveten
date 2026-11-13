# Architecture

## Overview
Twelve Ten Gallery website: a Vue 3 single-page app built with Vite and styled with Tailwind CSS 4. All content (exhibitions, fairs, slideshows, news, press, home splash) is currently bundled in the frontend source.

## Repo layout
npm workspaces:

| Path | Contents |
|---|---|
| `apps/web` | Vue 3 SPA (`@twelveten/web`): pages, components, JSON content, `public/` images and PDFs |
| `packages/shared` | `@twelveten/shared` TypeScript source used by other workspaces: content schemas (zod), date formatting, route table, meta-tag builder |
| `e2e/` | Playwright tests; `e2e/visual` holds full-page screenshot tests for every public URL |
| `vitest.config.ts` | Root Vitest config; each workspace defines a Vitest project |
| `playwright.config.ts` | Playwright config (desktop + mobile projects; serves the built site with `vite preview`) |

## Frontend (`apps/web`)
- Entry: `src/main.js` mounts `App.vue` with `vue-router` (`src/router.js`, HTML5 history) and `vue3-lazyload`.
- Pages: `src/pages/` (one `.vue` file per exhibition and fair under `exhibitions/` and `fairs/`), shared components in `src/components/`.
- Content: slideshows in `src/json/*-slideshow.json`, news in `src/json/news.json`, press list in `src/components/Press.vue`.
- Styling: `src/style.css` imports Tailwind and defines theme fonts. SFC `<style>` blocks that use `@apply` start with `@reference "@/style.css";`. Global element styles in `App.vue` live in `@layer base` so utility classes override them.
- `@` resolves to `apps/web/src`.

## Shared package (`packages/shared`)
Consumed as TypeScript source (`exports` point at `src/*.ts`); no build step.

| Module | Provides |
|---|---|
| `content.ts` | zod schemas + types for API payloads: `Exhibition`, `ExhibitionSummary`, `ExhibitionEvent`, `Artwork`, `PressItem`, `NewsPost`, `HomePage`, rich-text documents (Tiptap JSON), `Page<T>` (`{ items, nextCursor }`), `PAGE_SIZE` = 10, `MAX_PAGE_SIZE` = 50 |
| `dates.ts` | Display text derived from stored values: `formatDate`, `formatDateRange` (collapses shared month/year), `formatEvent` / `formatEventTime` (wall-clock time in a time zone, default `America/Chicago`), `todayIso`, `exhibitionStatus` (upcoming / current / past) |
| `routes.ts` | `matchRoute(path)` for every public URL, legacy `REDIRECTS`, `exhibitionPath`, `newsPath` |
| `meta.ts` | `buildMeta(input, { siteUrl })` → per-page title, description, canonical URL, Open Graph / Twitter image, JSON-LD (`ExhibitionEvent`, `NewsArticle`, `ArtGallery`) and HTTP status; `renderHead(tags)` → escaped `<head>` HTML |
| `text.ts` | `htmlToText`, `firstParagraph`, `firstHtmlParagraph`, `truncate`, `escapeHtml` |

Stored dates are ISO `YYYY-MM-DD` strings for whole days and ISO timestamps for moments in time; display strings are never stored.

## Local development
- `npm install`, then `npm run dev` (Vite dev server).
- `npm run build` builds all workspaces.

## Testing
- `npm test`: Vitest across workspaces. `apps/web` tests run in happy-dom with `@vue/test-utils` (`src/**/*.test.js`); `packages/shared` tests run in Node (`src/**/*.test.ts`).
- `npx tsc -p packages/shared`: type-check the shared package (`tsconfig.base.json` holds the common compiler options).
- `npm run test:e2e`: builds the site and runs Playwright. Visual tests compare each page against the committed baseline in `e2e/__screenshots__/`; refresh it intentionally with `npx playwright test --update-snapshots`.
