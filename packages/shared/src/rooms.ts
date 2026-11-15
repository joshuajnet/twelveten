/** Online viewing rooms: admin configuration, the public (gated) payload, tracking and engagement. */
import { z } from 'zod';
import { richDocSchema, schemas, type RichDoc } from './content.ts';
import type { ArtistPress, ProfileType } from './people.ts';
import type { WorkStatus, WorkSummary } from './inventory.ts';

const { isoTimestamp, uuid } = schemas;
const text = z.string().trim();
const email = z.string().trim().toLowerCase().pipe(z.email('Please enter a valid email'));

export const ROOM_STATUSES = { draft: 'Draft', live: 'Live', closed: 'Closed' } as const;
export const roomStatus = z.enum(['draft', 'live', 'closed']);
export type RoomStatus = z.infer<typeof roomStatus>;
export const ROOMS_PAGE_SIZE = 25;
/** Viewing room links: 32 random bytes, base64url. */
export const ROOM_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
/** A visit ends after this long without activity; the next request starts a new one. */
export const VISIT_GAP_MS = 30 * 60 * 1000;

/** Label shown to viewers for a work that can't be bought. */
export const UNAVAILABLE_LABELS: Record<Exclude<WorkStatus, 'available'>, string> = {
    sold: 'Sold',
    on_hold: 'On hold',
    nfs: 'Not available',
    returned: 'Not available',
};

// ---------- Admin input ----------

const roomFields = {
    title: text.min(1, 'Title is required').max(200),
    intro: richDocSchema,
    showPrices: z.boolean(),
    hideUnavailable: z.boolean(),
    inquiryEmail: z.union([z.literal(''), z.email()]).transform((v) => v || null).nullable(),
    status: roomStatus,
    opensAt: isoTimestamp.nullable(),
    closesAt: isoTimestamp.nullable(),
};
const windowOrder = (r: { opensAt?: string | null; closesAt?: string | null }) =>
    !r.opensAt || !r.closesAt || Date.parse(r.closesAt) > Date.parse(r.opensAt);

export const roomCreateSchema = z
    .object(roomFields)
    .partial()
    .required({ title: true })
    .extend({ works: z.array(uuid).max(200).optional() })
    .refine(windowOrder, { message: 'The room must close after it opens', path: ['closesAt'] });
export type RoomCreate = z.input<typeof roomCreateSchema>;
export const roomPatchSchema = z
    .object(roomFields)
    .partial()
    .extend({ updatedAt: isoTimestamp })
    .refine(windowOrder, { message: 'The room must close after it opens', path: ['closesAt'] });
export type RoomPatch = z.input<typeof roomPatchSchema>;

export const roomWorksPutSchema = z.object({
    works: z
        .array(z.object({ workId: uuid, showPrice: z.boolean().nullable().default(null), hidden: z.boolean().default(false) }))
        .max(200)
        .refine((ws) => new Set(ws.map((w) => w.workId)).size === ws.length, 'Each work can appear once'),
});
export type RoomWorksPut = z.input<typeof roomWorksPutSchema>;

export const roomArtistsPutSchema = z.object({
    artists: z
        .array(
            z.object({
                artistId: uuid,
                showBio: z.boolean(),
                showCv: z.boolean(),
                showPress: z.boolean(),
                hiddenPressIds: z.array(uuid).max(500).default([]),
            }),
        )
        .max(200),
});
export type RoomArtistsPut = z.input<typeof roomArtistsPutSchema>;

// ---------- Admin read ----------

export interface RoomWorkSettings {
    workId: string;
    showPrice: boolean | null;
    hidden: boolean;
    work: WorkSummary;
}

export interface RoomArtistSettings {
    artistId: string;
    name: string;
    portrait: string | null;
    showBio: boolean;
    showCv: boolean;
    showPress: boolean;
    hiddenPressIds: string[];
    hasBio: boolean;
    hasCv: boolean;
    press: ArtistPress[];
}

export interface ViewingRoom {
    id: string;
    token: string;
    title: string;
    intro: RichDoc;
    showPrices: boolean;
    hideUnavailable: boolean;
    inquiryEmail: string | null;
    /** Where inquiries go when `inquiryEmail` is empty (the gallery email from the invoice settings). */
    defaultInquiryEmail: string;
    status: RoomStatus;
    opensAt: string | null;
    closesAt: string | null;
    works: RoomWorkSettings[];
    artists: RoomArtistSettings[];
    visitors: number;
    createdAt: string;
    updatedAt: string;
}

export interface RoomSummary {
    id: string;
    token: string;
    title: string;
    status: RoomStatus;
    opensAt: string | null;
    closesAt: string | null;
    works: number;
    visitors: number;
    lastVisitAt: string | null;
    cover: string | null;
    createdAt: string;
    updatedAt: string;
}

// ---------- Public payload ----------

export const roomEnterSchema = z.object({
    name: text.min(1, 'Please enter your name').max(200),
    email,
});
export type RoomEnter = z.input<typeof roomEnterSchema>;

export interface PublicRoomWork {
    id: string;
    artistId: string;
    artistName: string;
    title: string;
    dateText: string | null;
    medium: string | null;
    dimensions: string | null;
    edition: string | null;
    images: { url: string; alt: string }[];
    /** Inquire is offered only for available works. */
    available: boolean;
    /** "Sold", "On hold", "Not available" for unavailable works. */
    statusLabel: string | null;
    /** Formatted price, only when shown. */
    price: string | null;
}

export interface PublicRoomPress {
    id: string;
    outlet: string;
    title: string;
    url: string;
    publishedOn: string;
    issueLabel: string | null;
    byline: string | null;
}

export interface PublicRoomArtist {
    id: string;
    name: string;
    portrait: string | null;
    bioHtml: string | null;
    cvHtml: string | null;
    press: PublicRoomPress[] | null;
}

export interface PublicRoom {
    title: string;
    introHtml: string | null;
    inquiryEmail: string;
    works: PublicRoomWork[];
    artists: PublicRoomArtist[];
    /** The signed-in viewer (null in admin preview). */
    viewer: { name: string } | null;
    /** The visit tracking batches belong to (null in admin preview: nothing is tracked). */
    visitId: string | null;
}

export type RoomResponse = { gate: { title: string } } | { room: PublicRoom };

// ---------- Tracking ----------

const ms = z.number().int().min(0).max(24 * 3600 * 1000);
const count = z.number().int().min(0).max(10_000);
export const TRACK_EVENT_TYPES = ['view_mode', 'focus', 'zoom', 'click', 'inquire', 'artist_open', 'cv_open', 'press_click'] as const;
export type TrackEventType = (typeof TRACK_EVENT_TYPES)[number];
export const MAX_POINTER_POINTS = 4000;

export const trackBatchSchema = z.object({
    visitId: uuid,
    activeMs: ms,
    works: z
        .array(
            z.object({
                workId: uuid,
                viewMs: ms.default(0),
                hoverMs: ms.default(0),
                zoomMs: ms.default(0),
                focus: count.default(0),
                zooms: count.default(0),
                maxZoom: z.number().min(1).max(50).default(1),
                clicks: count.default(0),
                inquiries: count.default(0),
            }),
        )
        .max(200)
        .default([]),
    artists: z
        .array(z.object({ artistId: uuid, readMs: ms.default(0), opens: count.default(0), cvOpens: count.default(0), pressClicks: count.default(0) }))
        .max(200)
        .default([]),
    events: z
        .array(
            z.object({
                type: z.enum(TRACK_EVENT_TYPES),
                at: isoTimestamp,
                workId: uuid.nullable().optional(),
                artistId: uuid.nullable().optional(),
                data: z.record(z.string().max(40), z.union([z.string().max(200), z.number(), z.boolean(), z.null()])).optional(),
            }),
        )
        .max(200)
        .default([]),
    /** Flat [x, y, zoom×10, …] per work: x and y are 0–65535 across the image, zoom×10 is 10–255. */
    pointer: z
        .array(
            z.object({
                workId: uuid,
                points: z
                    .array(z.number().int().min(0).max(65535))
                    .refine((p) => p.length % 3 === 0, 'Points come in triples'),
            }),
        )
        .max(200)
        .default([])
        .refine((ps) => ps.reduce((n, p) => n + p.points.length / 3, 0) <= MAX_POINTER_POINTS, 'Too many pointer samples'),
});
export type TrackBatch = z.input<typeof trackBatchSchema>;

/** One pointer sample: x, y as 0..1 across the image, zoom ≥ 1. */
export interface PointerPoint {
    x: number;
    y: number;
    zoom: number;
}

/** Pack samples (5 bytes each: uint16 x, uint16 y, uint8 zoom×10; little-endian). */
export function packPointer(flat: number[]): Uint8Array {
    const n = Math.floor(flat.length / 3);
    const out = new Uint8Array(n * 5);
    const view = new DataView(out.buffer);
    for (let i = 0; i < n; i++) {
        view.setUint16(i * 5, flat[i * 3]!, true);
        view.setUint16(i * 5 + 2, flat[i * 3 + 1]!, true);
        view.setUint8(i * 5 + 4, Math.max(10, Math.min(255, flat[i * 3 + 2]!)));
    }
    return out;
}

export function unpackPointer(bytes: Uint8Array): PointerPoint[] {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const out: PointerPoint[] = [];
    for (let o = 0; o + 5 <= bytes.byteLength; o += 5) {
        out.push({ x: view.getUint16(o, true) / 65535, y: view.getUint16(o + 2, true) / 65535, zoom: view.getUint8(o + 4) / 10 });
    }
    return out;
}

/** Packed points as base64 (admin heatmap payload). */
export function pointerToBase64(bytes: Uint8Array): string {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
}
export function pointerFromBase64(b64: string): Uint8Array {
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
}

// ---------- Engagement ----------

export interface EngagementInput {
    activeMs: number;
    visits: number;
    worksTotal: number;
    /** Works looked at for at least `VIEWED_MS`. */
    worksViewed: number;
    zooms: number;
    focusCount: number;
    inquiries: number;
    /** Longest time spent on any one work. */
    maxWorkViewMs: number;
    artistReadMs: number;
    cvOpens: number;
    pressClicks: number;
}

/** A work counts as viewed after this long in view. */
export const VIEWED_MS = 3000;

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0);
const logScale = (v: number, cap: number) => clamp01(Math.log1p(Math.max(0, v)) / Math.log1p(cap));

/** 0–100 for a visitor in one room: time, coverage, revisits, depth, zooms, artist reading, inquiries. */
export function engagementScore(s: EngagementInput): number {
    const score =
        30 * logScale(s.activeMs / 60000, 30) +
        15 * clamp01(s.worksTotal ? s.worksViewed / s.worksTotal : 0) +
        15 * clamp01((s.visits - 1) / 4) +
        10 * clamp01(s.maxWorkViewMs / 120000) +
        10 * clamp01((s.zooms + s.focusCount / 4) / 8) +
        5 * clamp01(s.artistReadMs / 60000 + s.cvOpens * 0.5 + s.pressClicks * 0.25) +
        (s.inquiries > 0 ? 25 : 0);
    return Math.round(Math.min(100, score));
}

export interface WorkInterestInput {
    viewMs: number;
    hoverMs: number;
    zoomMs: number;
    zoomCount: number;
    focusCount: number;
    clicks: number;
    inquiries: number;
    visitsSeen: number;
    /** Time spent reading about the work's artist. */
    artistReadMs?: number;
}

/** 0–100 interest in one work for one visitor. */
export function workInterest(s: WorkInterestInput): number {
    const score =
        35 * logScale(s.viewMs / 1000, 180) +
        10 * clamp01(s.hoverMs / 60000) +
        20 * clamp01((s.zoomCount + s.zoomMs / 30000) / 5) +
        10 * clamp01((s.focusCount + s.clicks) / 6) +
        10 * clamp01((s.visitsSeen - 1) / 3) +
        5 * clamp01((s.artistReadMs ?? 0) / 60000) +
        (s.inquiries > 0 ? 30 : 0);
    return Math.round(Math.min(100, score));
}

export const ENGAGEMENT_LEVELS = [
    { min: 75, label: 'Hot' },
    { min: 50, label: 'Engaged' },
    { min: 25, label: 'Interested' },
    { min: 0, label: 'Browsing' },
] as const;
export function engagementLabel(score: number): string {
    return ENGAGEMENT_LEVELS.find((l) => score >= l.min)!.label;
}
/** 0–5 filled dots. */
export function engagementDots(score: number): number {
    return score <= 0 ? 0 : Math.min(5, Math.ceil(score / 20));
}

// ---------- Inquiry ----------

/** `mailto:` link asking about one work. */
export function inquiryMailto(
    work: Pick<PublicRoomWork, 'artistName' | 'title' | 'dateText' | 'medium' | 'dimensions' | 'price'>,
    opts: { to: string; viewerName?: string | null; roomTitle: string; roomUrl: string },
): string {
    const title = work.title || 'Untitled';
    const subject = `Inquiry: ${work.artistName}, ${title}${work.dateText ? `, ${work.dateText}` : ''}`;
    const lines = [
        `I would like more information about this work from "${opts.roomTitle}":`,
        '',
        work.artistName,
        `${title}${work.dateText ? `, ${work.dateText}` : ''}`,
        work.medium,
        work.dimensions,
        work.price,
        '',
        opts.roomUrl,
        '',
        opts.viewerName ? `— ${opts.viewerName}` : null,
    ].filter((l): l is string => l !== null && l !== undefined);
    return `mailto:${opts.to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
}

// ---------- Admin dashboards ----------

export interface RoomVisitorSummary {
    id: string;
    roomId: string;
    roomTitle: string;
    roomStatus: RoomStatus;
    personId: string;
    personName: string;
    enteredName: string;
    enteredEmail: string;
    match: 'email' | 'alias' | 'new';
    firstSeenAt: string;
    lastSeenAt: string;
    visits: number;
    activeMs: number;
    worksViewed: number;
    worksTotal: number;
    inquiries: number;
    engagement: number;
}

export interface WorkInterest {
    workId: string;
    title: string;
    artistId: string;
    artistName: string;
    dateText: string | null;
    image: string | null;
    status: WorkStatus;
    viewMs: number;
    hoverMs: number;
    zoomMs: number;
    zoomCount: number;
    maxZoom: number;
    focusCount: number;
    clicks: number;
    inquiries: number;
    visitsSeen: number;
    interest: number;
    lastSeenAt: string | null;
    /** Room-wide totals: how many visitors looked at it. */
    viewers?: number;
    /** Collector panel: the room the interest was recorded in. */
    roomId?: string;
    visitorId?: string;
}

export interface ArtistInterest {
    artistId: string;
    name: string;
    readMs: number;
    opens: number;
    cvOpens: number;
    pressClicks: number;
}

export interface RoomVisit {
    id: string;
    startedAt: string;
    lastActivityAt: string;
    activeMs: number;
    userAgent: string | null;
}

export interface RoomEvent {
    id: number;
    visitId: string;
    at: string;
    type: TrackEventType | 'enter' | 'cv_pdf';
    workId: string | null;
    workTitle: string | null;
    artistId: string | null;
    artistName: string | null;
    data: Record<string, unknown> | null;
}

export interface PersonBrief {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    profiles: ProfileType[];
    createdAt: string;
    /** Created by a viewing room sign-up. */
    fromViewingRoom: boolean;
}

export interface PersonDuplicate {
    a: PersonBrief;
    b: PersonBrief;
    reasons: string[];
    score: number;
}

export interface VisitorDashboard {
    visitor: RoomVisitorSummary;
    room: { id: string; title: string; token: string };
    visits: RoomVisit[];
    works: WorkInterest[];
    artists: ArtistInterest[];
    events: RoomEvent[];
    possibleMatches: PersonDuplicate[];
}

export interface RoomDashboard {
    room: RoomSummary;
    totals: { visitors: number; visits: number; activeMs: number; inquiries: number };
    visitors: RoomVisitorSummary[];
    works: WorkInterest[];
}

/** Packed pointer samples for one work (base64 of `packPointer` output). */
export interface PointerData {
    workId: string;
    points: string;
}
