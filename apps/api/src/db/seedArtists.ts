import { v7 as uuidv7 } from 'uuid';
import { defaultSortName, slugify, type RichDoc, type RichNode } from '@twelveten/shared';
import type { DB } from './index.ts';

export const ARTISTS_SEED_KEY = 'artists-v1';

/** A slide that photographs the exhibition rather than showing one work. */
export function isInstallationView(
    slide: { title: string | null; date_text: string | null; media: string | null; dimensions: string | null; alt: string },
    exhibitionTitle?: string,
): boolean {
    const fields = [slide.title, slide.media, slide.dimensions, slide.alt];
    if (fields.some((f) => f && /installation (view|shot)/i.test(f))) return true;
    // Captioned with just the show's title (no date or materials).
    const title = slide.title?.trim().toLowerCase();
    return Boolean(title && exhibitionTitle && title === exhibitionTitle && !slide.date_text && !slide.media);
}

export interface ArtistSeedResult {
    skipped: boolean;
    artists: number;
    links: number;
    works: number;
}

/**
 * Creates people + artist profiles from every exhibition's artist lines, links them to those
 * exhibitions, and turns slides credited to one of them into inventory works linked to the slide.
 * Idempotent: artists are matched on their profile slug, works on (artist, title, date), and
 * slides that already point at a work are left alone.
 */
export async function seedArtists(db: DB, { force = false } = {}): Promise<ArtistSeedResult> {
    const result: ArtistSeedResult = { skipped: false, artists: 0, links: 0, works: 0 };
    if (!force) {
        const done = await db.selectFrom('seed_state').select('key').where('key', '=', ARTISTS_SEED_KEY).executeTakeFirst();
        if (done) return { ...result, skipped: true };
    }

    await db.transaction().execute(async (trx) => {
        const exhibitions = await trx.selectFrom('exhibitions').select(['id', 'artists']).orderBy('starts_on').execute();
        const bySlug = new Map<string, { id: string; name: string }>();
        for (const p of await trx.selectFrom('artist_profiles as a').innerJoin('persons as p', 'p.id', 'a.person_id').select(['a.slug', 'p.id', 'p.name']).execute()) {
            bySlug.set(p.slug, { id: p.id, name: p.name });
        }

        const artistFor = async (name: string) => {
            const slug = slugify(name);
            const found = bySlug.get(slug);
            if (found) return found;
            const person = await trx.insertInto('persons').values({ id: uuidv7(), name, sort_name: defaultSortName(name) }).returning(['id', 'name']).executeTakeFirstOrThrow();
            await trx.insertInto('artist_profiles').values({ person_id: person.id, slug }).execute();
            bySlug.set(slug, person);
            result.artists++;
            return person;
        };

        for (const e of exhibitions) {
            const names = e.artists
                .split('\n')
                .map((n) => n.trim())
                .filter(Boolean);
            for (const [position, name] of names.entries()) {
                const artist = await artistFor(name);
                const inserted = await trx
                    .insertInto('exhibition_artists')
                    .values({ exhibition_id: e.id, artist_id: artist.id, position })
                    .onConflict((oc) => oc.columns(['exhibition_id', 'artist_id']).doNothing())
                    .returning('artist_id')
                    .executeTakeFirst();
                if (inserted) result.links++;
            }
        }

        // Slides credited to a known artist become works (one per artist + title + date).
        // Installation views are photos of the show, not inventory, so they stay unlinked.
        const showTitles = new Map((await trx.selectFrom('exhibitions').select(['id', 'title']).execute()).map((e) => [e.id, e.title.trim().toLowerCase()]));
        const slides = await trx
            .selectFrom('artworks')
            .selectAll()
            .where('work_id', 'is', null)
            .where('author', 'is not', null)
            .orderBy('exhibition_id')
            .orderBy('position')
            .execute();
        // Titles ending in an inventory code ("Sister (MSW0004)") go first, so the insert trigger
        // can give each work that code before sequential numbering reaches it.
        const coded = (s: (typeof slides)[number]) => /\([A-Z]+\d+\)\s*$/.test(s.title ?? '');
        slides.sort((a, b) => Number(coded(b)) - Number(coded(a)));
        for (const slide of slides) {
            if (isInstallationView(slide, showTitles.get(slide.exhibition_id))) continue;
            const artist = bySlug.get(slugify(slide.author!.trim()));
            if (!artist || artist.name !== slide.author!.trim()) continue;
            const title = slide.title?.trim() ?? '';
            let work = await trx
                .selectFrom('works')
                .select('id')
                .where('artist_id', '=', artist.id)
                .where('title', '=', title)
                .where((eb) => (slide.date_text ? eb('date_text', '=', slide.date_text) : eb('date_text', 'is', null)))
                .executeTakeFirst();
            if (!work) {
                work = await trx
                    .insertInto('works')
                    .values({
                        artist_id: artist.id,
                        title,
                        date_text: slide.date_text,
                        medium: slide.media,
                        dimensions: slide.dimensions,
                        credit: slide.credit,
                        status: slide.available ? 'available' : 'nfs',
                    })
                    .returning('id')
                    .executeTakeFirstOrThrow();
                result.works++;
            }
            if (slide.image) {
                const has = await trx.selectFrom('work_images').select('id').where('work_id', '=', work.id).where('url', '=', slide.image).executeTakeFirst();
                if (!has) {
                    const max = await trx.selectFrom('work_images').select((eb) => eb.fn.max('position').as('max')).where('work_id', '=', work.id).executeTakeFirst();
                    await trx.insertInto('work_images').values({ work_id: work.id, url: slide.image, alt: slide.alt, position: Number(max?.max ?? -1) + 1 }).execute();
                }
            }
            await trx.updateTable('artworks').set({ work_id: work.id }).where('id', '=', slide.id).execute();
        }

        await trx.insertInto('seed_state').values({ key: ARTISTS_SEED_KEY }).onConflict((oc) => oc.column('key').doNothing()).execute();
    });
    return result;
}

export const ARTIST_BIOS_SEED_KEY = 'artist-bios-v1';

const isEmptyDoc = (doc: RichDoc) => !JSON.stringify(doc.content ?? []).includes('"text"');

/**
 * Artist bios inside an exhibition body's bio section, by lower-cased artist name. Each artist's
 * bio starts with a paragraph that opens with their name in bold; following paragraphs without a
 * bold name belong to the same artist. Paragraphs become plain (not italic) for the profile.
 */
export function extractBios(content: RichDoc): Map<string, RichNode[]> {
    const out = new Map<string, RichNode[]>();
    for (const section of content.content ?? []) {
        if (section.type !== 'bio') continue;
        let current: RichNode[] | null = null;
        for (const node of section.content ?? []) {
            if (node.type !== 'paragraph') continue;
            const first = node.content?.find((n) => n.type === 'text' && n.text?.trim());
            const isBold = first?.marks?.some((m) => m.type === 'bold');
            const plain: RichNode = { type: 'paragraph', ...(node.content ? { content: node.content } : {}) };
            if (isBold && first?.text) {
                const name = first.text.trim().toLowerCase();
                current = out.get(name) ?? [];
                if (!out.has(name)) out.set(name, current);
                else current.length = 0; // a later paragraph for the same name replaces the earlier one
                current.push(plain);
            } else if (current && node.content?.length) {
                current.push(plain);
            }
        }
    }
    return out;
}

/**
 * Fills empty artist-profile bios from exhibition pages (the most recent exhibition's bio wins).
 * Never overwrites a bio that has text. Runs once (`artist-bios-v1`) unless forced.
 */
export async function seedArtistBios(db: DB, { force = false } = {}): Promise<{ skipped: boolean; bios: number }> {
    if (!force) {
        const done = await db.selectFrom('seed_state').select('key').where('key', '=', ARTIST_BIOS_SEED_KEY).executeTakeFirst();
        if (done) return { skipped: true, bios: 0 };
    }
    let bios = 0;
    await db.transaction().execute(async (trx) => {
        const profiles = await trx.selectFrom('artist_profiles as a').innerJoin('persons as p', 'p.id', 'a.person_id').select(['a.person_id', 'a.bio', 'p.name']).execute();
        const exhibitions = await trx.selectFrom('exhibitions').select(['content']).orderBy('starts_on', 'desc').execute();
        const found = new Map<string, RichNode[]>();
        for (const e of exhibitions) {
            for (const [name, paragraphs] of extractBios(e.content)) if (!found.has(name)) found.set(name, paragraphs);
        }
        for (const p of profiles) {
            if (!isEmptyDoc(p.bio)) continue;
            const paragraphs = found.get(p.name.trim().toLowerCase());
            if (!paragraphs?.length) continue;
            await trx.updateTable('artist_profiles').set({ bio: JSON.stringify({ type: 'doc', content: paragraphs }) }).where('person_id', '=', p.person_id).execute();
            bios++;
        }
        await trx.insertInto('seed_state').values({ key: ARTIST_BIOS_SEED_KEY }).onConflict((oc) => oc.column('key').doNothing()).execute();
    });
    return { skipped: false, bios };
}
