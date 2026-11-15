/** Works inventory: admin-only, never part of public payloads. */
import { z } from 'zod';
import { schemas } from './content.ts';
import type { InvoiceSummary } from './invoices.ts';

const { isoDate, isoTimestamp, uuid } = schemas;
const text = z.string().trim();
const optionalText = text.nullable();
const link = text.refine((v) => v.startsWith('/') || /^https?:\/\//i.test(v), 'Must be a /path or http(s) URL');

/** Default number of works per inventory page. */
export const WORKS_PAGE_SIZE = 25;

export const WORK_STATUSES = {
    available: 'Available',
    on_hold: 'On hold',
    sold: 'Sold',
    nfs: 'Not for sale',
    returned: 'Returned to artist',
} as const;
export const workStatus = z.enum(Object.keys(WORK_STATUSES) as [keyof typeof WORK_STATUSES, ...(keyof typeof WORK_STATUSES)[]]);
export type WorkStatus = z.infer<typeof workStatus>;

export const WORK_LOCATIONS = {
    gallery: 'Gallery',
    storage: 'Storage',
    artist: 'With artist',
    collector: 'With collector',
    on_loan: 'On loan',
    other: 'Other',
} as const;
export const workLocation = z.enum(Object.keys(WORK_LOCATIONS) as [keyof typeof WORK_LOCATIONS, ...(keyof typeof WORK_LOCATIONS)[]]);
export type WorkLocation = z.infer<typeof workLocation>;

export const WORK_CHANGE_FIELDS = {
    price: 'Price',
    status: 'Status',
    location: 'Location',
    consignment: 'Consignment',
    sale: 'Sale',
} as const;
export type WorkChangeField = keyof typeof WORK_CHANGE_FIELDS;

export interface WorkImage {
    id: string;
    url: string;
    alt: string;
    position: number;
}

/** Card / list row. */
export interface WorkSummary {
    id: string;
    artistId: string;
    artistName: string;
    inventoryNumber: string | null;
    title: string;
    dateText: string | null;
    medium: string | null;
    dimensions: string | null;
    priceCents: number | null;
    currency: string;
    status: WorkStatus;
    location: WorkLocation | null;
    /** Who it is on hold for or sold to. */
    buyerId: string | null;
    image: WorkImage | null;
    updatedAt: string;
}

export interface WorkSlide {
    artworkId: string;
    exhibitionId: string;
    exhibitionSlug: string;
    exhibitionKind: 'exhibition' | 'fair';
    exhibitionTitle: string;
    image: string | null;
}

export interface Work extends WorkSummary {
    edition: string | null;
    credit: string | null;
    locationNote: string | null;
    consignedOn: string | null;
    consignmentEndsOn: string | null;
    soldOn: string | null;
    salePriceCents: number | null;
    buyer: { id: string; name: string } | null;
    saleNotes: string | null;
    notes: string | null;
    images: WorkImage[];
    slides: WorkSlide[];
    /** Invoices that list this work. */
    invoices: InvoiceSummary[];
}

export interface WorkChange {
    id: string;
    field: WorkChangeField;
    oldValue: unknown;
    newValue: unknown;
    note: string | null;
    userName: string | null;
    createdAt: string;
}

const cents = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const currency = text.transform((v) => v.toUpperCase()).pipe(z.string().regex(/^[A-Z]{3}$/, 'Three-letter currency code'));

const workFields = {
    inventoryNumber: optionalText.transform((v) => v || null),
    title: text,
    dateText: optionalText,
    medium: optionalText,
    dimensions: optionalText,
    edition: optionalText,
    credit: optionalText,
    priceCents: cents.nullable(),
    currency,
    status: workStatus,
    location: workLocation.nullable(),
    locationNote: optionalText,
    consignedOn: isoDate.nullable(),
    consignmentEndsOn: isoDate.nullable(),
    soldOn: isoDate.nullable(),
    salePriceCents: cents.nullable(),
    buyerId: uuid.nullable(),
    saleNotes: optionalText,
    notes: optionalText,
};
const consignmentOrder = (w: { consignedOn?: string | null; consignmentEndsOn?: string | null }) =>
    !w.consignedOn || !w.consignmentEndsOn || w.consignmentEndsOn >= w.consignedOn;

export const workCreateSchema = z
    .object(workFields)
    .partial()
    .extend({
        artistId: uuid,
        images: z.array(z.object({ url: link, alt: text.default('') })).max(50).optional(),
    })
    .refine(consignmentOrder, { message: 'Consignment must end after it starts', path: ['consignmentEndsOn'] });
export type WorkCreate = z.input<typeof workCreateSchema>;

export const workPatchSchema = z
    .object(workFields)
    .partial()
    .extend({ updatedAt: isoTimestamp, changeNote: optionalText.optional() })
    .refine(consignmentOrder, { message: 'Consignment must end after it starts', path: ['consignmentEndsOn'] });
export type WorkPatch = z.input<typeof workPatchSchema>;

export const workImageCreateSchema = z.object({ url: link, alt: text.default('') });
export const workImagePatchSchema = z.object({ alt: text });
export const workImagesOrderSchema = z.object({ ids: z.array(uuid).min(1) });

/** Link a slideshow slide to an artist (a person) and a work. */
export const artworkLinkSchema = z.object({
    personId: uuid,
    /** Use this existing work of the artist; omitted = create a work from the slide. */
    workId: uuid.optional(),
});
export type ArtworkLinkInput = z.infer<typeof artworkLinkSchema>;

/** '$12,500' / '€900.50'. */
export function formatPrice(cents: number | null | undefined, currencyCode = 'USD'): string {
    if (cents === null || cents === undefined) return '';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);
}

/** '12,500.00' or '$12,500' → 1250000 cents; '' → null; NaN for anything unparseable. */
export function parsePrice(input: string): number | null {
    const cleaned = input.replace(/[^0-9.]/g, '');
    if (!cleaned) return null;
    if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return Number.NaN;
    return Math.round(Number(cleaned) * 100);
}
