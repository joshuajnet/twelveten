import { z } from 'zod';

/** Tiptap / ProseMirror JSON node. Validated structurally; allowed node types are enforced by the editor + server sanitizer. */
export interface RichNode {
    type: string;
    attrs?: Record<string, unknown>;
    content?: RichNode[];
    text?: string;
    marks?: { type: string; attrs?: Record<string, unknown> }[];
}
export const richNodeSchema: z.ZodType<RichNode> = z.lazy(() =>
    z.object({
        type: z.string().min(1),
        attrs: z.record(z.string(), z.unknown()).optional(),
        content: z.array(richNodeSchema).optional(),
        text: z.string().optional(),
        marks: z.array(z.object({ type: z.string(), attrs: z.record(z.string(), z.unknown()).optional() })).optional(),
    }),
);
export const richDocSchema = z.object({ type: z.literal('doc'), content: z.array(richNodeSchema).default([]) });
export type RichDoc = z.infer<typeof richDocSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const isoTimestamp = z.iso.datetime({ offset: true });
const uuid = z.uuid();
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and dashes');

export const exhibitionKind = z.enum(['exhibition', 'fair']);
export type ExhibitionKind = z.infer<typeof exhibitionKind>;

export const exhibitionEventSchema = z.object({
    id: uuid,
    label: z.string().min(1),
    startsAt: isoTimestamp,
    endsAt: isoTimestamp.nullable(),
    position: z.number().int(),
});
export type ExhibitionEvent = z.infer<typeof exhibitionEventSchema>;

export const artworkSchema = z.object({
    id: uuid,
    exhibitionId: uuid,
    position: z.number().int(),
    image: z.string().min(1).nullable(),
    video: z.string().min(1).nullable(),
    alt: z.string(),
    author: z.string().nullable(),
    title: z.string().nullable(),
    dateText: z.string().nullable(),
    dimensions: z.string().nullable(),
    media: z.string().nullable(),
    credit: z.string().nullable(),
    hidden: z.boolean(),
    available: z.boolean(),
    updatedAt: isoTimestamp,
});
export type Artwork = z.infer<typeof artworkSchema>;

export const pressItemSchema = z.object({
    id: uuid,
    outlet: z.string().min(1),
    title: z.string().min(1),
    url: z.url(),
    publishedOn: isoDate,
    issueLabel: z.string().nullable(),
    byline: z.string().nullable(),
    exhibitionId: uuid.nullable(),
    published: z.boolean(),
    updatedAt: isoTimestamp,
});
export type PressItem = z.infer<typeof pressItemSchema>;

const seoFields = {
    seoTitle: z.string().nullable(),
    seoDescription: z.string().nullable(),
    ogImage: z.string().nullable(),
};

export const headerLinkSchema = z.object({ label: z.string().min(1), url: z.string().min(1) });
export type HeaderLink = z.infer<typeof headerLinkSchema>;

export const exhibitionSummarySchema = z.object({
    id: uuid,
    slug,
    kind: exhibitionKind,
    /** One artist per line. */
    artists: z.string(),
    title: z.string().min(1),
    subtitle: z.string().nullable(),
    titleFirst: z.boolean(),
    locationText: z.string().nullable(),
    startsOn: isoDate,
    endsOn: isoDate,
    timezone: z.string(),
    thumbnail: z.string().nullable(),
    heroImage: z.string().nullable(),
    heroAlt: z.string().nullable(),
    published: z.boolean(),
});
export type ExhibitionSummary = z.infer<typeof exhibitionSummarySchema>;

export const exhibitionSchema = exhibitionSummarySchema.extend({
    hoursText: z.string().nullable(),
    venueText: z.string().nullable(),
    pressReleaseUrl: z.string().nullable(),
    headerLinks: z.array(headerLinkSchema),
    showInquire: z.boolean(),
    slideshowVisible: z.boolean(),
    worksAvailable: z.boolean(),
    content: richDocSchema,
    ...seoFields,
    updatedAt: isoTimestamp,
    events: z.array(exhibitionEventSchema),
    artworks: z.array(artworkSchema),
    press: z.array(pressItemSchema),
});
export type Exhibition = z.infer<typeof exhibitionSchema>;

export const newsPostSchema = z.object({
    id: uuid,
    slug,
    title: z.string().min(1),
    publishedAt: isoTimestamp,
    bodyHtml: z.string(),
    ...seoFields,
    published: z.boolean(),
    updatedAt: isoTimestamp,
});
export type NewsPost = z.infer<typeof newsPostSchema>;

export const homePageSchema = z.object({
    bgImage: z.string().min(1),
    bgImageMobile: z.string().nullable(),
    bgFocalPoint: z.string(),
    headline: z.string(),
    subline: z.string(),
    extraText: z.string().nullable(),
    startsOn: isoDate.nullable(),
    endsOn: isoDate.nullable(),
    textColor: z.enum(['black', 'white']),
    link: exhibitionSummarySchema.pick({ id: true, slug: true, kind: true, startsOn: true, endsOn: true }).nullable(),
    ...seoFields,
    updatedAt: isoTimestamp,
});
export type HomePage = z.infer<typeof homePageSchema>;

export interface Page<T> {
    items: T[];
    nextCursor: string | null;
}

export const PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;

export const schemas = { isoDate, isoTimestamp, uuid, slug };
