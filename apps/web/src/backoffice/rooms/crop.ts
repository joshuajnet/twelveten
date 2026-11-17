import { derivedUrl, isDerivable, type ImageCrop } from '@twelveten/shared';

/**
 * Crop frames in image fractions (0–1 of the image's width and height). A frame of `aspect`
 * (width ÷ height on screen) over an image of `ratio` (its width ÷ height) has
 * `h = w × ratio ÷ aspect`.
 */

export type Corner = 'nw' | 'ne' | 'sw' | 'se';

/** A chosen image and the part of it to show (null: centred, filling the frame). */
export interface CroppedChoice {
    url: string;
    crop: ImageCrop | null;
}

/** An image offered in the picker. */
export interface ImageOption {
    url: string;
    label: string;
}

/** Smallest frame width, as a fraction of the image. */
export const MIN_CROP = 0.05;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const heightFor = (w: number, ratio: number, aspect: number) => (w * ratio) / aspect;

/** The largest frame of `aspect`, centred on the image. */
export function centredCrop(ratio: number, aspect: number): ImageCrop {
    const w = ratio > aspect ? aspect / ratio : 1;
    const h = heightFor(w, ratio, aspect);
    return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

/** The frame moved by (dx, dy), kept inside the image. */
export function moveCrop(c: ImageCrop, dx: number, dy: number): ImageCrop {
    return { ...c, x: clamp(c.x + dx, 0, 1 - c.w), y: clamp(c.y + dy, 0, 1 - c.h) };
}

/**
 * The frame resized by dragging `corner` by (dx, dy): the opposite corner stays put, the aspect is
 * kept (the larger of the two drag directions wins), and the frame stays inside the image.
 */
export function resizeCrop(c: ImageCrop, corner: Corner, dx: number, dy: number, ratio: number, aspect: number): ImageCrop {
    const west = corner === 'nw' || corner === 'sw';
    const north = corner === 'nw' || corner === 'ne';
    const anchorX = west ? c.x + c.w : c.x;
    const anchorY = north ? c.y + c.h : c.y;
    const fromX = c.w + (west ? -dx : dx);
    const fromY = ((c.h + (north ? -dy : dy)) * aspect) / ratio;
    const room = Math.min(west ? anchorX : 1 - anchorX, ((north ? anchorY : 1 - anchorY) * aspect) / ratio);
    const w = clamp(Math.max(fromX, fromY), Math.min(MIN_CROP, room), room);
    const h = heightFor(w, ratio, aspect);
    return { x: west ? anchorX - w : anchorX, y: north ? anchorY - h : anchorY, w, h };
}

/** A saved crop that still fits this image at this aspect (else the centred frame). */
export function fitCrop(c: ImageCrop | null | undefined, ratio: number, aspect: number): ImageCrop {
    if (!c) return centredCrop(ratio, aspect);
    const max = centredCrop(ratio, aspect).w;
    const w = clamp(c.w, Math.min(MIN_CROP, max), max);
    return moveCrop({ x: c.x, y: c.y, w, h: heightFor(w, ratio, aspect) }, 0, 0);
}

/** A preview copy of a /media image about `width` wide (the original when it has no copies). */
export function previewUrl(url: string, width: 480 | 960 | 1600 = 960): string {
    return isDerivable(url) ? derivedUrl(url, `w${width}.webp`) : url;
}

/** `<img @error>`: fall back to the original once when a preview copy is missing. */
export function fallBackTo(url: string) {
    return (e: Event) => {
        const img = e.target as HTMLImageElement;
        if (img.getAttribute('src') !== url) img.src = url;
    };
}
