import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';
import type { HeaderLink, RichDoc } from '@twelveten/shared';

/** ISO 'YYYY-MM-DD' (pg DATE is parsed as a string). */
type IsoDate = string;
/** ISO timestamp string (pg TIMESTAMPTZ is parsed to ISO strings). */
type Timestamp = ColumnType<string, string | Date | undefined, string | Date>;
type CreatedAt = ColumnType<string, string | Date | undefined, never>;
type Json<T> = ColumnType<T, string | T, string | T>;
/** JSON column with a database default (optional on insert). */
type JsonWithDefault<T> = ColumnType<T, string | T | undefined, string | T>;

export interface UserTable {
    id: Generated<string>;
    name: string;
    email: string;
    emailVerified: Generated<boolean>;
    image: string | null;
    role: Generated<'user' | 'admin'>;
    banned: Generated<boolean>;
    banReason: string | null;
    banExpires: string | null;
    createdAt: CreatedAt;
    updatedAt: Timestamp;
}

export interface ExhibitionTable {
    id: Generated<string>;
    slug: string;
    kind: Generated<'exhibition' | 'fair'>;
    artists: Generated<string>;
    title: string;
    subtitle: string | null;
    title_first: Generated<boolean>;
    starts_on: IsoDate;
    ends_on: IsoDate;
    timezone: Generated<string>;
    hours_text: string | null;
    venue_text: string | null;
    location_text: string | null;
    hero_image: string | null;
    hero_alt: string | null;
    thumbnail: string | null;
    press_release_url: string | null;
    header_links: JsonWithDefault<HeaderLink[]>;
    show_inquire: Generated<boolean>;
    slideshow_visible: Generated<boolean>;
    works_available: Generated<boolean>;
    content: JsonWithDefault<RichDoc>;
    seo_title: string | null;
    seo_description: string | null;
    og_image: string | null;
    published: Generated<boolean>;
    created_at: CreatedAt;
    updated_at: Timestamp;
}

export interface ExhibitionEventTable {
    id: Generated<string>;
    exhibition_id: string;
    label: string;
    starts_at: string | Date;
    ends_at: string | Date | null;
    position: Generated<number>;
    created_at: CreatedAt;
    updated_at: Timestamp;
}

export interface ArtworkTable {
    id: Generated<string>;
    exhibition_id: string;
    position: number;
    image: string | null;
    video: string | null;
    alt: Generated<string>;
    author: string | null;
    title: string | null;
    date_text: string | null;
    dimensions: string | null;
    media: string | null;
    credit: string | null;
    hidden: Generated<boolean>;
    available: Generated<boolean>;
    work_id: string | null;
    created_at: CreatedAt;
    updated_at: Timestamp;
}

export interface NewsPostTable {
    id: Generated<string>;
    slug: string;
    title: string;
    published_at: Timestamp;
    body_html: Generated<string>;
    seo_title: string | null;
    seo_description: string | null;
    og_image: string | null;
    published: Generated<boolean>;
    created_at: CreatedAt;
    updated_at: Timestamp;
}

export interface PressItemTable {
    id: Generated<string>;
    outlet: string;
    title: string;
    url: string;
    published_on: IsoDate;
    issue_label: string | null;
    byline: string | null;
    exhibition_id: string | null;
    published: Generated<boolean>;
    created_at: CreatedAt;
    updated_at: Timestamp;
}

export interface HomePageTable {
    id: Generated<number>;
    bg_image: string;
    bg_image_mobile: string | null;
    bg_focal_point: Generated<string>;
    headline: Generated<string>;
    subline: Generated<string>;
    extra_text: string | null;
    starts_on: IsoDate | null;
    ends_on: IsoDate | null;
    text_color: Generated<'black' | 'white'>;
    link_exhibition_id: string | null;
    seo_title: string | null;
    seo_description: string | null;
    og_image: string | null;
    updated_at: Timestamp;
}

export interface PersonTable {
    id: Generated<string>;
    name: string;
    sort_name: string | null;
    birth_date: IsoDate | null;
    birth_place: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    portrait: string | null;
    notes: string | null;
    created_at: CreatedAt;
    updated_at: Timestamp;
}

export interface ArtistProfileTable {
    person_id: string;
    slug: string;
    /** Letters before each work's inventory number (MSW → MSW0006); set by a trigger when omitted. */
    inventory_prefix: Generated<string>;
    bio: JsonWithDefault<RichDoc>;
    cv: JsonWithDefault<RichDoc>;
    created_at: CreatedAt;
    updated_at: Timestamp;
}

export interface AddressTable {
    id: Generated<string>;
    line1: Generated<string>;
    line2: string | null;
    city: string | null;
    region: string | null;
    postal_code: string | null;
    country: Generated<string>;
    notes: string | null;
    created_at: CreatedAt;
    updated_at: Timestamp;
}

export type AddressEntityName = 'person';

export interface AddressLinkTable {
    id: Generated<string>;
    address_id: string;
    entity: AddressEntityName;
    entity_id: string;
    label: string | null;
    is_primary: Generated<boolean>;
    position: Generated<number>;
    created_at: CreatedAt;
    updated_at: Timestamp;
}

export interface ExhibitionArtistTable {
    exhibition_id: string;
    artist_id: string;
    position: Generated<number>;
}

/** Press linked straight to an artist (not only through an exhibition). */
export interface PressArtistTable {
    press_item_id: string;
    artist_id: string;
    created_at: CreatedAt;
}

export type WorkStatusName = 'available' | 'on_hold' | 'sold' | 'nfs' | 'returned';
export type WorkLocationName = 'gallery' | 'storage' | 'artist' | 'collector' | 'on_loan' | 'other';

export interface WorkTable {
    id: Generated<string>;
    artist_id: string;
    inventory_number: string | null;
    title: Generated<string>;
    date_text: string | null;
    medium: string | null;
    dimensions: string | null;
    edition: string | null;
    credit: string | null;
    price_cents: number | null;
    currency: Generated<string>;
    status: Generated<WorkStatusName>;
    location: WorkLocationName | null;
    location_note: string | null;
    consigned_on: IsoDate | null;
    consignment_ends_on: IsoDate | null;
    sold_on: IsoDate | null;
    sale_price_cents: number | null;
    buyer_id: string | null;
    sale_notes: string | null;
    notes: string | null;
    created_at: CreatedAt;
    updated_at: Timestamp;
}

export interface WorkImageTable {
    id: Generated<string>;
    work_id: string;
    url: string;
    alt: Generated<string>;
    position: number;
    created_at: CreatedAt;
    updated_at: Timestamp;
}

export type WorkChangeField = 'price' | 'status' | 'location' | 'consignment' | 'sale';

export interface WorkChangeTable {
    id: Generated<string>;
    work_id: string;
    field: WorkChangeField;
    old_value: Json<unknown> | null;
    new_value: Json<unknown> | null;
    note: string | null;
    user_id: string | null;
    created_at: CreatedAt;
}

export interface CollectorProfileTable {
    person_id: string;
    notes: string | null;
    created_at: CreatedAt;
    updated_at: Timestamp;
}

export interface InvoiceSettingsTable {
    id: Generated<boolean>;
    gallery_name: Generated<string>;
    address: Generated<string>;
    email: Generated<string>;
    phone: Generated<string>;
    default_terms: Generated<string>;
    default_tax_rate_bps: Generated<number>;
    number_prefix: Generated<string>;
    updated_at: Timestamp;
}

export type InvoiceStatusName = 'open' | 'partial' | 'paid' | 'cancelled';

export interface InvoiceTable {
    id: Generated<string>;
    number: string;
    person_id: string;
    issued_on: Generated<IsoDate>;
    status: Generated<InvoiceStatusName>;
    currency: Generated<string>;
    bill_to: Generated<string>;
    discount_bps: Generated<number>;
    tax_rate_bps: Generated<number>;
    shipping_cents: Generated<number>;
    subtotal_cents: Generated<number>;
    discount_cents: Generated<number>;
    tax_cents: Generated<number>;
    total_cents: Generated<number>;
    terms: Generated<string>;
    notes: string | null;
    created_at: CreatedAt;
    updated_at: Timestamp;
}

export interface InvoiceItemTable {
    id: Generated<string>;
    invoice_id: string;
    work_id: string | null;
    position: number;
    artist_name: Generated<string>;
    title: Generated<string>;
    date_text: string | null;
    medium: string | null;
    dimensions: string | null;
    image_url: string | null;
    price_cents: Generated<number>;
    created_at: CreatedAt;
    updated_at: Timestamp;
}

export interface InvoicePaymentTable {
    id: Generated<string>;
    invoice_id: string;
    amount_cents: number;
    paid_on: IsoDate;
    method: string | null;
    note: string | null;
    user_id: string | null;
    created_at: CreatedAt;
}

export type RevisionEntity =
    | 'exhibition'
    | 'exhibition_event'
    | 'artwork'
    | 'news_post'
    | 'press_item'
    | 'home_page'
    | 'person'
    | 'artist_profile'
    | 'work';

export interface ContentRevisionTable {
    id: Generated<string>;
    entity: RevisionEntity;
    entity_id: string | null;
    action: 'create' | 'update' | 'delete' | 'restore';
    snapshot: Json<Record<string, unknown>>;
    user_id: string | null;
    created_at: CreatedAt;
}

export interface SeedStateTable {
    key: string;
    applied_at: CreatedAt;
}

export interface Database {
    user: UserTable;
    exhibitions: ExhibitionTable;
    exhibition_events: ExhibitionEventTable;
    artworks: ArtworkTable;
    news_posts: NewsPostTable;
    press_items: PressItemTable;
    home_page: HomePageTable;
    persons: PersonTable;
    artist_profiles: ArtistProfileTable;
    addresses: AddressTable;
    address_links: AddressLinkTable;
    exhibition_artists: ExhibitionArtistTable;
    press_artists: PressArtistTable;
    works: WorkTable;
    work_images: WorkImageTable;
    work_changes: WorkChangeTable;
    collector_profiles: CollectorProfileTable;
    invoice_settings: InvoiceSettingsTable;
    invoices: InvoiceTable;
    invoice_items: InvoiceItemTable;
    invoice_payments: InvoicePaymentTable;
    content_revisions: ContentRevisionTable;
    seed_state: SeedStateTable;
}

export type ExhibitionRow = Selectable<ExhibitionTable>;
export type NewExhibition = Insertable<ExhibitionTable>;
export type ExhibitionUpdate = Updateable<ExhibitionTable>;
export type ArtworkRow = Selectable<ArtworkTable>;
export type ExhibitionEventRow = Selectable<ExhibitionEventTable>;
export type NewsPostRow = Selectable<NewsPostTable>;
export type PressItemRow = Selectable<PressItemTable>;
export type HomePageRow = Selectable<HomePageTable>;
export type PersonRow = Selectable<PersonTable>;
export type ArtistProfileRow = Selectable<ArtistProfileTable>;
export type AddressRow = Selectable<AddressTable>;
export type AddressLinkRow = Selectable<AddressLinkTable>;
export type WorkRow = Selectable<WorkTable>;
export type WorkImageRow = Selectable<WorkImageTable>;
export type WorkChangeRow = Selectable<WorkChangeTable>;
export type InvoiceRow = Selectable<InvoiceTable>;
export type InvoiceItemRow = Selectable<InvoiceItemTable>;
export type InvoicePaymentRow = Selectable<InvoicePaymentTable>;
export type InvoiceSettingsRow = Selectable<InvoiceSettingsTable>;
