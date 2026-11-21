import sharp from 'sharp';
import { derivedUrl, isDerivable, type ImageCrop } from '@twelveten/shared';
import { readMedia } from '../storage/mediaRead.ts';
import type { Storage } from '../storage/uploads.ts';

/** Images in generated PDFs are prepared at no more than this resolution for their drawn size. */
export const IMAGE_DPI = 250;
/** Pixel size for drawing at `pt` points wide/high at `IMAGE_DPI`. */
export const pixelsFor = (pt: number) => Math.ceil((pt / 72) * IMAGE_DPI);

/** A prepared JPEG and its pixel size. */
export interface PdfImage {
    data: Buffer;
    width: number;
    height: number;
}

/** Width and height as displayed (EXIF orientations 5–8 swap them). */
export async function orientedSize(buf: Buffer): Promise<{ width: number; height: number } | null> {
    try {
        const m = await sharp(buf).metadata();
        if (!m.width || !m.height) return null;
        return (m.orientation ?? 1) >= 5 ? { width: m.height, height: m.width } : { width: m.width, height: m.height };
    } catch {
        return null;
    }
}

/**
 * Image bytes with at least `need(size)` pixels where possible: the 2400px display copy when it
 * is big enough (fast to decode), else the zoom copy, else the original; the largest found otherwise.
 */
export async function readImage(storage: Storage | undefined, url: string, need: (size: { width: number; height: number }) => { width: number; height: number }) {
    const candidates = isDerivable(url) ? [derivedUrl(url, 'w2400.webp'), derivedUrl(url, 'zoom.jpg'), url] : [url];
    let best: { buf: Buffer; size: { width: number; height: number } } | null = null;
    for (const candidate of candidates) {
        const buf = await readMedia(storage, candidate);
        const size = buf ? await orientedSize(buf) : null;
        if (!buf || !size) continue;
        if (!best || size.width > best.size.width) best = { buf, size };
        const want = need(size);
        if (size.width >= want.width && size.height >= want.height) break;
    }
    return best;
}

/** The crop in pixels of an image of this (oriented) size, kept inside it. */
function cropPixels(crop: ImageCrop, size: { width: number; height: number }) {
    const left = Math.min(size.width - 1, Math.max(0, Math.round(crop.x * size.width)));
    const top = Math.min(size.height - 1, Math.max(0, Math.round(crop.y * size.height)));
    return {
        left,
        top,
        width: Math.max(1, Math.min(size.width - left, Math.round(crop.w * size.width))),
        height: Math.max(1, Math.min(size.height - top, Math.round(crop.h * size.height))),
    };
}

export async function toJpeg(input: Buffer, size: { width: number; height: number; fit: 'inside' | 'cover' }, crop?: { crop: ImageCrop; source: { width: number; height: number } }) {
    let img = sharp(input, { limitInputPixels: 200_000_000 });
    // Orient first so the crop applies to the image as displayed.
    if (crop) img = sharp(await img.rotate().toBuffer(), { limitInputPixels: 200_000_000 }).extract(cropPixels(crop.crop, crop.source));
    else img = img.rotate();
    const { data, info } = await img
        .flatten({ background: '#ffffff' })
        .resize({ ...size, withoutEnlargement: size.fit === 'inside' })
        .toColourspace('srgb')
        .jpeg({ quality: 82, progressive: true })
        .toBuffer({ resolveWithObject: true });
    return { data, width: info.width, height: info.height };
}

/**
 * A JPEG of the image at `url` that fits inside `maxW` × `maxH` points, at no more than
 * `IMAGE_DPI`; null when it is missing or unreadable.
 */
export async function fittedImage(storage: Storage | undefined, url: string, maxW: number, maxH: number): Promise<PdfImage | null> {
    const box = { width: pixelsFor(maxW), height: pixelsFor(maxH) };
    const need = (size: { width: number; height: number }) => {
        const scale = Math.min(box.width / size.width, box.height / size.height);
        return { width: Math.ceil(size.width * scale), height: Math.ceil(size.height * scale) };
    };
    const found = await readImage(storage, url, need);
    if (!found) return null;
    try {
        return await toJpeg(found.buf, { ...need(found.size), fit: 'inside' });
    } catch {
        return null;
    }
}
