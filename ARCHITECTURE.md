# Architecture

## Overview
Twelve Ten Gallery website: a Vue 3 single-page app built with Vite and styled with Tailwind CSS 4, plus a TypeScript API (Hono) backed by Postgres via Kysely. All content (exhibitions, fairs, slideshows, news, press, home splash) lives in the database and is read by the site through `/api`.

## Repo layout
npm workspaces:

| Path | Contents |
|---|---|
| `apps/web` | Vue 3 SPA (`@twelveten/web`): pages, components, API client, editor (`src/admin`), Vite plugins (`vite/`) |
| `.media/` (git-ignored) | Local copy of the site's media (`images/`, `docs/`), served at `/media/*` in development and uploaded to the media bucket with `media:sync` |
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
- Routes: `/`, `/about`, `/exhibitions`, `/exhibitions/:slug`, `/fairs`, `/fairs/:slug`, `/news`, `/news/:slug`, `/documents/beech-von-sternberg-interview`, `/admin/login` (`/admin` redirects there), legacy redirects from `REDIRECTS`, and a catch-all 404.
- Data: `src/api/client.ts` (`api.*` typed fetchers against same-origin `/api`). `useResource` loads data reactively with loading / not-found / error state. `useMeta` sets title, description, canonical, Open Graph / Twitter tags and JSON-LD from `buildMeta`.
- Exhibitions and fairs: `pages/ExhibitionDetail.vue` loads one by slug and renders `components/exhibition/ExhibitionTemplate.vue`: optional slideshow (`slideshowVisible`), hero image (two columns) or a single narrow column when there is no hero, `ExhibitionHeader.vue` (artists/title/subtitle, PDF and header links, derived dates and events, venue, hours, Inquire button), and the body (`RichContent.vue` renders the API's `contentHtml` and replaces the `pressList` placeholder with the exhibition's press).
- Lists: `pages/Exhibitions.vue` (thumbnail grid) and `pages/Fairs.vue` (text cards) group items into Current / Upcoming / Past with `exhibitionStatus` on the gallery's local date.
- News: `pages/News.vue` shows Press and Gallery News side by side; each list loads 10 items at a time as the reader scrolls (`useInfiniteList`: IntersectionObserver sentinel with a 600px margin, no concurrent fetches, retry on error, a keyboard-reachable "Load more", `aria-live` announcements). Loaded items and scroll position persist for the session so back navigation restores them. `/news/:slug` shows one post.
- Home: `pages/Home.vue` renders the splash from `/api/home` (desktop/mobile background with focal point, headline, subline, extra text, derived dates, black/white text) and links it to the chosen exhibition or fair.
- Styling: `src/style.css` imports Tailwind, adds `packages/shared/src` as a class source (classes emitted by the rich-text renderer), and defines theme fonts. SFC `<style>` blocks that use `@apply` start with `@reference "@/style.css";`. Global element styles in `App.vue` live in `@layer base` so utility classes override them.
- Dev server and `vite preview` proxy `/api` to `API_TARGET` (default `http://localhost:3000`, with `X-Forwarded-For`) and `/media/*` to the media bucket on LocalStack (`MEDIA_TARGET`, `MEDIA_BUCKET`).

## In-place editing (`apps/web/src/admin`)
- Session: `src/session.ts` checks `/api/session` only when this browser has signed in before (a `localStorage` hint set by `/admin/login`). `App.vue` mounts `admin/AdminLayer.vue` (a separate chunk) only when the user is an admin; the editors (`ExhibitionEditor`, `HomeEditor`, `EditableNewsEntry`, `EditablePressEntry`) and Tiptap are further lazy chunks, so public visitors download none of it.
- Edit mode (`admin/state.ts`): `editMode.editing` (kept in `sessionStorage` across reloads), the current page's `PageEditor` (dirty flag, save, discard, publish, history, settings, delete), toasts, and a conflict prompt. Pages register with `useEditablePage`; `useUnsavedGuard` and a router guard warn before leaving with unsaved changes.
- Admin bar (`AdminLayer.vue`): shown while editing — page label, Draft badge, unsaved indicator, Published switch, Settings, History (restore any revision), Discard, Save (`Ctrl/Cmd+S`), and a menu to create an exhibition, fair, news post or press item, delete the page, re-publish all pages, stop editing or sign out. A floating "Edit site" button turns editing on.
- Exhibitions and fairs (`ExhibitionEditor.vue`): the same layout and classes as the public template, with artists/title (`InlineText`, plain-text `contenteditable`), dates (`DateRangePicker`, Reka UI range calendar), events (`EventsEditor`: label, day, start/end time in the exhibition's time zone), venue and hours inline; hero image and press-release PDF upload/replace/remove; body in `RichEditor` (Tiptap with the shared schema: paragraph styles, bold/italic/link, lists, image with caption and alt text, YouTube video, bio, press list, undo/redo). Page fields are saved together with a version check; a 409 opens the conflict prompt (reload theirs / overwrite). `ExhibitionSettings` covers type, web address, subtitle, list location, time zone, title-first, Inquire button, header links, thumbnail, hero alt text and SEO overrides with a live share-card preview.
- Slideshow (`SlideshowEditor.vue`): shown above the page while editing — show/hide slideshow, works available, drag to reorder (SortableJS), multi-file upload of images and MP4s, per-slide caption/alt editing, replace file, hide, mark available, delete. Slide changes save immediately.
- Home (`HomeEditor.vue`): desktop/mobile background upload, focus point picked by clicking the image, text colour, headline/subline/extra line inline, link target (any exhibition or fair), optional dates when unlinked, SEO overrides.
- News page: each post and press item becomes editable in place and is saved on its own (title, date picker, body in `RichEditor` news mode; outlet, title, date or issue label, byline, link, linked exhibition), with publish toggles, delete and history; "+ New post" / "+ Add press" create drafts at the top.
- Uploads (`admin/upload.ts`): request a presigned URL from `/api/admin/uploads`, then `PUT` the file directly to S3 with progress.
- UI primitives (`admin/ui/`): Reka UI dialog, switch, dropdown, popover and calendars styled with Tailwind; admin styles in `admin/admin.css` (loaded with the admin chunk).
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
  | GET, POST | `/api/auth/*` | public | Better Auth (`/sign-in/email`, `/sign-out`, `/get-session`, …) |
  | GET | `/api/session` | public | `{ user: { id, name, email, role } \| null }` |
  | GET | `/api/meta?path=` | public | `{ status, html, tags }`: the head tags for a site path (dev server) |
  | GET | `/api/home` | public | `HomePage` (with the linked exhibition's slug, kind and dates) |
  | GET | `/api/exhibitions?kind=` | public | `{ items: ExhibitionSummary[] }`, newest `starts_on` first |
  | GET | `/api/exhibitions/:slug?kind=` | public | `Exhibition` with events, slides (visible only), linked press and `contentHtml` |
  | GET | `/api/news?cursor=&limit=` | public | `Page<NewsPost>`, newest first |
  | GET | `/api/news/:slug` | public | `NewsPost` |
  | GET | `/api/press?cursor=&limit=&exhibition=` | public | `Page<PressItem>`, newest first, optionally for one exhibition slug |
  | GET | `/api/admin/exhibitions/:id` | admin | `Exhibition` including drafts and hidden slides |
  | POST | `/api/admin/exhibitions` | admin | Create a draft exhibition or fair (unique slug from the title) |
  | PATCH | `/api/admin/exhibitions/:id` | admin | Update fields; `content` is sanitised through the rich-text schema |
  | DELETE | `/api/admin/exhibitions/:id` | admin | Delete (slides and events cascade) |
  | PUT | `/api/admin/exhibitions/:id/events` | admin | Replace the event list |
  | POST | `/api/admin/exhibitions/:id/artworks` | admin | Append a slide (image or video) |
  | PATCH / DELETE | `/api/admin/artworks/:id` | admin | Edit / delete a slide (positions stay contiguous) |
  | PUT | `/api/admin/exhibitions/:id/artworks/order` | admin | Reorder slides (`ids` must list every slide once) |
  | POST, PATCH, DELETE | `/api/admin/news[/:id]` | admin | News posts (HTML sanitised with `sanitizeNewsHtml`) |
  | POST, PATCH, DELETE | `/api/admin/press[/:id]` | admin | Press items |
  | PATCH | `/api/admin/home` | admin | Home splash |
  | GET | `/api/admin/revisions?entity=&id=` | admin | Last 50 revisions of one item |
  | POST | `/api/admin/revisions/:id/restore` | admin | Restore that revision (a deleted exhibition comes back with its slides) |
  | POST | `/api/admin/uploads` | admin | Presigned S3 `PUT` for an image, mp4 or PDF (≤ 200 MB) → `{ uploadUrl, url, key, headers }` |
  | POST | `/api/admin/publish/rebuild` | admin | Re-render every page |

- Admin writes (`src/routes/admin/index.ts`): bodies are validated with the zod schemas in `@twelveten/shared` (`admin.ts`). Every update sends the `updatedAt` it last saw; a mismatch (compared at millisecond precision) returns 409 with the current copy. Each create/update/delete writes a `content_revisions` snapshot and then asks the `Publisher` to re-render the affected pages (the item's page, its list page, and `/` when the home splash links to it). Postgres constraint errors map to 400/409.
- Pagination (`src/content/cursor.ts`): keyset cursors. `nextCursor` is an opaque base64url of the last item's sort value and id; the next page is `WHERE (date, id) < cursor ORDER BY date DESC, id DESC`. `limit` defaults to 10 and is capped at 50; a malformed cursor returns 400.
- Unknown `/api/*` paths return JSON 404s; unhandled errors return JSON 500s.
- Configuration (`src/config.ts`, validated with zod from the environment): `DATABASE_URL` (required), `DATABASE_POOL_MAX` (default 5), `DATABASE_SSL` (`true`/`false`), `SITE_URL`, `PORT`, `NODE_ENV`, `BETTER_AUTH_SECRET` (≥ 32 chars), `AWS_REGION`, `AWS_ENDPOINT_URL` (LocalStack), `MEDIA_BUCKET`, `SITE_BUCKET`, `MEDIA_PUBLIC_PREFIX` (default `/media`). `src/services.ts` wires auth, storage and the publisher from this configuration for `lambda.ts` and `local.ts`.

## Auth
- Better Auth (`src/auth/auth.ts`) mounted at `/api/auth/*`: email/password with public sign-up disabled, the `admin` plugin (`user.role`), UUIDv7 ids, sessions and rate limits stored in Postgres (sign-in limited to 5 attempts per minute), 7-day sessions refreshed daily, cookies prefixed `twelveten` (`HttpOnly`, `SameSite=Lax`, `Secure` when `SITE_URL` is https), `trustedOrigins` = `SITE_URL`.
- Each request resolves the session into `userId` / `isAdmin`; banned users count as signed out.
- `npm run admin:create -w apps/api -- --email … [--password …] [--name …]` creates an admin or resets an existing user's password and makes them admin (`src/auth/users.ts`); without `--password` a random one is printed.

## File storage
- All media is served under `/media/*` from the media bucket (`media/` key prefix): the original site images and PDFs at `/media/images/…` and `/media/docs/…`, admin uploads at `/media/uploads/…`. Content stores these site-relative URLs.
- `npm run media:sync -w apps/api [-- --dry-run] [--dir …] [--bucket …]` (`src/media/sync.ts`) uploads `.media/` to `media/<path>` in `MEDIA_BUCKET` with content types and a one-year cache header, skipping objects already present with the same size.
- In development `apps/web/vite/mediaPlugin.js` serves `/media/images` and `/media/docs` from `.media/` (with Range support for video) and the Vite proxy sends `/media/uploads/*` to the LocalStack media bucket.
- `src/storage/uploads.ts`: presigned S3 `PUT` URLs (15 minutes) into the media bucket under `media/uploads/{yyyy}/{mm}/{uuidv7}-{slug}.{ext}`; allowed types are JPEG, PNG, WebP, GIF, SVG, MP4 and PDF (`UPLOAD_TYPES`). The browser uploads directly to S3; the stored URL is `/media/uploads/…`, served from the media bucket at `/media/*`.

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

## Prerendering and meta tags
- `apps/web/index.html` holds an `<!--app-head-->` placeholder. `apps/web/vite/metaPlugin.js` fills it: in dev from `/api/meta?path=` for the requested URL; in a build it writes `dist/_template.html` (placeholder kept), `dist/index.html` (site defaults) and `dist/404.html` (not-found title, `noindex`).
- `src/publish/head.ts`: `headFor(db, path, siteUrl)` resolves a path with `matchRoute`, loads published content, and returns `buildMeta` tags + `renderHead` HTML (status 404 for unknown, unpublished or wrong-kind pages). `allPaths`, `sitemapXml` (published pages with `lastmod`) and `robotsTxt` (disallows `/admin` and `/api/`).
- `src/publish/s3Publisher.ts` implements `Publisher` against the site bucket: `render(paths)` reads `_template.html` from the bucket (cached per process), writes `<path>/index.html` (`text/html`, `Cache-Control: public, max-age=60, stale-while-revalidate=300`), deletes pages that now 404, and rewrites `sitemap.xml` and `robots.txt`. `rebuildAll()` renders every path and deletes stale `exhibitions/*`, `fairs/*`, `news/*` pages. Before `_template.html` exists in the bucket it logs a warning and writes nothing.
- On the client, `useMeta` keeps the head in sync during in-app navigation.

## Seed
- `seed(db, { force })` (`src/db/seed.ts`) loads the original site content in one transaction (old `/images/…` and `/docs/…` references are rewritten to `/media/…`): exhibitions and fairs (body HTML converted to rich documents with `htmlToRich`), their events and slideshow slides (from `apps/web/src/json/*-slideshow.json`), press items (linked to exhibitions), news posts (HTML sanitized with `sanitizeNewsHtml`), and the home splash.
- Rows are matched on natural keys (exhibition slug, press URL, news slug, home id). Without `force`, existing rows are kept and the run is skipped entirely once `seed_state` holds `initial`; with `force`, rows are overwritten, an exhibition's events and slides are replaced, and `content_revisions` is cleared.
- `src/lib/sanitize.ts`: `sanitizeNewsHtml` allows `p, br, a, em, i, strong, b, ul, ol, li, img, div, span` with a fixed attribute/class allowlist and `http`/`https`/`mailto` links; `target="_blank"` links get `rel="noopener noreferrer"`.

## Local AWS (LocalStack)
- `localstack` runs S3 and SSM on `localhost:4566` (region `us-east-2`, credentials `test`/`test`). The service reports healthy once its init scripts have run.
- `docker/localstack/init/10-bootstrap.sh` creates, idempotently for stage `local`: buckets `twelveten-local-site` and `twelveten-local-media` (media bucket allows browser `GET`/`PUT`/`HEAD` via CORS) and SecureString parameters `/twelveten/local/better-auth-secret` and `/twelveten/local/db-password`.

## Local development
- Prerequisites: Node 22+, Docker. `npm install`, then `npm run dev` (`scripts/dev.ts`):
  1. creates `.env.local` from `.env.example` on first run (random `BETTER_AUTH_SECRET`) and adds local admin credentials (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) if missing;
  2. `docker compose up -d --wait` (Postgres, LocalStack);
  3. applies migrations, seeds the original content (skipped once applied), and creates/updates the local admin;
  4. starts the API (`tsx watch`, port 3000) and Vite (port 5173, or the next free port) with prefixed, coloured output; the API is told the site's origin so sign-in works on that port;
  5. waits for both and prints the site, admin login (with credentials when they were just created), API, LocalStack and Postgres addresses. A warning is shown when `.media/` is missing.
- Ctrl+C stops the API and site; `npm run dev:down` stops the containers; `npm run db:reset` also deletes the database volume (the next `npm run dev` re-seeds).
- `npm run dev:web` runs only the site (expects an API at `API_TARGET`).
- Individual commands: `npm run db:migrate|db:seed|admin:create|media:sync -w apps/api`. All read `.env.local` at the repo root; variables already set in the environment take precedence.
- `npm run typecheck` type-checks all workspaces (`vue-tsc` for the site).

## Deployment (AWS, `apps/api/serverless.yml`, OSS Serverless `osls`)
- Topology:

  ```mermaid
  flowchart LR
    V[Browser] --> CF[CloudFront]
    CF -- "default: prerendered HTML (viewer-request function)" --> SB[(S3 site bucket)]
    CF -- "/assets/*" --> SB
    CF -- "/media/*" --> MB[(S3 media bucket)]
    CF -- "/api/* + X-Origin-Verify" --> FN[api Lambda — function URL]
    FN --> DB[(RDS Postgres 17)]
    FN -- "S3 gateway endpoint" --> SB
    V -- "presigned PUT" --> MB
    EB[EventBridge daily] --> RB[rebuild Lambda] --> SB
  ```

- One container image (`apps/api/Dockerfile`, built from the repo root; `build.mjs` bundles `lambda`, `migrate` and `rebuild` handlers with esbuild; the RDS CA bundle is baked in and `DATABASE_SSL=true`) backs three functions: `api` (function URL, 1024 MB, 29 s, reserved concurrency 10), `migrate` (`osls invoke -f migrate`), and `rebuild` (daily at 06:15 UTC, and after each site deploy).
- Network: a VPC with two private subnets and no NAT gateway; the Lambdas reach S3 through a gateway endpoint and RDS through a security group. Nothing at runtime calls other AWS services.
- Secrets: SSM SecureStrings `/twelveten/<stage>/{db-password, better-auth-secret, origin-verify-secret}` (created by `npm run secrets:init -w apps/api -- --stage <stage>`) are resolved at deploy time into Lambda environment variables; RDS reads the password with `{{resolve:ssm-secure:…}}`.
- RDS: `db.t4g.micro`, 20 GB gp3 (autoscaling to 100), encrypted, private, 7-day backups, snapshot on deletion; deletion protection on `prod`.
- Buckets: site (private, CloudFront-only), media (private, versioned, old versions expire after 90 days, CloudFront reads `media/*`, browsers `PUT` presigned uploads; CORS limited to the site origin; retained if the stack is deleted).
- CloudFront: default → site bucket with `cloudfront/viewer-request.js` (legacy redirects, `/path` → `/path/index.html`, `/admin/login` → SPA shell); `/assets/*` and `/media/*` cached; `/api/*` → function URL with an `X-Origin-Verify` header the API requires (`ORIGIN_VERIFY_SECRET`), all query strings and cookies forwarded, cache key includes the session cookie so admin responses are never shared; S3 403/404 → `/404.html` with status 404.
- Per-stage settings: `apps/api/config.<stage>.yml` (git-ignored; see `config.example.yml`): `siteUrl`, optional `domain` + `certificateArn` (ACM, us-east-1).
- Releasing:
  1. `npm run secrets:init -w apps/api -- --stage <stage>` (once)
  2. `npx osls deploy --stage <stage>` in `apps/api` (builds and pushes the image to ECR, creates/updates the stack)
  3. `npx osls invoke -f migrate --stage <stage>`
  4. `npm run media:sync -w apps/api -- --bucket <MediaBucketName>` (first time, and whenever `.media/` changes)
  5. `npm run build -w apps/web && npm run deploy:site -w apps/api -- --stage <stage>` (uploads `dist/` with cache headers, then invokes `rebuild`)
- `npm run lambda:local` builds the image and runs it with the Lambda Runtime Interface Emulator behind an HTTP adapter on port 3001 (Function URL event format), connected to the docker-compose services; `API_TARGET=http://localhost:3001 npm run dev:web` runs the site against it.

## Testing
- `npm test`: Vitest across workspaces. `apps/web` tests run in happy-dom with `@vue/test-utils` (`src/**/*.test.js`); `packages/shared` tests run in Node (`src/**/*.test.ts`); `apps/api` tests run in Node against the `twelveten_test` database (override with `TEST_DATABASE_URL`), one file at a time, and need `docker compose up` first.
- `apps/api/src/cloudfront.test.ts` checks the CloudFront function's rewrites and that its redirects match `REDIRECTS`.
- `npx tsc -p packages/shared` / `npx tsc -p apps/api`: type-check (`tsconfig.base.json` holds the common compiler options).
- `npm run test:e2e`: builds the site and runs Playwright against `vite preview` (needs the API on port 3000 with seeded data and the local admin). Projects: `desktop` and `mobile` run the visual tests (each page against the committed baseline in `e2e/__screenshots__/`; refresh intentionally with `npx playwright test --update-snapshots`); `admin-setup` signs in once and saves the session to `e2e/.auth/` (git-ignored); `editing` runs the in-place editing flows with that session (edit and save an exhibition, restore from history, date range picker, create/publish/delete a fair and link the home splash to it, news and press create/edit/delete, infinite loading in batches of 10).
