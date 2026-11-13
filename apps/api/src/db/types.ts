import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';
import type { RichDoc } from '@twelveten/shared';

/** ISO 'YYYY-MM-DD' (pg DATE is parsed as a string). */
type IsoDate = string;
/** ISO timestamp string (pg TIMESTAMPTZ is parsed to ISO strings). */
type Timestamp = ColumnType<string, string | Date | undefined, string | Date>;
type CreatedAt = ColumnType<string, string | Date | undefined, never>;
type Json<T> = ColumnType<T, string | T, string | T>;

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
    artists_line: Generated<string>;
    title: string;
    starts_on: IsoDate;
    ends_on: IsoDate;
    timezone: Generated<string>;
    hours_text: string | null;
    venue_text: string | null;
    hero_image: string | null;
    hero_alt: string | null;
    thumbnail: string | null;
    press_release_url: string | null;
    works_available: Generated<boolean>;
    content: Json<RichDoc>;
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
    image: string;
    alt: Generated<string>;
    author: string | null;
    title: string | null;
    date_text: string | null;
    dimensions: string | null;
    media: string | null;
    credit: string | null;
    hidden: Generated<boolean>;
    available: Generated<boolean>;
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

export type RevisionEntity = 'exhibition' | 'exhibition_event' | 'artwork' | 'news_post' | 'press_item' | 'home_page';

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
