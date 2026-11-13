import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { zonedToIso, GALLERY_TIMEZONE, type RichDoc } from '@twelveten/shared';
import { htmlToRich, normalizeLegacyHtml } from '@twelveten/shared/rich/server';
import type { DB } from './index.ts';
import { exhibitions, type SeedExhibition } from '../../seed-data/exhibitions.ts';
import { pressItems } from '../../seed-data/press.ts';
import { loadNews } from '../../seed-data/news.ts';
import { home } from '../../seed-data/home.ts';
import { sanitizeNewsHtml } from '../lib/sanitize.ts';

const SEED_KEY = 'initial';
const seedDir = new URL('../../seed-data/', import.meta.url);
const webJsonDir = new URL('../../../web/src/json/', import.meta.url);

interface LegacySlide {
    image?: string;
    video?: string;
    author: string | null;
    title: string | null;
    date: string | null;
    dimensions: string | null;
    media: string | null;
    credit: string | null;
    hidden?: boolean;
    available?: boolean;
}

export interface SeedOptions {
    /** Overwrite rows that already exist (local edits are lost). Default: only insert missing rows. */
    force?: boolean;
}

export interface SeedResult {
    skipped: boolean;
    exhibitions: number;
    artworks: number;
    events: number;
    press: number;
    news: number;
}

function readSeedFile(name: string): string | null {
    const file = fileURLToPath(new URL(`exhibitions/${name}`, seedDir));
    return existsSync(file) ? readFileSync(file, 'utf8') : null;
}

/** Body HTML (+ optional video above it and bio below it) → rich document. */
export function exhibitionContent(e: Pick<SeedExhibition, 'slug' | 'video'>): RichDoc {
    const body = readSeedFile(`${e.slug}.html`) ?? '';
    const bio = readSeedFile(`${e.slug}.bio.html`);
    const html = [
        e.video ? `<div data-video="${e.video}"></div>` : '',
        normalizeLegacyHtml(body),
        bio ? `<div data-bio>${bio}</div>` : '',
    ].join('\n');
    return htmlToRich(html);
}

function loadSlides(name: string): LegacySlide[] {
    return JSON.parse(readFileSync(fileURLToPath(new URL(`${name}.json`, webJsonDir)), 'utf8')) as LegacySlide[];
}

function slideAlt(s: LegacySlide): string {
    return [s.author, s.title, s.date].filter(Boolean).join(', ');
}

/**
 * Loads the site's original content. Idempotent: rows are matched on natural keys
 * (exhibition slug, press URL, news slug, home id) and existing rows are left alone
 * unless `force` is set. Runs in one transaction.
 */
export async function seed(db: DB, { force = false }: SeedOptions = {}): Promise<SeedResult> {
    const result: SeedResult = { skipped: false, exhibitions: 0, artworks: 0, events: 0, press: 0, news: 0 };

    if (!force) {
        const done = await db.selectFrom('seed_state').select('key').where('key', '=', SEED_KEY).executeTakeFirst();
        if (done) return { ...result, skipped: true };
    }

    await db.transaction().execute(async (trx) => {
        const idBySlug = new Map<string, string>();

        for (const e of exhibitions) {
            const tz = e.timezone ?? GALLERY_TIMEZONE;
            const row = {
                slug: e.slug,
                kind: e.kind,
                artists: e.artists.join('\n'),
                title: e.title,
                subtitle: e.subtitle ?? null,
                title_first: e.titleFirst ?? false,
                starts_on: e.startsOn,
                ends_on: e.endsOn,
                timezone: tz,
                hours_text: e.hoursText ?? null,
                venue_text: e.venueText ?? null,
                location_text: e.locationText ?? null,
                hero_image: e.heroImage ?? null,
                hero_alt: e.heroAlt ?? null,
                thumbnail: e.thumbnail ?? null,
                press_release_url: e.pressReleaseUrl ?? null,
                header_links: JSON.stringify(e.headerLinks ?? []),
                show_inquire: e.showInquire ?? false,
                slideshow_visible: e.slideshowVisible ?? Boolean(e.slideshow),
                works_available: e.worksAvailable ?? false,
                content: JSON.stringify(exhibitionContent(e)),
                published: true,
            };
            const inserted = await trx
                .insertInto('exhibitions')
                .values(row)
                .onConflict((oc) => (force ? oc.column('slug').doUpdateSet(row) : oc.column('slug').doNothing()))
                .returning('id')
                .executeTakeFirst();
            const id =
                inserted?.id ??
                (await trx.selectFrom('exhibitions').select('id').where('slug', '=', e.slug).executeTakeFirstOrThrow()).id;
            idBySlug.set(e.slug, id);
            if (!inserted) continue; // existing row kept as-is (local edits preserved)
            result.exhibitions++;

            // Child rows are replaced wholesale when the parent is (re)written.
            await trx.deleteFrom('exhibition_events').where('exhibition_id', '=', id).execute();
            for (const [position, ev] of (e.events ?? []).entries()) {
                await trx
                    .insertInto('exhibition_events')
                    .values({
                        exhibition_id: id,
                        label: ev.label,
                        starts_at: zonedToIso(ev.start, tz),
                        ends_at: ev.end ? zonedToIso(ev.end, tz) : null,
                        position,
                    })
                    .execute();
                result.events++;
            }

            await trx.deleteFrom('artworks').where('exhibition_id', '=', id).execute();
            const slides = e.slideshow ? loadSlides(e.slideshow) : [];
            for (const [position, s] of slides.entries()) {
                await trx
                    .insertInto('artworks')
                    .values({
                        exhibition_id: id,
                        position,
                        image: s.image ?? null,
                        video: s.video ?? null,
                        alt: slideAlt(s),
                        author: s.author,
                        title: s.title,
                        date_text: s.date,
                        dimensions: s.dimensions,
                        media: s.media,
                        credit: s.credit,
                        hidden: s.hidden ?? false,
                        available: s.available ?? false,
                    })
                    .execute();
                result.artworks++;
            }
        }

        for (const p of pressItems) {
            const row = {
                outlet: p.outlet,
                title: p.title,
                url: p.url,
                published_on: p.publishedOn,
                issue_label: p.issueLabel,
                byline: p.byline,
                exhibition_id: p.exhibition ? (idBySlug.get(p.exhibition) ?? null) : null,
                published: true,
            };
            const inserted = await trx
                .insertInto('press_items')
                .values(row)
                .onConflict((oc) => (force ? oc.column('url').doUpdateSet(row) : oc.column('url').doNothing()))
                .returning('id')
                .executeTakeFirst();
            if (inserted) result.press++;
        }

        for (const n of loadNews()) {
            const row = {
                slug: n.slug,
                title: n.title,
                published_at: zonedToIso(`${n.publishedOn} 12:00`),
                body_html: sanitizeNewsHtml(n.html),
                published: true,
            };
            const inserted = await trx
                .insertInto('news_posts')
                .values(row)
                .onConflict((oc) => (force ? oc.column('slug').doUpdateSet(row) : oc.column('slug').doNothing()))
                .returning('id')
                .executeTakeFirst();
            if (inserted) result.news++;
        }

        const homeRow = {
            id: 1,
            bg_image: home.bgImage,
            headline: home.headline,
            subline: home.subline,
            text_color: home.textColor,
            link_exhibition_id: idBySlug.get(home.linkSlug) ?? null,
        };
        await trx
            .insertInto('home_page')
            .values(homeRow)
            .onConflict((oc) => (force ? oc.column('id').doUpdateSet(homeRow) : oc.column('id').doNothing()))
            .execute();

        await trx.insertInto('seed_state').values({ key: SEED_KEY }).onConflict((oc) => oc.column('key').doNothing()).execute();
    });

    return result;
}
