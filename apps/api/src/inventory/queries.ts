import { sql } from 'kysely';
import type { ArtworkLink, CollectionArtist, NumberedPage, Work, WorkChange, WorkImage, WorkStatus, WorkSummary } from '@twelveten/shared';
import type { DB } from '../db/index.ts';
import { invoicesForWork } from '../invoices/queries.ts';
import type { WorkImageRow, WorkLocationName, WorkStatusName } from '../db/types.ts';

type Q = Pick<DB, 'selectFrom'>;

const toImage = (r: Pick<WorkImageRow, 'id' | 'url' | 'alt' | 'position'>): WorkImage => ({ id: r.id, url: r.url, alt: r.alt, position: r.position });

/** Works joined with their artist's name and first image. */
function summaryQuery(db: Q) {
    return db
        .selectFrom('works as w')
        .innerJoin('persons as p', 'p.id', 'w.artist_id')
        .leftJoinLateral(
            (eb) => eb.selectFrom('work_images as i').select(['i.id', 'i.url', 'i.alt', 'i.position']).whereRef('i.work_id', '=', 'w.id').orderBy('i.position').limit(1).as('img'),
            (join) => join.onTrue(),
        )
        .select([
            'w.id',
            'w.artist_id',
            'p.name as artist_name',
            'w.inventory_number',
            'w.title',
            'w.date_text',
            'w.medium',
            'w.dimensions',
            'w.price_cents',
            'w.currency',
            'w.status',
            'w.location',
            'w.buyer_id',
            'w.created_at',
            'w.updated_at',
            'img.id as image_id',
            'img.url as image_url',
            'img.alt as image_alt',
            'img.position as image_position',
        ]);
}

interface SummaryRow {
    id: string;
    artist_id: string;
    artist_name: string;
    inventory_number: string | null;
    title: string;
    date_text: string | null;
    medium: string | null;
    dimensions: string | null;
    price_cents: number | null;
    currency: string;
    status: WorkStatusName;
    location: WorkLocationName | null;
    buyer_id: string | null;
    updated_at: string;
    image_id: string | null;
    image_url: string | null;
    image_alt: string | null;
    image_position: number | null;
}

function toSummary(r: SummaryRow): WorkSummary {
    return {
        id: r.id,
        artistId: r.artist_id,
        artistName: r.artist_name,
        inventoryNumber: r.inventory_number,
        title: r.title,
        dateText: r.date_text,
        medium: r.medium,
        dimensions: r.dimensions,
        priceCents: r.price_cents,
        currency: r.currency,
        status: r.status,
        location: r.location,
        buyerId: r.buyer_id,
        image: r.image_id ? { id: r.image_id, url: r.image_url!, alt: r.image_alt ?? '', position: r.image_position ?? 0 } : null,
        updatedAt: r.updated_at,
    };
}

export async function worksByArtist(db: Q, artistId: string): Promise<WorkSummary[]> {
    const rows = await summaryQuery(db).where('w.artist_id', '=', artistId).orderBy('w.created_at', 'desc').orderBy('w.id', 'desc').execute();
    return rows.map(toSummary);
}

export async function worksByBuyer(db: Q, personId: string): Promise<WorkSummary[]> {
    const rows = await summaryQuery(db).where('w.buyer_id', '=', personId).orderBy('w.sold_on', 'desc').orderBy('w.id', 'desc').execute();
    return rows.map(toSummary);
}

/** A collector's on-hold and sold works, grouped by artist (A–Z by sort name), newest first within each. */
export async function collectionOf(db: Q, personId: string): Promise<CollectionArtist[]> {
    const rows = await summaryQuery(db)
        .innerJoin('artist_profiles as ap', 'ap.person_id', 'w.artist_id')
        .select(['ap.slug as artist_slug', sql<string>`lower(coalesce(p.sort_name, p.name))`.as('artist_sort')])
        .where('w.buyer_id', '=', personId)
        .where('w.status', 'in', ['on_hold', 'sold'])
        .orderBy('artist_sort')
        .orderBy('w.artist_id')
        .orderBy(sql`w.sold_on DESC NULLS FIRST`)
        .orderBy('w.created_at', 'desc')
        .execute();
    const groups = new Map<string, CollectionArtist>();
    for (const r of rows) {
        let g = groups.get(r.artist_id);
        if (!g) groups.set(r.artist_id, (g = { artistId: r.artist_id, name: r.artist_name, slug: r.artist_slug, works: [] }));
        g.works.push(toSummary(r));
    }
    return [...groups.values()];
}

export interface WorkFilters {
    artistId?: string;
    status?: WorkStatus;
    location?: string;
    q?: string;
}

/** Inventory list, newest first, one numbered page at a time with the total number of matches. */
export async function listWorks(db: Q, f: WorkFilters, page: number, pageSize: number): Promise<NumberedPage<WorkSummary>> {
    let q = summaryQuery(db)
        .select(sql<number>`count(*) over ()`.as('total'))
        .orderBy('w.created_at', 'desc')
        .orderBy('w.id', 'desc')
        .limit(pageSize)
        .offset((page - 1) * pageSize);
    if (f.artistId) q = q.where('w.artist_id', '=', f.artistId);
    if (f.status) q = q.where('w.status', '=', f.status);
    if (f.location) q = q.where('w.location', '=', f.location as WorkLocationName);
    if (f.q) {
        const like = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
        q = q.where((eb) => eb.or([eb('w.title', 'ilike', like), eb('w.inventory_number', 'ilike', like), eb('p.name', 'ilike', like), eb('w.medium', 'ilike', like)]));
    }
    const rows = await q.execute();
    // Past the last page: count the matches so the client can go back.
    let total = Number(rows[0]?.total ?? 0);
    if (!rows.length && page > 1) total = Number((await q.offset(0).limit(1).execute())[0]?.total ?? 0);
    return { items: rows.map(toSummary), page, pageSize, total };
}

export async function getWork(db: Q, id: string): Promise<Work | null> {
    const summary = await summaryQuery(db).where('w.id', '=', id).executeTakeFirst();
    if (!summary) return null;
    const [row, images, slides, invoices] = await Promise.all([
        db
            .selectFrom('works as w')
            .leftJoin('persons as b', 'b.id', 'w.buyer_id')
            .select([
                'w.edition',
                'w.credit',
                'w.location_note',
                'w.consigned_on',
                'w.consignment_ends_on',
                'w.sold_on',
                'w.sale_price_cents',
                'w.buyer_id',
                'b.name as buyer_name',
                'w.sale_notes',
                'w.notes',
            ])
            .where('w.id', '=', id)
            .executeTakeFirstOrThrow(),
        db.selectFrom('work_images').select(['id', 'url', 'alt', 'position']).where('work_id', '=', id).orderBy('position').execute(),
        db
            .selectFrom('artworks as a')
            .innerJoin('exhibitions as e', 'e.id', 'a.exhibition_id')
            .select(['a.id', 'a.image', 'e.id as exhibition_id', 'e.slug', 'e.kind', 'e.title'])
            .where('a.work_id', '=', id)
            .orderBy('e.starts_on', 'desc')
            .execute(),
        invoicesForWork(db, id),
    ]);
    return {
        ...toSummary(summary),
        edition: row.edition,
        credit: row.credit,
        locationNote: row.location_note,
        consignedOn: row.consigned_on,
        consignmentEndsOn: row.consignment_ends_on,
        soldOn: row.sold_on,
        salePriceCents: row.sale_price_cents,
        buyer: row.buyer_id ? { id: row.buyer_id, name: row.buyer_name ?? '' } : null,
        saleNotes: row.sale_notes,
        notes: row.notes,
        images: images.map(toImage),
        slides: slides.map((s) => ({
            artworkId: s.id,
            exhibitionId: s.exhibition_id,
            exhibitionSlug: s.slug,
            exhibitionKind: s.kind,
            exhibitionTitle: s.title,
            image: s.image,
        })),
        invoices,
    };
}

export async function workHistory(db: Q, workId: string): Promise<WorkChange[]> {
    const rows = await db
        .selectFrom('work_changes as c')
        .leftJoin('user as u', 'u.id', 'c.user_id')
        .select(['c.id', 'c.field', 'c.old_value', 'c.new_value', 'c.note', 'c.created_at', 'u.name as user_name'])
        .where('c.work_id', '=', workId)
        .orderBy('c.created_at', 'desc')
        .orderBy('c.id', 'desc')
        .execute();
    return rows.map((r) => ({
        id: r.id,
        field: r.field,
        oldValue: r.old_value,
        newValue: r.new_value,
        note: r.note,
        userName: r.user_name,
        createdAt: r.created_at,
    }));
}

/** Work/artist links for the given slides (admin exhibition reads). */
export async function artworkLinks(db: Q, artworkIds: string[]): Promise<Map<string, ArtworkLink>> {
    if (!artworkIds.length) return new Map();
    const rows = await db
        .selectFrom('artworks as a')
        .innerJoin('works as w', 'w.id', 'a.work_id')
        .innerJoin('persons as p', 'p.id', 'w.artist_id')
        .select(['a.id', 'w.id as work_id', 'w.title', 'w.inventory_number', 'p.id as person_id', 'p.name'])
        .where('a.id', 'in', artworkIds)
        .execute();
    return new Map(
        rows.map((r) => [r.id, { workId: r.work_id, workTitle: r.title, inventoryNumber: r.inventory_number, personId: r.person_id, artistName: r.name }]),
    );
}

/** The price/status/location/consignment/sale values of a work, as recorded in work_changes. */
export function trackedValues(w: {
    price_cents: number | null;
    currency: string;
    status: string;
    location: string | null;
    location_note: string | null;
    consigned_on: string | null;
    consignment_ends_on: string | null;
    sold_on: string | null;
    sale_price_cents: number | null;
    buyer_id: string | null;
}) {
    return {
        price: w.price_cents === null ? null : { cents: Number(w.price_cents), currency: w.currency },
        status: w.status,
        location: w.location === null && !w.location_note ? null : { location: w.location, note: w.location_note },
        consignment: !w.consigned_on && !w.consignment_ends_on ? null : { from: w.consigned_on, to: w.consignment_ends_on },
        sale:
            !w.sold_on && w.sale_price_cents === null && !w.buyer_id
                ? null
                : { soldOn: w.sold_on, cents: w.sale_price_cents === null ? null : Number(w.sale_price_cents), currency: w.currency, buyerId: w.buyer_id },
    };
}
