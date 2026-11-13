# Architecture

## Overview
Twelve Ten Gallery website: a Vue 3 single-page app built with Vite and styled with Tailwind CSS 4, plus a TypeScript API (Hono) backed by Postgres via Kysely. The site's content (exhibitions, fairs, slideshows, news, press, home splash) is still bundled in the frontend source; the API currently exposes a health check and owns the database schema.

## Repo layout
npm workspaces:

| Path | Contents |
|---|---|
| `apps/web` | Vue 3 SPA (`@twelveten/web`): pages, components, JSON content, `public/` images and PDFs |
| `apps/api` | `@twelveten/api`: Hono app (`src/app.ts`), Lambda entry (`src/lambda.ts`), local Node server (`src/local.ts`), database access and migrations (`src/db/`) |
| `packages/shared` | `@twelveten/shared` TypeScript source used by other workspaces: content schemas (zod), date formatting, route table, meta-tag builder |
| `docker-compose.yml` | Local services: Postgres 17 (databases `twelveten` and `twelveten_test`) |
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

## API (`apps/api`)
- `createApp({ db })` builds the Hono app under the `/api` base path. The same app is served by `hono/aws-lambda` (`lambda.ts`) and `@hono/node-server` (`local.ts`, port `PORT`, default 3000).
- Routes:

  | Method | Path | Auth | Response |
  |---|---|---|---|
  | GET | `/api/health` | public | `{ ok, db }`; 503 when the database is unreachable |

- Unknown `/api/*` paths return JSON 404s; unhandled errors return JSON 500s.
- Configuration (`src/config.ts`, validated with zod from the environment): `DATABASE_URL` (required), `DATABASE_POOL_MAX` (default 5), `DATABASE_SSL` (`true`/`false`), `SITE_URL`, `PORT`, `NODE_ENV`.

## Database
- Postgres 17, accessed with Kysely over `pg` (`src/db/index.ts`). `DATE` columns are returned as `YYYY-MM-DD` strings and `TIMESTAMPTZ` as ISO strings. Table types live in `src/db/types.ts`.
- Migrations are listed statically in `src/db/migrate.ts` and run by Kysely's `Migrator` (advisory-locked). Every statement is idempotent (`IF NOT EXISTS`, guarded `DO` blocks), so a migration can be re-run safely. Enumerated values are `text` + `CHECK`.
- Ids are `uuid` (`gen_random_uuid()` default). `updated_at` is maintained by a `set_updated_at` trigger.
- Tables (`0001_initial`):

  | Table | Holds |
  |---|---|
  | `user`, `session`, `account`, `verification`, `rateLimit` | Login (Better Auth layout, camelCase columns; `user.role` is `user` or `admin`) |
  | `exhibitions` | Exhibitions and fairs (`kind`); run dates `starts_on`/`ends_on` (`date`), `timezone`, header fields, hero/thumbnail, `content` (rich-text JSON document), SEO overrides, `published` |
  | `exhibition_events` | Dated events shown under an exhibition's dates (label, `starts_at`, `ends_at`, `position`), e.g. the opening |
  | `artworks` | Slideshow slides per exhibition; `(exhibition_id, position)` unique, deferrable |
  | `news_posts` | News posts: `slug`, `title`, `published_at`, `body_html`, SEO overrides, `published` |
  | `press_items` | Press coverage: outlet, title, `url` (unique), `published_on`, optional `issue_label`/`byline`, optional `exhibition_id` |
  | `home_page` | Single row (`id = 1`): home splash images, text, optional dates, `link_exhibition_id` |
  | `content_revisions` | Snapshots of content changes (entity, entity id, action, `snapshot` JSON, user) |
  | `seed_state` | Markers for one-time seed runs |

## Local development
- `npm install`, then `npm run dev` (Vite dev server).
- `docker compose up -d --wait` starts Postgres on `localhost:5432` (user/password `twelveten`).
- `npm run db:migrate -w apps/api` applies migrations to `DATABASE_URL`; `npm run dev -w apps/api` runs the API with reload. Both read `.env.local` at the repo root when present.
- `npm run build` builds all workspaces.

## Testing
- `npm test`: Vitest across workspaces. `apps/web` tests run in happy-dom with `@vue/test-utils` (`src/**/*.test.js`); `packages/shared` tests run in Node (`src/**/*.test.ts`); `apps/api` tests run in Node against the `twelveten_test` database (override with `TEST_DATABASE_URL`), one file at a time, and need `docker compose up` first.
- `npx tsc -p packages/shared` / `npx tsc -p apps/api`: type-check (`tsconfig.base.json` holds the common compiler options).
- `npm run test:e2e`: builds the site and runs Playwright. Visual tests compare each page against the committed baseline in `e2e/__screenshots__/`; refresh it intentionally with `npx playwright test --update-snapshots`.
