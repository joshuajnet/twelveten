# Architecture

## Overview
Twelve Ten Gallery website: a Vue 3 single-page app built with Vite and styled with Tailwind CSS 4, plus a TypeScript API (Hono) backed by Postgres via Kysely. All content (exhibitions, fairs, slideshows, news, press, home splash) lives in the database and is read by the site through `/api`. An admin-only back office at `/admin` manages people, artist and collector profiles, the works inventory (private prices and sales) and invoices.

## Repo layout
npm workspaces:

| Path | Contents |
|---|---|
| `apps/web` | Vue 3 SPA (`@twelveten/web`): pages, components, API client, in-place editor (`src/admin`), back office (`src/backoffice`), Vite plugins (`vite/`) |
| `.media/` (git-ignored) | Local copy of the site's media (`images/`, `docs/`), served at `/media/*` in development and uploaded to the media bucket with `media:sync` |
| `apps/api` | `@twelveten/api`: Hono app (`src/app.ts`), Lambda entry (`src/lambda.ts`), local Node server (`src/local.ts`), database access and migrations (`src/db/`), people and inventory queries (`src/people/`, `src/inventory/`) |
| `packages/shared` | `@twelveten/shared` TypeScript source used by other workspaces: content, people, address and inventory schemas (zod), date formatting, route table, meta-tag builder |
| `docker-compose.yml` | Local services: Postgres 17 (databases `twelveten` and `twelveten_test`) and LocalStack 4.14.0 (S3, SSM) |
| `docker/` | Container init: Postgres test-database creation, LocalStack bootstrap (`docker/localstack/init/10-bootstrap.sh`) |
| `apps/api/seed-data` | Original site content for the initial seed: `exhibitions.ts` (header data), `exhibitions/<slug>.html` / `<slug>.bio.html` (body text), `slideshows/*.json`, `press.ts`, `news.ts` + `news.json`, `home.ts` |
| `e2e/` | Playwright tests; `e2e/visual` holds full-page screenshot tests for every public URL |
| `vitest.config.ts` | Root Vitest config; each workspace defines a Vitest project |
| `playwright.config.ts` | Playwright config (desktop + mobile projects; serves the built site with `vite preview`) |

## Frontend (`apps/web`)
- Entry: `src/main.js` mounts `App.vue` with `vue-router` (`src/router.ts`, HTML5 history, every page lazy-loaded), `@unhead/vue` (document head) and `vue3-lazyload`.
- Routes: `/`, `/about`, `/exhibitions`, `/exhibitions/:slug`, `/fairs`, `/fairs/:slug`, `/news`, `/news/:slug`, `/documents/beech-von-sternberg-interview`, `/admin/login` (signing in goes to `next` or `/admin`), the back office under `/admin` (below), legacy redirects from `REDIRECTS`, and a catch-all 404.
- `App.vue` renders routes with `meta.backoffice` on their own (no site header, footer or editing bar).
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
- Admin bar (`AdminLayer.vue`): shown while editing — an "Admin" link to the back office at the far left, page label, Draft badge, unsaved indicator, Published switch, Discard, a create menu (exhibition, fair, news post, press item), a cog menu (page settings, History to restore any revision, delete the page, recently deleted, re-publish all pages, stop editing, sign out), with Save (`Ctrl/Cmd+S`) centred between the page details (left) and the controls (right). A floating "Edit site" button (crossed wrench and screwdriver icon, left edge) turns editing on.
- Exhibitions and fairs (`ExhibitionEditor.vue`): the same layout and classes as the public template, with artists/title (`InlineText`, plain-text `contenteditable`), dates (`DateRangePicker`, Reka UI range calendar), events (`EventsEditor`: label, day, start/end time in the exhibition's time zone), venue and hours inline; hero image and press-release PDF upload/replace/remove; body in `RichEditor` (Tiptap with the shared schema: paragraph styles, bold/italic/link, lists, image with caption and alt text, YouTube video, bio, press list, undo/redo). Page fields are saved together with a version check; a 409 opens the conflict prompt (reload theirs / overwrite). `ExhibitionSettings` covers type, web address, subtitle, list location, time zone, title-first, Inquire button, header links, thumbnail, hero alt text and SEO overrides with a live share-card preview.
- Slideshow (`SlideshowEditor.vue`): shown above the page while editing — show/hide slideshow, works available, drag to reorder (SortableJS), multi-file upload of images and MP4s, per-slide caption/alt editing, replace file, hide, mark available, delete. Slide changes save immediately.
- Home (`HomeEditor.vue`): desktop/mobile background upload, focus point picked by clicking the image, text colour, headline/subline/extra line inline, link target (any exhibition or fair), optional dates when unlinked, SEO overrides.
- News page: each post and press item becomes editable in place and is saved on its own (title, date picker, body in `RichEditor` news mode; outlet, title, date or issue label, byline, link, linked exhibition), with publish toggles, delete and history; "+ New post" / "+ Add press" create drafts at the top.
- Uploads (`admin/upload.ts`): request a presigned URL from `/api/admin/uploads`, then `PUT` the file directly to S3 with progress.
- UI primitives (`admin/ui/`): Reka UI dialog, switch, dropdown, popover and calendars styled with Tailwind; admin styles in `admin/admin.css` (loaded with the admin chunk).
- Slide links (`SlideshowEditor`, `LinkSlideDialog`): each slide tile shows its inventory link as an artist chip and a work chip (opening `/admin/people/:id/artist` and `/admin/works/:id` in a new tab), or a "Link artist" button; an "Unlinked images: N" badge sits above the grid. Linking looks the artist up with the back office's `PersonPicker` (search starts from the slide's artist caption; the exhibition's linked artists rank first; "Create new person" is offered), then either creates a work from the slide's caption and image or picks one of the artist's existing works. The caption dialog can change or remove the link.
- `@` resolves to `apps/web/src`.

## Back office (`apps/web/src/backoffice`)
- Admin-only pages under `/admin`, a separate lazy chunk with its own layout (`BackofficeLayout.vue`: the gallery name in Germania One, a sidebar with People, Artists, Collectors, Inventory and Invoices, a drawer on phones, "View site", sign-out, toasts and the conflict prompt, `noindex`). The route's `beforeEnter` loads the session and sends non-admins to `/admin/login?next=…`. Reuses the editor's Reka UI primitives (`admin/ui/`: `Dialog`, `Field`, `SelectField`, …), `RichEditor`, `HistoryDialog`, `MediaButton` and `upload.ts`.
- Routes: `/admin` → `/admin/people`; `/admin/people` (`PeopleList`); `/admin/people/:id/:profile?` (`PersonPage`); `/admin/works/:id` (`WorkDetail`; `new` with `?artist=` for a new work); `/admin/inventory` (`InventoryList`); `/admin/invoices` (`InvoicesList`); `/admin/invoices/new` (`InvoiceNew`); `/admin/invoices/settings` (`InvoiceSettings`); `/admin/invoices/:id` (`InvoicePage`).
- People list: one table of everyone with a profile-type filter (All, one entry per `PROFILE_TYPES` type, No profile), search (name, email, phone, city), sort (sort name, recently updated) and page, all kept in the URL; changing a filter returns to page 1. Columns: name, email, phone, city, and profiles (with the Artists filter: works, available works, last exhibition instead; with the Collectors filter: works collected, artists collected, open invoices). "New person" can add artist and collector profiles. Numbered pages of `PEOPLE_PAGE_SIZE` (25) with "Showing 1–25 of N", Previous/Next and page numbers (`Pagination.vue`). Rows are links (the name link covers the row); with a profile filter the row opens that profile's tab.
- Person page: details first (portrait, name, sort name, date and place of birth, website, private notes, email, phone; one Save with version check, History, Delete when the person has no profiles), addresses (`AddressesEditor`: structured address cards with label, primary, reorder, edit, remove; saved immediately; reusable for any `AddressEntity`), purchases (works this person bought; hidden when they have a collector profile, which shows them by artist), then the profile tabs. The active tab is the `:profile` URL segment; "+ Add profile" offers missing types. Panels are registered per type in `profiles/index.ts`.
- Artist panel (`profiles/ArtistProfilePanel.vue`): inventory prefix (editable, with the next number), bio and CV in `RichEditor` (news mode), "Download PDF" for the CV, linked exhibitions (add/remove, linking to the public pages), press (newest first: every press item about a linked exhibition plus press linked to the artist directly; outlet, date or issue label, title linking to the article or uploaded file, byline, the exhibition or "External press", "Not on site" when unpublished; "+ Add press" opens a dialog for outside coverage with a link or an uploaded PDF/image, and directly linked items can be edited or removed; exhibition press is edited on the News page), works gallery (cover image with title, date, medium, dimensions, inventory number, status and price; status filter; "+ Add work"), History and Remove profile.
- Collector panel (`profiles/CollectorProfilePanel.vue`): the artists they collect (chips linking to each artist's profile, with counts), then the collection grouped by artist (A–Z, each heading linking to the artist) as work cards; their invoices (number, date, works, total, balance, status); "+ New invoice" (choose among the works on hold for them, optional discount); private collector notes; Remove profile (not while they have invoices).
- Invoices list: every invoice, newest first, with search (number, collector, work title or artist) and a status filter; numbered pages of `INVOICES_PAGE_SIZE` (25); "+ New invoice" and Invoice settings.
- New invoice: choose the buyer with `PersonPicker` (or create one), then tick works from the whole inventory (any artists; search, show available / on hold / all, numbered pages); works on hold for or sold to someone else, or not for sale, can't be ticked. A side panel lists the chosen works with discount %, sales tax % (default from settings), date and live totals; "Create invoice" puts available works on hold for the buyer and opens the invoice.
- Invoice page: line items (image, caption, editable price, remove, add another of the collector's on-hold works), the printed fields (number, date, "To" block, discount %, sales tax %, shipping, status, terms) and private notes with one Save and version check, live totals, payments (amount, date received, method, note; "Paid in full"; remove), View PDF / Download PDF, Delete (only without payments). Item and payment changes save immediately.
- Invoice settings: gallery name, address, email, phone, number prefix, default sales tax and terms; the env payment details are shown read-only (account number masked).
- Inventory: every work, newest first, with search and artist / status / location filters; numbered pages of `WORKS_PAGE_SIZE` (25) with the same `Pagination` control; filters and page are in the URL.
- Work page: caption fields and inventory number (left blank on a new work, it is assigned on save), images (upload, alt text, drag to reorder, remove), price and currency, status, location and consignment dates, sale (date, price, buyer chosen with `PersonPicker`, notes), private notes, an optional reason for the change, the price/status history timeline, the slideshows that show the work, its invoices (with "Create invoice for <buyer>" once it is saved as on hold for a buyer), Versions and Delete. A new work is an unsaved form until Save.
- `useUnsavedGuard` (`guard.ts`) warns before leaving pages with unsaved edits (in-app navigation, reload, closing the tab); Ctrl/Cmd+S saves.

## Shared package (`packages/shared`)
Consumed as TypeScript source (`exports` point at `src/*.ts`); no build step.

| Module | Provides |
|---|---|
| `content.ts` | zod schemas + types for API payloads: `Exhibition` (admin reads add `linkedArtists`), `ExhibitionSummary`, `ExhibitionEvent`, `Artwork` (admin reads add `link`: work and artist), `PressItem`, `NewsPost`, `HomePage`, rich-text documents (Tiptap JSON), `Page<T>` (`{ items, nextCursor }`), `PAGE_SIZE` = 10, `MAX_PAGE_SIZE` = 50 |
| `people.ts` | `PROFILE_TYPES` (profile registry: `artist`, `collector`), `PEOPLE_PAGE_SIZE`, `NumberedPage<T>`, `Person`, `PersonSummary`, `ArtistProfile`, `CollectorProfile` (collection grouped by artist as `CollectionArtist[]`, invoices), person / artist-profile / collector-profile / linked-exhibition input schemas, `defaultSortName` |
| `addresses.ts` | `addressEntity` (owners an address can attach to: `person`), `Address`, `AddressLink`, attach / patch schemas, `formatAddress` |
| `invoices.ts` | `INVOICE_STATUSES` (`open`, `partial`, `paid`, `cancelled`), `isUnpaid`, `Invoice`, `InvoiceSummary`, `InvoiceItem`, `InvoicePayment`, `InvoiceSettings` (+ env `InvoicePaymentDetails`), create / patch / item / payment / settings schemas, `invoiceTotals` (discount, tax on the discounted subtotal, shipping; halves round to even), `statusFromPayments`, `parsePercent`, `formatPercent`, `INVOICES_PAGE_SIZE` |
| `inventory.ts` | `WORK_STATUSES`, `WORK_LOCATIONS`, `WORK_CHANGE_FIELDS`, `Work`, `WorkSummary` (with `buyerId`), `WorkImage`, `WorkChange`, work / image / slide-link input schemas, `WORKS_PAGE_SIZE`, `formatPrice`, `parsePrice` |
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
  | GET | `/api/admin/persons?q=&profile=&sort=&page=&limit=` | admin | `NumberedPage<PersonSummary>` (`{ items, page, pageSize, total }`, default 25, max 100); `profile` = a profile type or `none`; `sort` = `name` (sort name, default) or `updated` |
  | POST, GET, PATCH, DELETE | `/api/admin/persons[/:id]` | admin | People (`profiles: ['artist']` on create adds the profile); GET returns `Person` with addresses, artist profile and purchases; DELETE is 409 while an artist profile exists |
  | PUT, DELETE | `/api/admin/persons/:id/artist-profile` | admin | Create or update (bio/CV sanitised; `updatedAt` required to update) / remove (409 while the artist has works) |
  | PUT | `/api/admin/persons/:id/artist-profile/exhibitions` | admin | Replace the linked exhibitions |
  | POST | `/api/admin/persons/:id/artist-profile/press` | admin | Link press to the artist: `{ pressId }` or a new item `{ press }` (created unpublished with no exhibition; an existing URL is linked instead of duplicated) |
  | DELETE | `/api/admin/persons/:id/artist-profile/press/:pressId` | admin | Unlink; an item left with no artist, no exhibition and not published is deleted |
  | GET | `/api/admin/persons/:id/artist-profile/cv.pdf` | admin | The CV as a PDF (download) |
  | GET, POST | `/api/admin/addresses` | admin | List an owner's addresses (`?entity=&id=`) / create-and-attach or attach an existing address |
  | PATCH, DELETE | `/api/admin/addresses/:id` | admin | Edit (version check) / delete an address everywhere |
  | PATCH, DELETE | `/api/admin/address-links/:id` | admin | Label, primary, position / detach |
  | PUT, DELETE | `/api/admin/persons/:id/collector-profile` | admin | Create or update the collector notes (`updatedAt` required to update) / remove (409 while they have invoices) |
  | GET | `/api/admin/invoices?status=&person=&q=&page=&limit=` | admin | `NumberedPage<InvoiceSummary>`, newest first |
  | POST | `/api/admin/invoices` | admin | Create from works (`personId`, `workIds`, optional `issuedOn`, `discountBps`, `taxRateBps`, `shippingCents`): next number `<prefix><year>-NNN`, "To" block from the person's name, primary address, phone and email, default tax and terms from settings; available works go on hold for the buyer; the buyer gets a collector profile. Works held for or sold to someone else, or not for sale, are refused |
  | GET, PATCH, DELETE | `/api/admin/invoices/:id` | admin | Read / edit printed fields and status (version check) / delete (409 with payments) |
  | POST, PATCH, DELETE | `/api/admin/invoices/:id/items[/:itemId]` | admin | Add a work (snapshot of caption, cover image and price) / edit an item's price or caption / remove |
  | POST, DELETE | `/api/admin/invoices/:id/payments[/:paymentId]` | admin | Record / remove a payment |
  | GET | `/api/admin/invoices/:id/invoice.pdf[?download=1]` | admin | The invoice as a PDF (inline, or attachment) |
  | GET, PUT | `/api/admin/invoice-settings` | admin | Gallery details, number prefix, default tax and terms (version check); GET also returns the env payment details with the account masked |
  | GET | `/api/admin/works?artist=&status=&location=&q=&page=&limit=` | admin | `NumberedPage<WorkSummary>` (default 25, max 100), newest first |
  | POST, GET, PATCH, DELETE | `/api/admin/works[/:id]` | admin | Works (POST may include images); PATCH records `work_changes` for price, status, location, consignment and sale changes (with `changeNote`) |
  | GET | `/api/admin/works/:id/history` | admin | `WorkChange[]`, newest first |
  | POST, PATCH, DELETE, PUT | `/api/admin/works/:id/images[/:imageId \| /order]` | admin | Add / alt text / remove / reorder work images |
  | POST | `/api/admin/artworks/:id/link` | admin | Link a slide to a person: adds the artist profile if missing, creates a work from the slide (or uses `workId`), adds the artist to the exhibition; `PATCH /api/admin/artworks/:id` with `workId: null` unlinks |

- Admin writes (`src/routes/admin/index.ts`; people and addresses in `people.ts`, works and slide links in `inventory.ts`, collectors' invoices in `invoices.ts`, shared helpers in `util.ts`): bodies are validated with the zod schemas in `@twelveten/shared` (`admin.ts`). Every update sends the `updatedAt` it last saw; a mismatch (compared at millisecond precision) returns 409 with the current copy. Each create/update/delete writes a `content_revisions` snapshot and then asks the `Publisher` to re-render the affected pages (the item's page, its list page, and `/` when the home splash links to it). People, profiles, addresses, works and slide links change nothing public and are not re-rendered; their data (prices, sales, contact details, notes) only appears in `/api/admin/*` responses. Postgres constraint errors map to 400/409.
- Pagination (`src/content/cursor.ts`): keyset cursors. `nextCursor` is an opaque base64url of the last item's sort value and id; the next page is `WHERE (date, id) < cursor ORDER BY date DESC, id DESC`. `limit` defaults to 10 and is capped at 50; a malformed cursor returns 400.
- Collectors: a person whose work is on hold for them or sold to them (`buyer_id` with status `on_hold` or `sold`, set on a work or by an invoice) gets a collector profile automatically; their collection is exactly those works, grouped by artist.
- Invoice status: totals are recomputed on every change. Once an invoice has payments, they set `open` / `partial` / `paid`; without payments the status is whatever was set by hand. When an invoice becomes `paid` its works are recorded as sold to the buyer (sold on the last payment date, sale price = item price less its share of the discount, location `collector` if unset) with a `work_changes` note. `cancelled` (the buyer declined to pay) is only set or cleared by hand and payments don't change it; cancelling releases its works that are on hold for or sold to the buyer (back to `available`, buyer and sale cleared) unless another of their unpaid invoices lists them, so they leave the collection; reopening holds them for the buyer again if still available. Paid invoices can't be cancelled; works can't be added to a cancelled invoice.
- PDFs (`src/lib/pdf.ts`): one pdfmake instance; URL access is off and local file access is limited to pdfkit's standard fonts; the gallery fonts (Germania One, Gentium Book Plus; OFL, in `assets/fonts/`, copied to `dist/fonts/` by `build.mjs`) are read once into pdfmake's in-memory file system.
- Invoice PDFs (`src/invoices/invoicePdf.ts`): Letter, the layout of the gallery's paper invoices: "INVOICE", date ("May 18th, 2026") and "To" block at left, the gallery name in Germania One with address, email and phone at right; items with cover image, artist, italic title, date, medium, dimensions and price; subtotal, discount, sales tax, shipping, payments ("Paid (5/29/2026)") and Total / Balance due; "Thank you!", the payment details (Zelle, wire routing and account, checks payable to; each left off when unset), the terms, and a footer line. Item images are read from the media bucket (`/media/…` URLs only), falling back to `LOCAL_MEDIA_DIR` in development; only JPEG and PNG are embedded.
- CV PDFs (`src/people/cvPdf.ts`): pdfmake with the built-in Helvetica; lead paragraphs become headings, lists, bold/italic and http(s)/mailto links are kept, videos and press lists are dropped.
- Unknown `/api/*` paths return JSON 404s; unhandled errors return JSON 500s.
- Configuration (`src/config.ts`, validated with zod from the environment): `DATABASE_URL` (required), `DATABASE_POOL_MAX` (default 5), `DATABASE_SSL` (`true`/`false`), `SITE_URL`, `PORT`, `NODE_ENV`, `BETTER_AUTH_SECRET` (≥ 32 chars), `AWS_REGION`, `AWS_ENDPOINT_URL` (LocalStack), `MEDIA_BUCKET`, `SITE_BUCKET`, `MEDIA_PUBLIC_PREFIX` (default `/media`), `LOCAL_MEDIA_DIR` (development copy of the site media, for invoice images), and the invoice payment details `INVOICE_ZELLE`, `INVOICE_WIRE_ROUTING`, `INVOICE_WIRE_ACCOUNT`, `INVOICE_CHECKS_PAYABLE_TO` (kept out of the database and the repo; set in `.env.local` locally and from SSM in deployment). `src/services.ts` wires auth, storage and the publisher from this configuration for `lambda.ts` and `local.ts`.

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
- Postgres 17, accessed with Kysely over `pg` (`src/db/index.ts`). `DATE` columns are returned as `YYYY-MM-DD` strings, `TIMESTAMPTZ` as ISO strings and `BIGINT` as numbers. Table types live in `src/db/types.ts`.
- Migrations are listed statically in `src/db/migrate.ts` and run by Kysely's `Migrator` (advisory-locked). Every statement is idempotent (`IF NOT EXISTS`, guarded `DO` blocks), so a migration can be re-run safely. Enumerated values are `text` + `CHECK`.
- Ids are `uuid` (`gen_random_uuid()` default). `updated_at` is maintained by a `set_updated_at` trigger.
- Tables (`0001_initial`, `0002_people_inventory`):

  | Table | Holds |
  |---|---|
  | `user`, `session`, `account`, `verification`, `rateLimit` | Login (Better Auth layout, camelCase columns; `user.role` is `user` or `admin`) |
  | `exhibitions` | Exhibitions and fairs (`kind`). Header: `artists` (one per line), `title`, `subtitle`, `title_first`, run dates `starts_on`/`ends_on` (`date`), `timezone`, `hours_text`, `venue_text` (multi-line), `location_text` (short, for list cards), `press_release_url`, `header_links` (`[{label,url}]`), `show_inquire`. Media: `hero_image`/`hero_alt`, `thumbnail`, `slideshow_visible` (off by default), `works_available`. Body: `content` (rich-text JSON document). SEO overrides, `published` |
  | `exhibition_events` | Dated events shown under an exhibition's dates (label, `starts_at`, `ends_at`, `position`), e.g. the opening |
  | `artworks` | Slideshow slides per exhibition: `image` or `video` (mp4), caption fields, `alt`, `hidden`, `available`, optional `work_id` (inventory link, cleared when the work is deleted); `(exhibition_id, position)` unique, deferrable |
  | `news_posts` | News posts: `slug`, `title`, `published_at`, `body_html`, SEO overrides, `published` |
  | `press_items` | Press coverage: outlet, title, `url` (unique; an http(s) link or an uploaded `/media/…` file), `published_on`, optional `issue_label`/`byline`, optional `exhibition_id` |
  | `home_page` | Single row (`id = 1`): home splash images, text, optional dates, `link_exhibition_id` |
  | `persons` | People (core record): `name`, `sort_name`, `birth_date`, `birth_place`, `email`, `phone`, `website`, `portrait`, private `notes` |
  | `artist_profiles` | Artist profile per person (`person_id` PK; the person can't be deleted while it exists): `slug`, `inventory_prefix` (unique, 1–8 capital letters; set on insert from the person's initials, extended with a later letter of the last name on a clash: TH, THI), `bio`, `cv` (rich-text JSON) |
  | `addresses` | Structured addresses: `line1`, `line2`, `city`, `region`, `postal_code`, `country` (ISO alpha-2), `notes` |
  | `address_links` | Attach an address to any entity (`entity` + `entity_id`, today `person`) with `label`, `is_primary` (one per owner), `position`. Triggers delete an owner's links when the person is deleted and delete addresses no longer linked |
  | `exhibition_artists` | Artist profiles linked to exhibitions (`position`) |
  | `press_artists` | Press linked straight to an artist profile (`press_item_id`, `artist_id`; both cascade). An artist's press is these plus press about their exhibitions; artist profile revisions snapshot `press_ids` |
  | `works` | Inventory per artist profile: caption fields, unique `inventory_number` (artist prefix + four-digit sequence, e.g. MSW0006; a BEFORE INSERT trigger fills a missing one with the code in a `(MSW0004)`-style title suffix when it has the artist's prefix and is free, else the prefix's highest number + 1, gaps not reused; `next_inventory_number(artist)` gives the next one; typed numbers are kept as entered), `price_cents` + `currency`, `status` (`available`, `on_hold`, `sold`, `nfs`, `returned`), `location` + note, consignment dates, sale (`sold_on`, `sale_price_cents`, `buyer_id` → person), private notes |
  | `work_images` | Images per work; `(work_id, position)` unique, deferrable; position 0 is the cover |
  | `work_changes` | Append-only history of price, status, location, consignment and sale changes (old/new JSON values, note, user) |
  | `collector_profiles` | Collector profile per person (`person_id` PK): private `notes` |
  | `invoices` | `number` (unique), `person_id` (bill to; the person can't be deleted while invoices exist), `issued_on`, `status` (`open`, `partial`, `paid`, `cancelled`), `currency`, `bill_to` (printed "To" lines), `discount_bps`, `tax_rate_bps`, `shipping_cents`, stored totals (`subtotal_cents`, `discount_cents`, `tax_cents`, `total_cents`), `terms`, private `notes` |
  | `invoice_items` | Line items: `work_id` (→ works, set null if deleted), `position`, snapshot of artist name, title, date, medium, dimensions, `image_url`, `price_cents` |
  | `invoice_payments` | Payments: `amount_cents`, `paid_on`, `method`, `note`, user |
  | `invoice_settings` | Single row: gallery name, address, email, phone, default terms, default tax rate (bps), invoice number prefix. Payment details are not stored here (env) |
  | `content_revisions` | Snapshots of content changes (entity, entity id, action, `snapshot` JSON, user); also people, artist profiles (with linked exhibition ids) and works (with images) |
  | `seed_state` | Markers for one-time seed runs |

## Prerendering and meta tags
- `apps/web/index.html` holds an `<!--app-head-->` placeholder. `apps/web/vite/metaPlugin.js` fills it: in dev from `/api/meta?path=` for the requested URL; in a build it writes `dist/_template.html` (placeholder kept), `dist/index.html` (site defaults) and `dist/404.html` (not-found title, `noindex`).
- `src/publish/head.ts`: `headFor(db, path, siteUrl)` resolves a path with `matchRoute`, loads published content, and returns `buildMeta` tags + `renderHead` HTML (status 404 for unknown, unpublished or wrong-kind pages). `allPaths`, `sitemapXml` (published pages with `lastmod`) and `robotsTxt` (disallows `/admin` and `/api/`).
- `src/publish/s3Publisher.ts` implements `Publisher` against the site bucket: `render(paths)` reads `_template.html` from the bucket (cached per process), writes `<path>/index.html` (`text/html`, `Cache-Control: public, max-age=60, stale-while-revalidate=300`), deletes pages that now 404, and rewrites `sitemap.xml` and `robots.txt`. `rebuildAll()` renders every path and deletes stale `exhibitions/*`, `fairs/*`, `news/*` pages. Before `_template.html` exists in the bucket it logs a warning and writes nothing.
- On the client, `useMeta` keeps the head in sync during in-app navigation.

## Seed
- `seed(db, { force })` (`src/db/seed.ts`) loads the original site content in one transaction (old `/images/…` and `/docs/…` references are rewritten to `/media/…`): exhibitions and fairs (body HTML converted to rich documents with `htmlToRich`), their events and slideshow slides (from `apps/web/src/json/*-slideshow.json`), press items (linked to exhibitions), news posts (HTML sanitized with `sanitizeNewsHtml`), and the home splash.
- `seedArtists` (`src/db/seedArtists.ts`, `seed_state` key `artists-v1`, run by `seed` even after the initial seed): creates a person and artist profile for each name in exhibitions' artist lines (matched on the profile slug), links them to those exhibitions, and turns slides credited to one of them into works (one per artist + title + date, with the slide image) linked from the slide; slides whose title ends in an inventory code are created first so their works get that number. Installation views stay unlinked. Idempotent.
- `seedArtistBios` (`seed_state` key `artist-bios-v1`, also run by `seed`): fills empty artist-profile bios from exhibition bodies' bio sections (`extractBios`: each artist's paragraphs start with their name in bold; the most recent exhibition wins). Bios with text are never overwritten.
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
  4. starts the API (`tsx watch`, port 3000, with `LOCAL_MEDIA_DIR=.media`) and Vite (port 5173, or the next free port) with prefixed, coloured output; the API is told the site's origin so sign-in works on that port;
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

- One container image (`apps/api/Dockerfile`, built from the repo root; `build.mjs` bundles `lambda`, `migrate` and `rebuild` handlers with esbuild and ships pdfkit's standard-font modules in `dist/standard-fonts` (mapped by `dist/package.json` `imports`); the RDS CA bundle is baked in and `DATABASE_SSL=true`) backs three functions: `api` (function URL, 1024 MB, 29 s, reserved concurrency 10), `migrate` (`osls invoke -f migrate`), and `rebuild` (daily at 06:15 UTC, and after each site deploy).
- Network: a VPC with two private subnets and no NAT gateway; the Lambdas reach S3 through a gateway endpoint and RDS through a security group. Nothing at runtime calls other AWS services.
- Invoice payment details: optional SSM parameters `/twelveten/<stage>/{invoice-zelle, invoice-wire-routing, invoice-wire-account, invoice-checks-payable-to}` become the `INVOICE_*` variables (empty when missing). The Lambda role may read `media/*` in the media bucket for invoice images.
- Secrets: SSM SecureStrings `/twelveten/<stage>/{db-password, better-auth-secret, origin-verify-secret}` (created by `npm run secrets:init -w apps/api -- --stage <stage>`) are resolved at deploy time into Lambda environment variables; RDS reads the password with `{{resolve:ssm-secure:…}}`.
- RDS: `db.t4g.micro`, 20 GB gp3 (autoscaling to 100), encrypted, private, 7-day backups, snapshot on deletion; deletion protection on `prod`.
- Buckets: site (private, CloudFront-only), media (private, versioned, old versions expire after 90 days, CloudFront reads `media/*`, browsers `PUT` presigned uploads; CORS limited to the site origin; retained if the stack is deleted).
- CloudFront: default → site bucket with `cloudfront/viewer-request.js` (legacy redirects, `/path` → `/path/index.html`, `/admin` and `/admin/*` → SPA shell); `/assets/*` and `/media/*` cached; `/api/*` → function URL with an `X-Origin-Verify` header the API requires (`ORIGIN_VERIFY_SECRET`), all query strings and cookies forwarded, cache key includes the session cookie so admin responses are never shared; S3 403/404 → `/404.html` with status 404.
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
- `npm run test:e2e`: builds the site and runs Playwright against `vite preview` (needs the API on port 3000 with seeded data and the local admin). Projects: `desktop` and `mobile` run the visual tests (each page against the committed baseline in `e2e/__screenshots__/`; refresh intentionally with `npx playwright test --update-snapshots`); `admin-setup` signs in once and saves the session to `e2e/.auth/` (git-ignored); `editing` runs the in-place editing flows with that session (edit and save an exhibition, restore from history, date range picker, create/publish/delete a fair and link the home splash to it, news and press create/edit/delete, infinite loading in batches of 10) and the back office (`backoffice.spec.ts`: sign-in redirect, people filters and row navigation, contact details and addresses, a priced work with image, price history and buyer, CV PDF download, linking a slide to an artist from the edit view, holding a work for a collector and invoicing it (totals, discount, PDF, paid in full → sold), the collection grouped by artist, a cancelled invoice leaving the collection; everything it creates is removed).
