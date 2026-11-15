/** Inquiries: a visitor asks about a work or an exhibition; stored on their collector profile. */
import { z } from 'zod';
import { schemas } from './content.ts';
import type { ExhibitionKind } from './content.ts';

const { uuid } = schemas;

export const INQUIRY_NOTE_MAX = 1000;
export const INQUIRIES_PAGE_SIZE = 25;
export const INQUIRY_SOURCES = { exhibition: 'Exhibition', slide: 'Exhibition work', room: 'Viewing room' } as const;
export type InquirySource = keyof typeof INQUIRY_SOURCES;

/**
 * A note as typed, made safe to store and show as plain text: normalised, control characters
 * removed (newlines kept), at most two blank lines in a row, trimmed, at most 1000 characters.
 */
export function cleanNote(input: string): string {
    return input
        .normalize('NFC')
        .replace(/\r\n?/g, '\n')
        .replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{4,}/g, '\n\n\n')
        .trim()
        .slice(0, INQUIRY_NOTE_MAX);
}

const note = z
    .string()
    .max(INQUIRY_NOTE_MAX * 2, 'Your note is too long')
    .transform(cleanNote)
    .default('');
const email = z.string().trim().toLowerCase().pipe(z.email('Please enter a valid email'));

export const inquiryItemRef = z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('slide'), artworkId: uuid }),
    z.object({ kind: z.literal('exhibition'), exhibitionId: uuid }),
]);
export type InquiryItemRef = z.infer<typeof inquiryItemRef>;

/** From the public site. Name and email are needed unless the browser is already known. */
export const inquiryCreateSchema = z.object({
    item: inquiryItemRef,
    note,
    // Blank counts as missing (the API then asks for both).
    name: z
        .string()
        .trim()
        .max(200)
        .optional()
        .transform((v) => v || undefined),
    email: z.union([z.literal('').transform(() => undefined), z.string().trim().length(0).transform(() => undefined), email]).optional(),
    pageUrl: z.string().max(500).optional(),
    /** Honeypot: people never fill it in. */
    website: z.string().max(500).optional(),
});
export type InquiryCreate = z.input<typeof inquiryCreateSchema>;

/** From inside a viewing room (the room already knows who it is). */
export const roomInquirySchema = z.object({ workId: uuid, note });
export type RoomInquiry = z.input<typeof roomInquirySchema>;

/** Who this browser is, if known. */
export interface VisitorIdentity {
    name: string;
}

/** What the visitor was looking at when they asked (kept as it was then). */
export interface InquiryItem {
    title: string;
    artist?: string | null;
    date?: string | null;
    medium?: string | null;
    dimensions?: string | null;
    image?: string | null;
    price?: string | null;
    context?: string | null;
}

export interface InquirySummary {
    id: string;
    personId: string;
    personName: string;
    source: InquirySource;
    item: InquiryItem;
    note: string;
    pageUrl: string | null;
    workId: string | null;
    exhibition: { id: string; slug: string; kind: ExhibitionKind; title: string } | null;
    room: { id: string; title: string } | null;
    /** What they typed (absent when the browser was already known). */
    enteredName: string | null;
    enteredEmail: string | null;
    match: 'email' | 'alias' | 'new' | 'known';
    seenAt: string | null;
    seenBy: string | null;
    createdAt: string;
}
