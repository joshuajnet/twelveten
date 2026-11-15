import { sql } from 'kysely';
import type { Address, AddressEntity, AddressLink, ArtistProfile, CollectorProfile, NumberedPage, Person, PersonSummary, ProfileFilter, ProfileType } from '@twelveten/shared';
import type { DB } from '../db/index.ts';
import { likePattern, numberedPage } from '../lib/paging.ts';
import type { AddressRow } from '../db/types.ts';
import { collectionOf, worksByArtist, worksByBuyer } from '../inventory/queries.ts';
import { invoicesForPerson } from '../invoices/queries.ts';

type Q = Pick<DB, 'selectFrom'>;

export function toAddress(r: AddressRow): Address {
    return {
        id: r.id,
        line1: r.line1,
        line2: r.line2,
        city: r.city,
        region: r.region,
        postalCode: r.postal_code,
        country: r.country,
        notes: r.notes,
        updatedAt: r.updated_at,
    };
}

export async function addressesFor(db: Q, entity: AddressEntity, entityId: string): Promise<AddressLink[]> {
    const rows = await db
        .selectFrom('address_links as l')
        .innerJoin('addresses as a', 'a.id', 'l.address_id')
        .selectAll('a')
        .select([
            'l.id as link_id',
            'l.label',
            'l.is_primary',
            'l.position',
            (eb) => eb.selectFrom('address_links as o').select((e) => e.fn.countAll<number>().as('n')).whereRef('o.address_id', '=', 'a.id').as('shared'),
        ])
        .where('l.entity', '=', entity)
        .where('l.entity_id', '=', entityId)
        .orderBy('l.is_primary', 'desc')
        .orderBy('l.position')
        .orderBy('l.created_at')
        .execute();
    return rows.map((r) => ({
        linkId: r.link_id,
        label: r.label,
        isPrimary: r.is_primary,
        position: r.position,
        sharedWith: Number(r.shared ?? 1),
        address: toAddress(r),
    }));
}

export async function getArtistProfile(db: Q, personId: string): Promise<ArtistProfile | null> {
    const row = await db
        .selectFrom('artist_profiles')
        .selectAll()
        .select(sql<string>`next_inventory_number(person_id)`.as('next_number'))
        .where('person_id', '=', personId)
        .executeTakeFirst();
    if (!row) return null;
    const [exhibitions, press, works] = await Promise.all([
        db
            .selectFrom('exhibition_artists as ea')
            .innerJoin('exhibitions as e', 'e.id', 'ea.exhibition_id')
            .select(['e.id', 'e.slug', 'e.kind', 'e.title', 'e.artists', 'e.starts_on', 'e.ends_on', 'e.published'])
            .where('ea.artist_id', '=', personId)
            .orderBy('e.starts_on', 'desc')
            .execute(),
        db
            .selectFrom('press_items as pi')
            .leftJoin('exhibitions as e', 'e.id', 'pi.exhibition_id')
            .select(['pi.id', 'pi.outlet', 'pi.title', 'pi.url', 'pi.published_on', 'pi.issue_label', 'pi.byline', 'pi.published', 'pi.updated_at', 'e.id as exhibition_id', 'e.title as exhibition_title'])
            .select((eb) =>
                eb
                    .exists(eb.selectFrom('press_artists as pa').select('pa.artist_id').whereRef('pa.press_item_id', '=', 'pi.id').where('pa.artist_id', '=', personId))
                    .as('direct'),
            )
            .where((eb) =>
                eb.or([
                    eb.exists(eb.selectFrom('press_artists as pa').select('pa.artist_id').whereRef('pa.press_item_id', '=', 'pi.id').where('pa.artist_id', '=', personId)),
                    eb.exists(eb.selectFrom('exhibition_artists as ea').select('ea.artist_id').whereRef('ea.exhibition_id', '=', 'pi.exhibition_id').where('ea.artist_id', '=', personId)),
                ]),
            )
            .orderBy('pi.published_on', 'desc')
            .orderBy('pi.id', 'desc')
            .execute(),
        worksByArtist(db, personId),
    ]);
    return {
        personId: row.person_id,
        slug: row.slug,
        inventoryPrefix: row.inventory_prefix,
        nextInventoryNumber: row.next_number,
        bio: row.bio,
        cv: row.cv,
        exhibitions: exhibitions.map((e) => ({
            id: e.id,
            slug: e.slug,
            kind: e.kind,
            title: e.title,
            artists: e.artists,
            startsOn: e.starts_on,
            endsOn: e.ends_on,
            published: e.published,
        })),
        press: press.map((p) => ({
            id: p.id,
            outlet: p.outlet,
            title: p.title,
            url: p.url,
            publishedOn: p.published_on,
            issueLabel: p.issue_label,
            byline: p.byline,
            published: p.published,
            exhibitionId: p.exhibition_id,
            exhibitionTitle: p.exhibition_title,
            direct: Boolean(p.direct),
            updatedAt: p.updated_at,
        })),
        works,
        updatedAt: row.updated_at,
    };
}

export async function getCollectorProfile(db: Q, personId: string): Promise<CollectorProfile | null> {
    const row = await db.selectFrom('collector_profiles').selectAll().where('person_id', '=', personId).executeTakeFirst();
    if (!row) return null;
    const [collection, invoices] = await Promise.all([collectionOf(db, personId), invoicesForPerson(db, personId)]);
    return { personId: row.person_id, notes: row.notes, collection, invoices, updatedAt: row.updated_at };
}

export async function getPerson(db: Q, id: string): Promise<Person | null> {
    const row = await db.selectFrom('persons').selectAll().where('id', '=', id).executeTakeFirst();
    if (!row) return null;
    const [addresses, artistProfile, collectorProfile] = await Promise.all([addressesFor(db, 'person', id), getArtistProfile(db, id), getCollectorProfile(db, id)]);
    // A collector profile lists their works by artist; purchases only cover people without one.
    const purchases = collectorProfile ? [] : await worksByBuyer(db, id);
    const profiles: ProfileType[] = [...(artistProfile ? (['artist'] as const) : []), ...(collectorProfile ? (['collector'] as const) : [])];
    return {
        id: row.id,
        name: row.name,
        sortName: row.sort_name,
        birthDate: row.birth_date,
        birthPlace: row.birth_place,
        email: row.email,
        phone: row.phone,
        website: row.website,
        portrait: row.portrait,
        notes: row.notes,
        profiles,
        addresses,
        artistProfile,
        collectorProfile,
        purchases,
        updatedAt: row.updated_at,
    };
}

export type PersonSort = 'name' | 'updated';

export interface PersonFilters {
    profile?: ProfileFilter;
    q?: string;
    sort?: PersonSort;
}

/** People list, one numbered page at a time, with the total number of matches. */
export async function listPersons(db: Q, f: PersonFilters, page: number, pageSize: number): Promise<NumberedPage<PersonSummary>> {
    const sort = f.sort ?? 'name';
    // By sort name A–Z, or most recently updated first.
    const desc = sort === 'updated';
    const sortKey = desc ? sql<string>`p.updated_at` : sql<string>`lower(coalesce(p.sort_name, p.name))`;

    let q = db
        .selectFrom('persons as p')
        .leftJoin('artist_profiles as ap', 'ap.person_id', 'p.id')
        .leftJoin('collector_profiles as cp', 'cp.person_id', 'p.id')
        .leftJoinLateral(
            (eb) =>
                eb
                    .selectFrom('address_links as l')
                    .innerJoin('addresses as a', 'a.id', 'l.address_id')
                    .select('a.city')
                    .where('l.entity', '=', 'person')
                    .whereRef('l.entity_id', '=', 'p.id')
                    .orderBy('l.is_primary', 'desc')
                    .orderBy('l.position')
                    .limit(1)
                    .as('addr'),
            (join) => join.onTrue(),
        )
        .select([
            'p.id',
            'p.name',
            'p.sort_name',
            'p.birth_date',
            'p.email',
            'p.phone',
            'p.portrait',
            'addr.city',
            'ap.slug as artist_slug',
            'cp.person_id as collector_id',
            (eb) =>
                eb
                    .selectFrom('works as cw')
                    .select((e) => [e.fn.countAll<number>().as('n')])
                    .whereRef('cw.buyer_id', '=', 'p.id')
                    .where('cw.status', 'in', ['on_hold', 'sold'])
                    .as('collected'),
            (eb) =>
                eb
                    .selectFrom('works as cw')
                    .select(sql<number>`count(DISTINCT cw.artist_id)`.as('n'))
                    .whereRef('cw.buyer_id', '=', 'p.id')
                    .where('cw.status', 'in', ['on_hold', 'sold'])
                    .as('collected_artists'),
            (eb) =>
                eb
                    .selectFrom('invoices as inv')
                    .select((e) => e.fn.countAll<number>().as('n'))
                    .whereRef('inv.person_id', '=', 'p.id')
                    .where('inv.status', 'in', ['open', 'partial'])
                    .as('open_invoices'),
            (eb) => eb.selectFrom('works as w').select((e) => e.fn.countAll<number>().as('n')).whereRef('w.artist_id', '=', 'p.id').as('works'),
            (eb) =>
                eb
                    .selectFrom('works as w')
                    .select((e) => e.fn.countAll<number>().as('n'))
                    .whereRef('w.artist_id', '=', 'p.id')
                    .where('w.status', '=', 'available')
                    .as('available'),
            (eb) =>
                eb
                    .selectFrom('exhibition_artists as ea')
                    .innerJoin('exhibitions as e', 'e.id', 'ea.exhibition_id')
                    .select('e.title')
                    .whereRef('ea.artist_id', '=', 'p.id')
                    .orderBy('e.starts_on', 'desc')
                    .limit(1)
                    .as('last_exhibition'),
        ])
        .orderBy(sortKey, desc ? 'desc' : 'asc')
        .orderBy('p.id', desc ? 'desc' : 'asc');

    if (f.profile === 'artist') q = q.where('ap.person_id', 'is not', null);
    if (f.profile === 'collector') q = q.where('cp.person_id', 'is not', null);
    if (f.profile === 'none') q = q.where('ap.person_id', 'is', null).where('cp.person_id', 'is', null);
    if (f.q) {
        const like = likePattern(f.q);
        q = q.where((eb) =>
            eb.or([
                eb('p.name', 'ilike', like),
                eb('p.sort_name', 'ilike', like),
                eb('p.email', 'ilike', like),
                eb('p.phone', 'ilike', like),
                eb.exists(
                    eb
                        .selectFrom('address_links as l2')
                        .innerJoin('addresses as a2', 'a2.id', 'l2.address_id')
                        .select('l2.id')
                        .where('l2.entity', '=', 'person')
                        .whereRef('l2.entity_id', '=', 'p.id')
                        .where('a2.city', 'ilike', like),
                ),
            ]),
        );
    }

    return numberedPage(q, page, pageSize, (r) => ({
        id: r.id,
        name: r.name,
        sortName: r.sort_name,
        birthDate: r.birth_date,
        email: r.email,
        phone: r.phone,
        portrait: r.portrait,
        city: r.city ?? null,
        profiles: [...(r.artist_slug ? (['artist'] as const) : []), ...(r.collector_id ? (['collector'] as const) : [])],
        artist: r.artist_slug
            ? { slug: r.artist_slug, works: Number(r.works ?? 0), available: Number(r.available ?? 0), lastExhibition: r.last_exhibition ?? null }
            : null,
        collector: r.collector_id
            ? { works: Number(r.collected ?? 0), artists: Number(r.collected_artists ?? 0), openInvoices: Number(r.open_invoices ?? 0) }
            : null,
    }));
}
