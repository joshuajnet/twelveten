import type { Exhibition, ExhibitionKind, ExhibitionSummary, HomePage, NewsPost, Page, PressItem } from '@twelveten/shared';
import type { DB } from '../db/index.ts';
import { encodeCursor, type Cursor } from './cursor.ts';
import { toExhibition, toHome, toNews, toPress, toSummary } from './serialize.ts';

export interface Visibility {
    /** Include unpublished drafts and hidden slides (admins only). */
    drafts?: boolean;
}

export async function listExhibitions(db: DB, kind: ExhibitionKind | undefined, v: Visibility = {}): Promise<ExhibitionSummary[]> {
    let q = db.selectFrom('exhibitions').selectAll().orderBy('starts_on', 'desc').orderBy('id', 'desc');
    if (kind) q = q.where('kind', '=', kind);
    if (!v.drafts) q = q.where('published', '=', true);
    return (await q.execute()).map(toSummary);
}

export async function getExhibition(db: DB, slug: string, kind: ExhibitionKind | undefined, v: Visibility = {}): Promise<Exhibition | null> {
    let q = db.selectFrom('exhibitions').selectAll().where('slug', '=', slug);
    if (kind) q = q.where('kind', '=', kind);
    if (!v.drafts) q = q.where('published', '=', true);
    const row = await q.executeTakeFirst();
    if (!row) return null;

    let artworks = db.selectFrom('artworks').selectAll().where('exhibition_id', '=', row.id).orderBy('position');
    if (!v.drafts) artworks = artworks.where('hidden', '=', false);
    let press = db
        .selectFrom('press_items')
        .selectAll()
        .where('exhibition_id', '=', row.id)
        .orderBy('published_on', 'desc')
        .orderBy('id', 'desc');
    if (!v.drafts) press = press.where('published', '=', true);

    const [events, art, pressRows] = await Promise.all([
        db.selectFrom('exhibition_events').selectAll().where('exhibition_id', '=', row.id).orderBy('position').execute(),
        artworks.execute(),
        press.execute(),
    ]);
    return toExhibition(row, { events, artworks: art, press: pressRows });
}

export async function listNews(db: DB, cursor: Cursor | null, limit: number, v: Visibility = {}): Promise<Page<NewsPost>> {
    let q = db.selectFrom('news_posts').selectAll().orderBy('published_at', 'desc').orderBy('id', 'desc').limit(limit + 1);
    if (!v.drafts) q = q.where('published', '=', true);
    if (cursor) {
        q = q.where((eb) =>
            eb.or([
                eb('published_at', '<', cursor.sort),
                eb.and([eb('published_at', '=', cursor.sort), eb('id', '<', cursor.id)]),
            ]),
        );
    }
    const rows = await q.execute();
    const items = rows.slice(0, limit).map(toNews);
    const last = items.at(-1);
    return { items, nextCursor: rows.length > limit && last ? encodeCursor({ sort: last.publishedAt, id: last.id }) : null };
}

export async function getNews(db: DB, slug: string, v: Visibility = {}): Promise<NewsPost | null> {
    let q = db.selectFrom('news_posts').selectAll().where('slug', '=', slug);
    if (!v.drafts) q = q.where('published', '=', true);
    const row = await q.executeTakeFirst();
    return row ? toNews(row) : null;
}

export async function listPress(
    db: DB,
    cursor: Cursor | null,
    limit: number,
    filter: { exhibitionSlug?: string } = {},
    v: Visibility = {},
): Promise<Page<PressItem>> {
    let q = db.selectFrom('press_items').selectAll('press_items').orderBy('published_on', 'desc').orderBy('press_items.id', 'desc').limit(limit + 1);
    if (!v.drafts) q = q.where('press_items.published', '=', true);
    if (filter.exhibitionSlug) {
        q = q.innerJoin('exhibitions', 'exhibitions.id', 'press_items.exhibition_id').where('exhibitions.slug', '=', filter.exhibitionSlug);
    }
    if (cursor) {
        q = q.where((eb) =>
            eb.or([
                eb('published_on', '<', cursor.sort),
                eb.and([eb('published_on', '=', cursor.sort), eb('press_items.id', '<', cursor.id)]),
            ]),
        );
    }
    const rows = await q.execute();
    const items = rows.slice(0, limit).map(toPress);
    const last = items.at(-1);
    return { items, nextCursor: rows.length > limit && last ? encodeCursor({ sort: last.publishedOn, id: last.id }) : null };
}

export async function getHome(db: DB, v: Visibility = {}): Promise<HomePage | null> {
    const row = await db.selectFrom('home_page').selectAll().where('id', '=', 1).executeTakeFirst();
    if (!row) return null;
    let link;
    if (row.link_exhibition_id) {
        let q = db.selectFrom('exhibitions').selectAll().where('id', '=', row.link_exhibition_id);
        if (!v.drafts) q = q.where('published', '=', true);
        link = await q.executeTakeFirst();
    }
    return toHome(row, link);
}
