/** People (the core record) and the profiles that can be attached to them. Admin-only data. */
import { z } from 'zod';
import { richDocSchema, schemas, type ExhibitionKind, type RichDoc } from './content.ts';
import type { AddressLink } from './addresses.ts';
import { pressCreateSchema } from './admin.ts';
import type { WorkSummary } from './inventory.ts';
import type { InvoiceSummary } from './invoices.ts';
import type { RoomVisitorSummary, WorkInterest } from './rooms.ts';
import type { InquirySummary } from './inquiries.ts';

const { isoDate, isoTimestamp, uuid, slug } = schemas;
const text = z.string().trim();
const optionalText = text.nullable();
const optionalLink = text.refine((v) => v.startsWith('/') || /^https?:\/\//i.test(v), 'Must be a /path or http(s) URL').nullable();

/**
 * Profile types that can be attached to a person. The back office builds its filter and
 * "Add profile" menu from this list; adding a role means one entry here plus its table and panel.
 */
export const PROFILE_TYPES = [
    { key: 'artist', label: 'Artist', plural: 'Artists' },
    { key: 'collector', label: 'Collector', plural: 'Collectors' },
] as const;
export const profileType = z.enum(PROFILE_TYPES.map((p) => p.key) as ['artist', 'collector']);
export type ProfileType = z.infer<typeof profileType>;
/** List filter: a profile type, or people with no profile. */
export const profileFilter = z.union([profileType, z.literal('none')]);
export type ProfileFilter = z.infer<typeof profileFilter>;

/** Default number of people per page in the back office. */
export const PEOPLE_PAGE_SIZE = 25;

/** One numbered page of results (`page` is 1-based) with the total number of matches. */
export interface NumberedPage<T> {
    items: T[];
    page: number;
    pageSize: number;
    total: number;
}

export interface PersonSummary {
    id: string;
    name: string;
    sortName: string | null;
    birthDate: string | null;
    email: string | null;
    phone: string | null;
    portrait: string | null;
    /** City of the primary address, if any. */
    city: string | null;
    profiles: ProfileType[];
    /** Present for artists. */
    artist: { slug: string; works: number; available: number; lastExhibition: string | null } | null;
    /** Present for collectors. */
    collector: { works: number; artists: number; openInvoices: number } | null;
}

export interface ArtistExhibition {
    id: string;
    slug: string;
    kind: ExhibitionKind;
    title: string;
    artists: string;
    startsOn: string;
    endsOn: string;
    published: boolean;
}

/**
 * Press about the artist: linked to them directly (`direct`), or about an exhibition they were in.
 * Directly linked press that isn't on the site's press list (`published` false) is private.
 */
export interface ArtistPress {
    id: string;
    outlet: string;
    title: string;
    url: string;
    publishedOn: string;
    /** Shown instead of the date (journals). */
    issueLabel: string | null;
    byline: string | null;
    published: boolean;
    exhibitionId: string | null;
    exhibitionTitle: string | null;
    direct: boolean;
    updatedAt: string;
}

export interface ArtistProfile {
    personId: string;
    slug: string;
    /** Letters that start this artist's inventory numbers (MSW0006). */
    inventoryPrefix: string;
    /** What the next new work will be numbered. */
    nextInventoryNumber: string;
    bio: RichDoc;
    cv: RichDoc;
    exhibitions: ArtistExhibition[];
    /** Newest first. */
    press: ArtistPress[];
    works: WorkSummary[];
    updatedAt: string;
}

/** One artist in a collector's collection, with the works they hold or bought. */
export interface CollectionArtist {
    artistId: string;
    name: string;
    slug: string;
    works: WorkSummary[];
}

export interface CollectorProfile {
    personId: string;
    notes: string | null;
    /** On-hold and sold works where this person is the buyer, grouped by artist (A–Z). */
    collection: CollectionArtist[];
    invoices: InvoiceSummary[];
    /** Their inquiries, newest first. */
    inquiries: InquirySummary[];
    /** Viewing rooms this person entered, most recent first. */
    viewingRooms: RoomVisitorSummary[];
    /** The works they looked at most across viewing rooms (top 6 by interest). */
    topWorks: WorkInterest[];
    updatedAt: string;
}

export interface Person {
    id: string;
    name: string;
    sortName: string | null;
    birthDate: string | null;
    birthPlace: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    portrait: string | null;
    notes: string | null;
    /** Other emails this person is known by (merged duplicates, viewing room sign-ups). */
    emails: string[];
    profiles: ProfileType[];
    addresses: AddressLink[];
    artistProfile: ArtistProfile | null;
    collectorProfile: CollectorProfile | null;
    /** Works this person bought, when they have no collector profile (which lists them by artist instead). */
    purchases: WorkSummary[];
    updatedAt: string;
}

const personFields = {
    name: text.min(1, 'Name is required'),
    sortName: optionalText,
    birthDate: isoDate.nullable(),
    birthPlace: optionalText,
    email: z.union([z.literal(''), z.email()]).transform((v) => v || null).nullable(),
    phone: optionalText,
    website: optionalLink,
    portrait: optionalLink,
    notes: optionalText,
};
export const personCreateSchema = z
    .object(personFields)
    .partial()
    .required({ name: true })
    .extend({ profiles: z.array(profileType).max(PROFILE_TYPES.length).optional() });
export type PersonCreate = z.input<typeof personCreateSchema>;
export const personPatchSchema = z.object(personFields).partial().extend({ updatedAt: isoTimestamp });
export type PersonPatch = z.input<typeof personPatchSchema>;

/** Create or update the artist profile. `updatedAt` is required when it already exists. */
export const artistProfilePutSchema = z.object({
    slug: slug.optional(),
    inventoryPrefix: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{1,8}$/, 'Inventory prefix must be 1–8 letters')
        .optional(),
    bio: richDocSchema.optional(),
    cv: richDocSchema.optional(),
    updatedAt: isoTimestamp.optional(),
});
export type ArtistProfilePut = z.input<typeof artistProfilePutSchema>;

/** Create or update the collector profile. `updatedAt` is required when it already exists. */
export const collectorProfilePutSchema = z.object({
    notes: optionalText.optional(),
    updatedAt: isoTimestamp.optional(),
});
export type CollectorProfilePut = z.input<typeof collectorProfilePutSchema>;

/**
 * Link press straight to an artist: an existing item (`pressId`) or a new one (`press`; it starts
 * off the site's press list and without an exhibition). A new item whose URL is already in press
 * is linked instead of duplicated.
 */
export const artistPressAddSchema = z
    .object({
        pressId: uuid.optional(),
        press: pressCreateSchema.omit({ exhibitionId: true, published: true }).optional(),
    })
    .refine((v) => Boolean(v.pressId) !== Boolean(v.press), 'Give either pressId or press');
export type ArtistPressAdd = z.input<typeof artistPressAddSchema>;

export const artistExhibitionsPutSchema = z.object({ exhibitionIds: z.array(uuid).max(500) });
export type ArtistExhibitionsPut = z.infer<typeof artistExhibitionsPutSchema>;

/** 'Africh, Noelle' from 'Noelle Africh' (a starting point; admins can override it). */
export function defaultSortName(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2 || /&| and /i.test(name)) return name.trim();
    const last = parts.pop()!;
    return `${last}, ${parts.join(' ')}`;
}

/** Lower-cased, trimmed email (how people are matched). */
export function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

/** Lower-cased, accents stripped, punctuation removed, whitespace collapsed (for duplicate matching). */
export function normalizeName(name: string): string {
    return name
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Replace a person's alias emails. */
export const personEmailsPutSchema = z.object({
    emails: z
        .array(z.email().transform(normalizeEmail))
        .max(50)
        .refine((es) => new Set(es).size === es.length, 'Each email can appear once'),
});
export type PersonEmailsPut = z.input<typeof personEmailsPutSchema>;

/** Fields whose value can be taken from either person when merging. */
export const MERGE_FIELDS = ['name', 'sortName', 'birthDate', 'birthPlace', 'email', 'phone', 'website', 'portrait'] as const;
export type MergeField = (typeof MERGE_FIELDS)[number];

/**
 * Merge this person (the source, deleted afterwards) into `intoId`. `fields` picks, per field, whose
 * value the kept person ends up with (default: the kept person's, or the source's when theirs is empty).
 * Notes are joined.
 */
export const personMergeSchema = z.object({
    intoId: uuid,
    fields: z.partialRecord(z.enum(MERGE_FIELDS), z.enum(['source', 'target'])).default({}),
    updatedAt: isoTimestamp,
    intoUpdatedAt: isoTimestamp,
});
export type PersonMerge = z.input<typeof personMergeSchema>;

export const duplicateDismissSchema = z.object({ aId: uuid, bId: uuid }).refine((v) => v.aId !== v.bId, 'Pick two different people');
