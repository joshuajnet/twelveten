import { createHash, randomUUID } from 'node:crypto';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { sql } from 'kysely';
import { htmlToText, slugify, type ImageCrop, type RoomPdfStatus } from '@twelveten/shared';
import type { DB } from '../db/index.ts';
import type { ViewingRoomRow } from '../db/types.ts';
import { config } from '../config.ts';
import { getSettings } from '../invoices/queries.ts';
import { HttpError } from '../routes/admin/errors.ts';
import { readImage, toJpeg } from '../lib/pdfImages.ts';
import type { Storage } from '../storage/uploads.ts';
import { pdfResponse } from '../routes/admin/util.ts';
import { publicRoom } from './queries.ts';
import {
    pageKey,
    PAGE_H,
    PAGE_W,
    pixelsFor,
    renderRoomPdf,
    ROOM_PDF_LAYOUT_VERSION,
    workImagePlacement,
    type RoomPdfImages,
    type RoomPdfModel,
    type RoomPdfWork,
} from './roomPdf.ts';

const LINK_TTL_S = 10 * 60;
/** Replaced PDFs are kept at least this long; the newest is kept until it is replaced. */
export const PDF_RETENTION_DAYS = 30;

/** Bio HTML → plain paragraphs. */
function paragraphs(html: string): string[] {
    return html
        .split(/<\/p>|<br\s*\/?>|<\/li>|<\/h\d>/i)
        .map(htmlToText)
        .filter(Boolean);
}

/**
 * What the PDF shows: exactly what the room shows a visitor (visible works, price settings, bios
 * the room shares), plus the gallery's contact details from the invoice settings.
 */
export async function roomPdfModel(db: DB, room: ViewingRoomRow): Promise<RoomPdfModel> {
    const [view, settings, backgrounds] = await Promise.all([
        publicRoom(db, room, null, null),
        getSettings(db),
        db.selectFrom('viewing_room_artists').select(['artist_id', 'bio_background', 'bio_background_crop', 'bio_background_color']).where('room_id', '=', room.id).execute(),
    ]);
    const background = new Map(backgrounds.map((b) => [b.artist_id, b]));
    const artistNames = [...new Set(view.works.map((w) => w.artistName))];
    const firstImage = view.works.find((w) => w.images[0])?.images[0]?.url ?? null;
    return {
        heading: artistNames.length === 1 ? artistNames[0]! : room.title,
        subtitle: room.subtitle,
        gallery: { name: settings.galleryName, email: settings.email, phone: settings.phone },
        cover: room.cover_image ?? firstImage,
        coverCrop: room.cover_image ? room.cover_crop : null,
        works: view.works.map((w) => ({
            artistName: w.artistName,
            title: w.title,
            dateText: w.dateText,
            medium: w.medium,
            dimensions: w.dimensions,
            edition: w.edition,
            price: w.price,
            statusLabel: w.statusLabel,
            image: w.images[0]?.url ?? null,
        })),
        bios: view.artists.filter((a) => a.bioHtml).map((a) => ({ name: a.name, paragraphs: paragraphs(a.bioHtml!),
            background: background.get(a.id)?.bio_background ?? null,
            crop: background.get(a.id)?.bio_background ? (background.get(a.id)?.bio_background_crop ?? null) : null,
            color: background.get(a.id)?.bio_background_color ?? null,
        })),
    };
}

/** The file name visitors get: "noelle-africh-nada-miami-2026.pdf". */
export function roomPdfFilename(m: RoomPdfModel): string {
    return `${slugify([m.heading, m.subtitle].filter(Boolean).join(' ')) || 'viewing-room'}.pdf`;
}

/** Stable key for one version of the PDF: any change to what it shows makes a new file. */
export function roomPdfHash(m: RoomPdfModel): string {
    return createHash('sha256')
        .update(JSON.stringify({ v: ROOM_PDF_LAYOUT_VERSION, m }))
        .digest('hex')
        .slice(0, 32);
}

/**
 * Images at no more than `IMAGE_DPI` (250) for the size they are drawn on the page: work images
 * fitted to their placement, the cover and bio backgrounds cropped to fill the page. Unreadable ones
 * are left out.
 */
export async function prepareRoomImages(storage: Storage | undefined, m: RoomPdfModel): Promise<RoomPdfImages> {
    const out: RoomPdfImages = new Map();
    const firstUse = new Map<string, RoomPdfWork>();
    for (const w of m.works) if (w.image && !firstUse.has(w.image)) firstUse.set(w.image, w);
    const page = { width: pixelsFor(PAGE_W), height: pixelsFor(PAGE_H) };

    type Job = { key: string; url: string; need: (s: { width: number; height: number }) => { width: number; height: number }; fit: 'inside' | 'cover'; crop?: ImageCrop };
    const jobs: Job[] = [...firstUse].map(([url, w]) => ({
        key: url,
        url,
        need: (size) => {
            const p = workImagePlacement(w, size.width, size.height);
            return { width: pixelsFor(p.width), height: pixelsFor(p.height) };
        },
        fit: 'inside',
    }));
    // Full-page photos (cover, bio backgrounds): enough pixels for the chosen area (else the whole
    // image) scaled to cover the page.
    const pagePhotos = new Map<string, { url: string; crop: ImageCrop | null }>();
    for (const p of [{ url: m.cover, crop: m.coverCrop }, ...m.bios.map((b) => ({ url: b.background, crop: b.crop }))]) {
        if (p.url) pagePhotos.set(pageKey(p.url, p.crop), { url: p.url, crop: p.crop });
    }
    for (const [key, { url, crop }] of pagePhotos) {
        jobs.push({
            key,
            url,
            need: (size) => {
                const area = crop ? { width: size.width * crop.w, height: size.height * crop.h } : size;
                const scale = Math.max(page.width / area.width, page.height / area.height);
                return { width: Math.ceil(size.width * scale), height: Math.ceil(size.height * scale) };
            },
            fit: 'cover',
            crop: crop ?? undefined,
        });
    }
    // A few at a time keeps memory bounded.
    await Promise.all(
        Array.from({ length: 3 }, async () => {
            for (let job = jobs.shift(); job; job = jobs.shift()) {
                const found = await readImage(storage, job.url, job.need);
                if (!found) continue;
                const target = job.fit === 'cover' ? page : job.need(found.size);
                try {
                    out.set(job.key, await toJpeg(found.buf, { ...target, fit: job.fit }, job.crop ? { crop: job.crop, source: found.size } : undefined));
                } catch {
                    // Not an image sharp can read; the page is laid out without it.
                }
            }
        }),
    );
    return out;
}

export async function buildRoomPdf(db: DB, storage: Storage | undefined, room: ViewingRoomRow): Promise<{ pdf: Buffer; model: RoomPdfModel }> {
    const model = await roomPdfModel(db, room);
    const pdf = await renderRoomPdf(model, await prepareRoomImages(storage, model));
    return { pdf, model };
}

/** The PDF on offer for a room: the newest one generated, unless an admin withdrew it. */
export async function latestRoomPdf(db: DB, roomId: string) {
    const newest = await db.selectFrom('viewing_room_pdfs').selectAll().where('room_id', '=', roomId).orderBy('created_at', 'desc').limit(1).executeTakeFirst();
    return newest && !newest.withdrawn_at ? newest : null;
}

/**
 * Withdraw the room's PDF (an admin action): nothing is offered until a new one is generated. The
 * file stays for the retention period and is pruned with the others. False when there was none.
 */
export async function withdrawRoomPdf(db: DB, roomId: string): Promise<boolean> {
    const r = await db.updateTable('viewing_room_pdfs').set({ withdrawn_at: sql<string>`now()` }).where('room_id', '=', roomId).where('withdrawn_at', 'is', null).executeTakeFirst();
    return Number(r.numUpdatedRows) > 0;
}

/** The newest PDF and whether the room has changed since (works, prices, bios, cover, subtitle, …). */
export async function roomPdfStatus(db: DB, room: ViewingRoomRow): Promise<RoomPdfStatus | null> {
    const latest = await latestRoomPdf(db, room.id);
    if (!latest) return null;
    const current = roomPdfHash(await roomPdfModel(db, room));
    return { generatedAt: latest.created_at, bytes: latest.bytes, filename: latest.filename, outdated: current !== latest.content_hash };
}

/**
 * Render the room PDF now (an admin action) and store it under the private `exports/` prefix of
 * the media bucket (outside `media/`, so neither CloudFront nor the bucket policy serves it). It
 * becomes the PDF on offer; replaced PDFs older than `PDF_RETENTION_DAYS` are removed.
 */
export async function generateRoomPdf(db: DB, storage: Storage | undefined, room: ViewingRoomRow, userId: string | null): Promise<RoomPdfStatus> {
    if (!storage) throw new HttpError(422, 'File storage is not configured');
    const { pdf, model } = await buildRoomPdf(db, storage, room);
    const hash = roomPdfHash(model);
    const key = `exports/rooms/${room.id}/${randomUUID()}.pdf`;
    const filename = roomPdfFilename(model);
    await storage.client.send(new PutObjectCommand({ Bucket: storage.bucket, Key: key, Body: pdf, ContentType: 'application/pdf', CacheControl: 'private, no-store' }));
    const row = await db
        .insertInto('viewing_room_pdfs')
        .values({ room_id: room.id, s3_key: key, filename, bytes: pdf.length, content_hash: hash, created_by: userId })
        .returning('created_at')
        .executeTakeFirstOrThrow();
    await pruneRoomPdfs(db, storage, room.id);
    return { generatedAt: row.created_at, bytes: pdf.length, filename, outdated: false };
}

/** Remove this room's replaced or withdrawn PDFs older than the retention period (never the one on offer). */
async function pruneRoomPdfs(db: DB, storage: Storage, roomId: string): Promise<void> {
    const latest = await latestRoomPdf(db, roomId);
    let q = db.selectFrom('viewing_room_pdfs').select(['id', 's3_key']).where('room_id', '=', roomId);
    if (latest) q = q.where('id', '!=', latest.id);
    const old = await q
        .where('created_at', '<', sql<string>`now() - make_interval(days => ${PDF_RETENTION_DAYS})`)
        .execute();
    for (const r of old) {
        await storage.client.send(new DeleteObjectCommand({ Bucket: storage.bucket, Key: r.s3_key }));
        await db.deleteFrom('viewing_room_pdfs').where('id', '=', r.id).execute();
    }
}

/**
 * Download the room's newest generated PDF (404 when none has been generated). In AWS the
 * response redirects to a 10-minute signed link (the file is often over Lambda's 6 MB response
 * limit); against a local S3 emulator the bytes are sent directly.
 */
export async function roomPdfDownload(
    c: { var: { db: DB }; redirect: (url: string, status: 302) => Response; body: (data: Uint8Array, status: 200, headers: Record<string, string>) => Response },
    storage: Storage | undefined,
    roomId: string,
    opts: { direct?: boolean } = {},
): Promise<Response> {
    const latest = await latestRoomPdf(c.var.db, roomId);
    if (!latest || !storage) throw new HttpError(404, 'No PDF has been generated for this room');
    if (opts.direct ?? Boolean(config().AWS_ENDPOINT_URL)) {
        const res = await storage.client.send(new GetObjectCommand({ Bucket: storage.bucket, Key: latest.s3_key }));
        if (!res.Body) throw new HttpError(404, 'Not found');
        return pdfResponse(c, Buffer.from(await res.Body.transformToByteArray()), latest.filename);
    }
    const filename = latest.filename.replace(/["\\\r\n]/g, '');
    const url = await getSignedUrl(
        storage.client,
        new GetObjectCommand({ Bucket: storage.bucket, Key: latest.s3_key, ResponseContentType: 'application/pdf', ResponseContentDisposition: `attachment; filename="${filename}"` }),
        { expiresIn: LINK_TTL_S },
    );
    return c.redirect(url, 302);
}
