# Architecture

## Overview
Twelve Ten Gallery website: a Vue 3 single-page app built with Vite and styled with Tailwind CSS 4, plus a TypeScript API (Hono) backed by Postgres via Kysely. All content (exhibitions, fairs, slideshows, news, press, home splash) lives in the database and is read by the site through `/api`.

## Repo layout
npm workspaces:

| Path | Contents |
|---|---|
| `apps/web` | Vue 3 SPA (`@twelveten/web`): pages, components, API client, `public/` images and PDFs |
| `apps/api` | `@twelveten/api`: Hono app (`src/app.ts`), Lambda entry (`src/lambda.ts`), local Node server (`src/local.ts`), database access and migrations (`src/db/`) |
| `packages/shared` | `@twelveten/shared` TypeScript source used by other workspaces: content schemas (zod), date formatting, route table, meta-tag builder |
| `docker-compose.yml` | Local services: Postgres 17 (databases `twelveten` and `twelveten_test`) and LocalStack 4.14.0 (S3, SSM) |
| `docker/` | Container init: Postgres test-database creation, LocalStack bootstrap (`docker/localstack/init/10-bootstrap.sh`) |
| `apps/api/seed-data` | Original site content for the initial seed: `exhibitions.ts` (header data), `exhibitions/<slug>.html` / `<slug>.bio.html` (body text), `slideshows/*.json`, `press.ts`, `news.ts` + `news.json`, `home.ts` |
| `e2e/` | Playwright tests; `e2e/visual` holds full-page screenshot tests for every public URL |
| `vitest.config.ts` | Root Vitest config; each workspace defines a Vitest project |
| `playwright.config.ts` | Playwright config (desktop + mobile projects; serves the built site with `vite preview`) |

## Frontend (`apps/web`)
- Entry: `src/main.js` mounts `App.vue` with `vue-router` (`src/router.ts`, HTML5 history, every page lazy-loaded), `@unhead/vue` (document head) and `vue3-lazyload`.
- Routes: `/`, `/about`, `/exhibitions`, `/exhibitions/:slug`, `/fairs`, `/fairs/:slug`, `/news`, `/news/:slug`, `/documents/beech-von-sternberg-interview`, legacy redirects from `REDIRECTS`, and a catch-all 404.
- Data: `src/api/client.ts` (`api.*` typed fetchers against same-origin `/api`). `useResource` loads data reactively with loading / not-found / error state. `useMeta` sets title, description, canonical, Open Graph / Twitter tags and JSON-LD from `buildMeta`.
- Exhibitions and fairs: `pages/ExhibitionDetail.vue` loads one by slug and renders `components/exhibition/ExhibitionTemplate.vue`: optional slideshow (`slideshowVisible`), hero image (two columns) or a single narrow column when there is no hero, `ExhibitionHeader.vue` (artists/title/subtitle, PDF and header links, derived dates and events, venue, hours, Inquire button), and the body (`RichContent.vue` renders the API's `contentHtml` and replaces the `pressList` placeholder with the exhibition's press).
- Lists: `pages/Exhibitions.vue` (thumbnail grid) and `pages/Fairs.vue` (text cards) group items into Current / Upcoming / Past with `exhibitionStatus` on the gallery's local date.
- News: `pages/News.vue` shows Press and Gallery News side by side; each list loads 10 items at a time as the reader scrolls (`useInfiniteList`: IntersectionObserver sentinel with a 600px margin, no concurrent fetches, retry on error, a keyboard-reachable "Load more", `aria-live` announcements). Loaded items and scroll position persist for the session so back navigation restores them. `/news/:slug` shows one post.
- Home: `pages/Home.vue` renders the splash from `/api/home` (desktop/mobile background with focal point, headline, subline, extra text, derived dates, black/white text) and links it to the chosen exhibition or fair.
- Styling: `src/style.css` imports Tailwind, adds `packages/shared/src` as a class source (classes emitted by the rich-text renderer), and defines theme fonts. SFC `<style>` blocks that use `@apply` start with `@reference "@/style.css";`. Global element styles in `App.vue` live in `@layer base` so utility classes override them.
- Dev server and `vite preview` proxy `/api` to `API_TARGET` (default `http://localhost:3000`).
- `@` resolves to `apps/web/src`.

## Shared package (`packages/shared`)
Consumed as TypeScript source (`exports` point at `src/*.ts`); no build step.

| Module | Provides |
|---|---|
| `content.ts` | zod schemas + types for API payloads: `Exhibition`, `ExhibitionSummary`, `ExhibitionEvent`, `Artwork`, `PressItem`, `NewsPost`, `HomePage`, rich-text documents (Tiptap JSON), `Page<T>` (`{ items, nextCursor }`), `PAGE_SIZE` = 10, `MAX_PAGE_SIZE` = 50 |
| `dates.ts` | Display text derived from stored values: `formatDate`, `formatDateRange` (collapses shared month/year), `formatEvent` / `formatEventTime` (wall-clock time in a time zone, default `America/Chicago`), `todayIso`, `exhibitionStatus` (upcoming / current / past), `zonedToIso` (wall-clock time in a zone → UTC) |
| `routes.ts` | `matchRoute(path)` for every public URL, legacy `REDIRECTS`, `exhibitionPath`, `newsPath` |
| `rich/` | Rich-text schema (Tiptap extensions): paragraphs with `default`/`italic`/`lead` variants, bold, italic, links, bullet/ordered lists, `figure` (image + caption), `video` (YouTube id), `bio` (artist bio section), `pressList` (placeholder for linked press). `richToHtml` renders in the browser; `rich/server` provides `htmlToRich` (parse + sanitize), `normalizeLegacyHtml` and `richToHtmlServer` for Node |
| `meta.ts` | `buildMeta(input, { siteUrl })` → per-page title, description, canonical URL, Open Graph / Twitter image, JSON-LD (`ExhibitionEvent`, `NewsArticle`, `ArtGallery`) and HTTP status; `renderHead(tags)` → escaped `<head>` HTML |
| `text.ts` | `htmlToText`, `firstParagraph`, `firstHtmlParagraph`, `truncate`, `escapeHtml` |

Stored dates are ISO `YYYY-MM-DD` strings for whole days and ISO timestamps for moments in time; display strings are never stored.

## API (`apps/api`)
- `createApp({ db })` builds the Hono app under the `/api` base path. The same app is served by `hono/aws-lambda` (`lambda.ts`) and `@hono/node-server` (`local.ts`, port `PORT`, default 3000).
- Request context (`src/env.ts`): `db`, `userId`, `isAdmin` (resolved per request by `resolveUser`). Admin requests see drafts and hidden slides and get `Cache-Control: private, no-store`; public responses get `s-maxage=60, stale-while-revalidate=300`.
- Content reads live in `src/content/queries.ts`; `src/content/serialize.ts` maps rows to the `@twelveten/shared` types.
- Routes:

  | Method | Path | Auth | Response |
  |---|---|---|---|
  | GET | `/api/health` | public | `{ ok, db }`; 503 when the database is unreachable |
  | GET | `/api/home` | public | `HomePage` (with the linked exhibition's slug, kind and dates) |
  | GET | `/api/exhibitions?kind=` | public | `{ items: ExhibitionSummary[] }`, newest `starts_on` first |
  | GET | `/api/exhibitions/:slug?kind=` | public | `Exhibition` with events, slides (visible only) and linked press |
  | GET | `/api/news?cursor=&limit=` | public | `Page<NewsPost>`, newest first |
  | GET | `/api/news/:slug` | public | `NewsPost` |
  | GET | `/api/press?cursor=&limit=&exhibition=` | public | `Page<PressItem>`, newest first, optionally for one exhibition slug |

- Pagination (`src/content/cursor.ts`): keyset cursors. `nextCursor` is an opaque base64url of the last item's sort value and id; the next page is `WHERE (date, id) < cursor ORDER BY date DESC, id DESC`. `limit` defaults to 10 and is capped at 50; a malformed cursor returns 400.
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
  | `exhibitions` | Exhibitions and fairs (`kind`). Header: `artists` (one per line), `title`, `subtitle`, `title_first`, run dates `starts_on`/`ends_on` (`date`), `timezone`, `hours_text`, `venue_text` (multi-line), `location_text` (short, for list cards), `press_release_url`, `header_links` (`[{label,url}]`), `show_inquire`. Media: `hero_image`/`hero_alt`, `thumbnail`, `slideshow_visible` (off by default), `works_available`. Body: `content` (rich-text JSON document). SEO overrides, `published` |
  | `exhibition_events` | Dated events shown under an exhibition's dates (label, `starts_at`, `ends_at`, `position`), e.g. the opening |
  | `artworks` | Slideshow slides per exhibition: `image` or `video` (mp4), caption fields, `alt`, `hidden`, `available`; `(exhibition_id, position)` unique, deferrable |
  | `news_posts` | News posts: `slug`, `title`, `published_at`, `body_html`, SEO overrides, `published` |
  | `press_items` | Press coverage: outlet, title, `url` (unique), `published_on`, optional `issue_label`/`byline`, optional `exhibition_id` |
  | `home_page` | Single row (`id = 1`): home splash images, text, optional dates, `link_exhibition_id` |
  | `content_revisions` | Snapshots of content changes (entity, entity id, action, `snapshot` JSON, user) |
  | `seed_state` | Markers for one-time seed runs |

## Seed
- `seed(db, { force })` (`src/db/seed.ts`) loads the original site content in one transaction: exhibitions and fairs (body HTML converted to rich documents with `htmlToRich`), their events and slideshow slides (from `apps/web/src/json/*-slideshow.json`), press items (linked to exhibitions), news posts (HTML sanitized with `sanitizeNewsHtml`), and the home splash.
- Rows are matched on natural keys (exhibition slug, press URL, news slug, home id). Without `force`, existing rows are kept and the run is skipped entirely once `seed_state` holds `initial`; with `force`, rows are overwritten and an exhibition's events and slides are replaced.
- `src/lib/sanitize.ts`: `sanitizeNewsHtml` allows `p, br, a, em, i, strong, b, ul, ol, li, img, div, span` with a fixed attribute/class allowlist and `http`/`https`/`mailto` links; `target="_blank"` links get `rel="noopener noreferrer"`.

## Local AWS (LocalStack)
- `localstack` runs S3 and SSM on `localhost:4566` (region `us-east-2`, credentials `test`/`test`). The service reports healthy once its init scripts have run.
- `docker/localstack/init/10-bootstrap.sh` creates, idempotently for stage `local`: buckets `twelveten-local-site` and `twelveten-local-media` (media bucket allows browser `GET`/`PUT`/`HEAD` via CORS) and SecureString parameters `/twelveten/local/better-auth-secret` and `/twelveten/local/db-password`.

## Local development
- `npm install`, then `npm run dev` (Vite dev server).
- `docker compose up -d --wait` starts Postgres on `localhost:5432` (user/password `twelveten`) and LocalStack on `localhost:4566`.
- Copy `.env.example` to `.env.local` for local settings.
- `npm run db:migrate -w apps/api` applies migrations to `DATABASE_URL`; `npm run db:seed -w apps/api` loads the original content (`-- --force` to overwrite); `npm run dev -w apps/api` runs the API with reload. Both read `.env.local` at the repo root when present.
- `npm run build` builds all workspaces.

## Testing
- `npm test`: Vitest across workspaces. `apps/web` tests run in happy-dom with `@vue/test-utils` (`src/**/*.test.js`); `packages/shared` tests run in Node (`src/**/*.test.ts`); `apps/api` tests run in Node against the `twelveten_test` database (override with `TEST_DATABASE_URL`), one file at a time, and need `docker compose up` first.
- `npx tsc -p packages/shared` / `npx tsc -p apps/api`: type-check (`tsconfig.base.json` holds the common compiler options).
- `npm run test:e2e`: builds the site and runs Playwright against `vite preview` (needs the API on port 3000 with seeded data). Visual tests compare each page against the committed baseline in `e2e/__screenshots__/`; refresh it intentionally with `npx playwright test --update-snapshots`.
