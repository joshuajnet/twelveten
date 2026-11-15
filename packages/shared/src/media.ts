/**
 * Image derivatives: smaller copies of every raster image under /media, named after the original so
 * pages can use them without any extra data. `/media/<path>` → `/media/derived/<path>/<name>`.
 */

/** Display widths (WebP); never larger than the original. */
export const DISPLAY_WIDTHS = [480, 960, 1600, 2400] as const;
/** Long edge of the zoom copy (progressive JPEG). */
export const ZOOM_MAX = 6000;
/** Width of the blurred placeholder. */
export const PLACEHOLDER_WIDTH = 48;

export const MEDIA_VARIANTS = [`w${PLACEHOLDER_WIDTH}.webp`, ...DISPLAY_WIDTHS.map((w) => `w${w}.webp`), 'zoom.jpg'] as const;
export type MediaVariant = (typeof MEDIA_VARIANTS)[number];

const RASTER = /\.(jpe?g|png|webp)$/i;
const DERIVED = '/media/derived/';

/** A /media image we make derivatives of (JPEG, PNG, WebP; not SVG, GIF or a derivative itself). */
export function isDerivable(url: string | null | undefined): url is string {
    if (!url) return false;
    const path = url.split(/[?#]/)[0]!;
    return path.startsWith('/media/') && !path.startsWith(DERIVED) && RASTER.test(path);
}

/** The URL of one derivative of `url`. */
export function derivedUrl(url: string, name: MediaVariant): string {
    const path = url.split(/[?#]/)[0]!;
    return `${DERIVED}${path.slice('/media/'.length)}/${name}`;
}

/** The bucket key of a derivative, from the original's key (`media/<path>`). */
export function derivedKey(originalKey: string, name: MediaVariant): string {
    return `media/derived/${originalKey.replace(/^media\//, '')}/${name}`;
}

/** `srcset` for the display widths, or '' when the image has no derivatives. */
export function imageSrcset(url: string | null | undefined): string {
    if (!isDerivable(url)) return '';
    return DISPLAY_WIDTHS.map((w) => `${derivedUrl(url, `w${w}.webp`)} ${w}w`).join(', ');
}

/** The blurred placeholder, or null. */
export const placeholderUrl = (url: string | null | undefined): string | null => (isDerivable(url) ? derivedUrl(url, `w${PLACEHOLDER_WIDTH}.webp`) : null);

/** The high-resolution zoom copy, or null (use the original then). */
export const zoomUrl = (url: string | null | undefined): string | null => (isDerivable(url) ? derivedUrl(url, 'zoom.jpg') : null);

/** The largest display copy (what the page shows full-screen), or the original. */
export const largeUrl = (url: string): string => (isDerivable(url) ? derivedUrl(url, `w${DISPLAY_WIDTHS[DISPLAY_WIDTHS.length - 1]}.webp`) : url);
