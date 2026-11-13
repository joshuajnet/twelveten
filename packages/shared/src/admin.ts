/** Request bodies for the admin API (validated on the server, reused by the editor). */
import { z } from 'zod';
import { exhibitionKind, headerLinkSchema, richDocSchema, schemas } from './content.ts';

const { isoDate, isoTimestamp, uuid, slug } = schemas;
const text = z.string().trim();
const optionalText = text.nullable();
/** Site-relative path or http(s) URL. */
const link = z.string().trim().refine((v) => v.startsWith('/') || /^https?:\/\//i.test(v) || /^mailto:/i.test(v), 'Must be a /path or http(s) URL');
const optionalLink = link.nullable();
const timeZone = z.string().refine((tz) => {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}, 'Unknown time zone');

/** Every update carries the `updatedAt` the editor last saw (optimistic locking). */
const version = { updatedAt: isoTimestamp };

export const exhibitionCreateSchema = z.object({
    kind: exhibitionKind,
    title: text.min(1),
    slug: slug.optional(),
    startsOn: isoDate,
    endsOn: isoDate,
    artists: text.default(''),
});
export type ExhibitionCreate = z.infer<typeof exhibitionCreateSchema>;

export const exhibitionPatchSchema = z
    .object({
        slug,
        kind: exhibitionKind,
        artists: text,
        title: text.min(1),
        subtitle: optionalText,
        titleFirst: z.boolean(),
        startsOn: isoDate,
        endsOn: isoDate,
        timezone: timeZone,
        hoursText: optionalText,
        venueText: optionalText,
        locationText: optionalText,
        heroImage: optionalLink,
        heroAlt: optionalText,
        thumbnail: optionalLink,
        pressReleaseUrl: optionalLink,
        headerLinks: z.array(headerLinkSchema.extend({ url: link })).max(10),
        showInquire: z.boolean(),
        slideshowVisible: z.boolean(),
        worksAvailable: z.boolean(),
        content: richDocSchema,
        seoTitle: optionalText,
        seoDescription: optionalText,
        ogImage: optionalLink,
        published: z.boolean(),
    })
    .partial()
    .extend(version);
export type ExhibitionPatch = z.infer<typeof exhibitionPatchSchema>;

export const eventInputSchema = z.object({
    label: text.min(1),
    startsAt: isoTimestamp,
    endsAt: isoTimestamp.nullable(),
});
export const eventsPutSchema = z.object({ events: z.array(eventInputSchema).max(20) });
export type EventInput = z.infer<typeof eventInputSchema>;

const artworkFields = {
    image: optionalLink,
    video: optionalLink,
    alt: text,
    author: optionalText,
    title: optionalText,
    dateText: optionalText,
    dimensions: optionalText,
    media: optionalText,
    credit: optionalText,
    hidden: z.boolean(),
    available: z.boolean(),
};
export const artworkCreateSchema = z
    .object(artworkFields)
    .partial()
    .refine((a) => a.image || a.video, 'An image or video is required');
export type ArtworkCreate = z.infer<typeof artworkCreateSchema>;
export const artworkPatchSchema = z.object(artworkFields).partial().extend(version);
export type ArtworkPatch = z.infer<typeof artworkPatchSchema>;
export const artworkOrderSchema = z.object({ ids: z.array(uuid).min(1) });

export const newsCreateSchema = z.object({
    title: text.min(1),
    slug: slug.optional(),
    publishedAt: isoTimestamp.optional(),
    bodyHtml: z.string().default(''),
});
export type NewsCreate = z.infer<typeof newsCreateSchema>;
export const newsPatchSchema = z
    .object({
        slug,
        title: text.min(1),
        publishedAt: isoTimestamp,
        bodyHtml: z.string(),
        seoTitle: optionalText,
        seoDescription: optionalText,
        ogImage: optionalLink,
        published: z.boolean(),
    })
    .partial()
    .extend(version);
export type NewsPatch = z.infer<typeof newsPatchSchema>;

const pressFields = {
    outlet: text.min(1),
    title: text.min(1),
    url: z.url(),
    publishedOn: isoDate,
    issueLabel: optionalText,
    byline: optionalText,
    exhibitionId: uuid.nullable(),
    published: z.boolean(),
};
export const pressCreateSchema = z.object(pressFields).partial({ issueLabel: true, byline: true, exhibitionId: true, published: true });
export type PressCreate = z.infer<typeof pressCreateSchema>;
export const pressPatchSchema = z.object(pressFields).partial().extend(version);
export type PressPatch = z.infer<typeof pressPatchSchema>;

export const homePatchSchema = z
    .object({
        bgImage: link,
        bgImageMobile: optionalLink,
        bgFocalPoint: z.string().regex(/^\d{1,3}% \d{1,3}%$/, "Like '50% 50%'"),
        headline: text,
        subline: text,
        extraText: optionalText,
        startsOn: isoDate.nullable(),
        endsOn: isoDate.nullable(),
        textColor: z.enum(['black', 'white']),
        linkExhibitionId: uuid.nullable(),
        seoTitle: optionalText,
        seoDescription: optionalText,
        ogImage: optionalLink,
    })
    .partial()
    .extend(version);
export type HomePatch = z.infer<typeof homePatchSchema>;

export const UPLOAD_TYPES = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'video/mp4': 'mp4',
    'application/pdf': 'pdf',
} as const;
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
export const uploadRequestSchema = z.object({
    filename: z.string().min(1).max(200),
    contentType: z.enum(Object.keys(UPLOAD_TYPES) as [keyof typeof UPLOAD_TYPES, ...(keyof typeof UPLOAD_TYPES)[]]),
    size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});
export type UploadRequest = z.infer<typeof uploadRequestSchema>;
export interface UploadTicket {
    uploadUrl: string;
    url: string;
    key: string;
    headers: Record<string, string>;
}

export const revisionEntity = z.enum(['exhibition', 'artwork', 'news_post', 'press_item', 'home_page']);
export type RevisionEntityName = z.infer<typeof revisionEntity>;
export interface RevisionSummary {
    id: string;
    entity: RevisionEntityName;
    entityId: string | null;
    action: 'create' | 'update' | 'delete' | 'restore';
    userName: string | null;
    createdAt: string;
}

/** Turns a title into a URL slug. */
export function slugify(input: string): string {
    return input
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)
        .replace(/-+$/g, '') || 'untitled';
}
