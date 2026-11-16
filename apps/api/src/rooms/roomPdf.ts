import type { Content, ContentText, TDocumentDefinitions } from 'pdfmake/interfaces';
import { pdfmake, useGalleryFonts } from '../lib/pdf.ts';

/**
 * The viewing room PDF: an A4 landscape presentation in the gallery's fair-PDF style.
 * Cover (full-bleed photo, name, subtitle, gallery contact) → one page per work, the image as
 * large as the page allows and running to its edges → artist bios (optionally on a full-bleed
 * photo) → back page. Everything is absolutely positioned; images arrive prepared as JPEGs.
 */

/** Bump when the layout changes, so cached exports are regenerated. */
export const ROOM_PDF_LAYOUT_VERSION = 4;

export const PAGE_W = 841.89;
export const PAGE_H = 595.28;
/** Works at least this much wider than tall get the full-width layout. */
export const LANDSCAPE_RATIO = 1.15;

export interface RoomPdfWork {
    artistName: string;
    title: string;
    dateText: string | null;
    medium: string | null;
    dimensions: string | null;
    edition: string | null;
    /** Formatted price, when the room shows it. */
    price: string | null;
    /** "Sold", "On hold", … for unavailable works. */
    statusLabel: string | null;
    /** Primary image URL (the key into the image map). */
    image: string | null;
}

export interface RoomPdfModel {
    /** Big cover text: the artist's name, or the room title when several artists are shown. */
    heading: string;
    subtitle: string | null;
    gallery: { name: string; email: string; phone: string };
    /** Cover photo URL. */
    cover: string | null;
    works: RoomPdfWork[];
    /** Bio pages: on a full-bleed photo (`background` URL), else a solid `color` (`#rrggbb`), else white. */
    bios: { name: string; paragraphs: string[]; background: string | null; color: string | null }[];
}

/**
 * Prepared JPEG bytes and pixel size: work images under their URL, full-page photos (cover, bio
 * backgrounds; already cropped to the page) under `pageKey(url)`.
 */
export type RoomPdfImages = Map<string, { data: Buffer; width: number; height: number }>;
export const pageKey = (url: string) => `page:${url}`;

const WHITE = '#ffffff';
const BLACK = '#000000';

const dataUrl = (b: Buffer) => `data:image/jpeg;base64,${b.toString('base64')}`;

/** Cover text sized to fit one or two lines across the page. */
function headingSize(s: string): number {
    if (s.length <= 22) return 72;
    if (s.length <= 32) return 56;
    if (s.length <= 48) return 44;
    return 34;
}

/** Bio type size: as large as the text allows, like the hand-made PDFs. */
function bioSize(chars: number): number {
    if (chars <= 800) return 17;
    if (chars <= 1300) return 14;
    if (chars <= 2000) return 12;
    return 10;
}

/** The work's caption parts, without the leading "Artist, Title, date". */
function details(w: RoomPdfWork): string[] {
    return [w.medium, w.dimensions, w.edition, w.price ?? w.statusLabel].map((s) => s?.trim().replace(/\.$/, '') ?? '').filter(Boolean);
}

function titleLine(w: RoomPdfWork): ContentText['text'] {
    return [`${w.artistName}, `, { text: w.title || 'Untitled', italics: true }, w.dateText ? `, ${w.dateText}` : ''];
}

/** Rough line count for a caption column (Gentium averages ~0.47em per character). */
function estimateLines(text: string, width: number, size: number): number {
    const perLine = Math.max(8, Math.floor(width / (size * 0.47)));
    return Math.max(1, Math.ceil(text.length / perLine));
}

/** Absolutely positioned block of fixed width (pdfmake sizes absolute content to the page otherwise). */
function block(x: number, y: number, width: number, content: Content): Content {
    return { absolutePosition: { x, y }, columns: [{ width, stack: [content] }] } as Content;
}

const NO_PADDING = { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 };

/**
 * Content placed in a fixed box and aligned vertically by pdfmake's own measurement (a one-cell
 * table with a fixed row height), so wrapped text sits exactly centered or on the box's bottom.
 */
function vbox(box: { x: number; y: number; w: number; h: number }, align: 'middle' | 'bottom', content: Content): Content {
    return {
        absolutePosition: { x: box.x, y: box.y },
        table: { widths: [box.w], heights: [box.h], body: [[{ stack: [content], verticalAlignment: align }]] },
        layout: NO_PADDING,
    } as Content;
}

function fullBleed(image: Buffer): Content {
    return { image: dataUrl(image), width: PAGE_W, height: PAGE_H, absolutePosition: { x: 0, y: 0 } };
}

/** Whether white type reads better than black on a `#rrggbb` colour (WCAG relative luminance). */
export function isDark(hex: string): boolean {
    const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hex.slice(i, i + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // Contrast with white vs with black: (1.05)/(l+0.05) vs (l+0.05)/0.05.
    return 1.05 / (l + 0.05) > (l + 0.05) / 0.05;
}

/** A soft darkening over a photo so white type stays legible. */
function scrim(opacity: number): Content {
    return { canvas: [{ type: 'rect', x: 0, y: 0, w: PAGE_W, h: PAGE_H, color: BLACK, fillOpacity: opacity }], absolutePosition: { x: 0, y: 0 } };
}

type Align = 'start' | 'center';
/** Fit an image of w×h into a box (never cropped); spare room goes after it (`start`) or around it. */
export function fit(w: number, h: number, box: { x: number; y: number; w: number; h: number }, align: { x: Align; y: Align } = { x: 'center', y: 'center' }) {
    const scale = Math.min(box.w / w, box.h / h);
    const width = w * scale;
    const height = h * scale;
    return { x: box.x + (align.x === 'center' ? (box.w - width) / 2 : 0), y: box.y + (align.y === 'center' ? (box.h - height) / 2 : 0), width, height };
}

function coverPage(m: RoomPdfModel, images: RoomPdfImages): Content[] {
    const photo = m.cover ? images.get(pageKey(m.cover)) : undefined;
    const color = photo ? WHITE : BLACK;
    const size = headingSize(m.heading);
    const out: Content[] = [];
    if (photo) out.push(fullBleed(photo.data), scrim(0.18));
    const headingLines = estimateLines(m.heading, PAGE_W - 160, size);
    const blockH = headingLines * size * 1.05 + (m.subtitle ? 40 : 0);
    out.push(
        block(80, (PAGE_H - blockH) / 2 - 20, PAGE_W - 160, {
            stack: [
                { text: m.heading, fontSize: size, lineHeight: 1.05, alignment: 'center', color },
                ...(m.subtitle ? [{ text: m.subtitle, fontSize: 24, alignment: 'center', color, margin: [0, 12, 0, 0] } as Content] : []),
            ],
        }),
    );
    const contact = [m.gallery.email, m.gallery.phone].filter(Boolean).join('     ');
    out.push(
        block(60, PAGE_H - 84, PAGE_W - 120, {
            text: [{ text: m.gallery.name, font: 'Germania', fontSize: 24 }, contact ? { text: `      ${contact}`, fontSize: 16 } : ''],
            alignment: 'center',
            color,
        }),
    );
    return out;
}

/** Narrowest the caption column beside a portrait work may get. */
const CAPTION_COL_MIN = 250;
/** Text keeps this distance from the page edge; images don't. */
const TEXT_INSET = 36;
const CAPTION_SIZE = 12;
/** Tight caption leading. */
const CAPTION_LEADING = 1.05;
const CAPTION_GAP = 14;

function landscapeCaption(w: RoomPdfWork) {
    const rest = details(w);
    const text = [...(titleLine(w) as unknown[]), rest.length ? `. ${rest.join('. ')}` : ''] as ContentText['text'];
    const plain = `${w.artistName}, ${w.title}, ${w.dateText ?? ''}. ${rest.join('. ')}`;
    return { text, height: estimateLines(plain, PAGE_W - 2 * TEXT_INSET, CAPTION_SIZE) * CAPTION_SIZE * 1.25 };
}

/**
 * Where a work's image goes on its page (points), from the image's pixel size: what the layout
 * draws, and what images are sized for. No margins: landscape works run across the full width
 * from the top edge, leaving a strip for the caption; others run the full height from the left
 * edge, leaving a column for the caption.
 */
export function workImagePlacement(w: RoomPdfWork, width: number, height: number) {
    if (width / height >= LANDSCAPE_RATIO) {
        const strip = landscapeCaption(w).height + 2 * CAPTION_GAP + 8;
        return { landscape: true, ...fit(width, height, { x: 0, y: 0, w: PAGE_W, h: PAGE_H - strip }, { x: 'center', y: 'start' }) };
    }
    return { landscape: false, ...fit(width, height, { x: 0, y: 0, w: PAGE_W - CAPTION_COL_MIN, h: PAGE_H }, { x: 'start', y: 'center' }) };
}

/** Print resolution images are prepared for. */
export const IMAGE_DPI = 250;
/** Pixel size for drawing at `pt` points wide/high at `IMAGE_DPI`. */
export const pixelsFor = (pt: number) => Math.ceil((pt / 72) * IMAGE_DPI);

/** Portrait and square works: image from the left edge, gallery name top right, caption bottom right. */
function portraitPage(m: RoomPdfModel, w: RoomPdfWork, img: { data: Buffer; width: number; height: number } | undefined): Content[] {
    const out: Content[] = [];
    // Without an image the caption column takes the right part of the page as usual.
    let colX = PAGE_W - CAPTION_COL_MIN + 24;
    if (img) {
        const p = workImagePlacement(w, img.width, img.height);
        out.push({ image: dataUrl(img.data), width: p.width, height: p.height, absolutePosition: { x: p.x, y: p.y } });
        colX = p.x + p.width + 28;
    }
    const colW = PAGE_W - TEXT_INSET - colX;
    out.push(block(colX, TEXT_INSET + 8, colW, { text: m.gallery.name, font: 'Germania', fontSize: 24, alignment: 'right' }));
    // Bottom-aligned to the inset, however many lines the caption wraps to.
    const bottom = PAGE_H - TEXT_INSET - 8;
    out.push(
        vbox({ x: colX, y: bottom - 200, w: colW, h: 200 }, 'bottom', {
            stack: [{ text: titleLine(w) }, ...details(w).map((t) => ({ text: t }))],
            fontSize: CAPTION_SIZE,
            lineHeight: CAPTION_LEADING,
            alignment: 'right',
        }),
    );
    return out;
}

/** Landscape works: the image across the page from the top edge, the caption centered beneath. */
function landscapePage(w: RoomPdfWork, img: { data: Buffer; width: number; height: number }): Content[] {
    const p = workImagePlacement(w, img.width, img.height);
    const caption = landscapeCaption(w);
    // Centered in the space below the image.
    const y = p.y + p.height + Math.max(CAPTION_GAP, (PAGE_H - p.y - p.height - caption.height) / 2);
    return [
        { image: dataUrl(img.data), width: p.width, height: p.height, absolutePosition: { x: p.x, y: p.y } },
        block(TEXT_INSET, y, PAGE_W - 2 * TEXT_INSET, { text: caption.text, fontSize: CAPTION_SIZE, lineHeight: CAPTION_LEADING, alignment: 'center' }),
    ];
}

function workPage(m: RoomPdfModel, w: RoomPdfWork, images: RoomPdfImages): Content[] {
    const img = w.image ? images.get(w.image) : undefined;
    if (img && workImagePlacement(w, img.width, img.height).landscape) return landscapePage(w, img);
    return portraitPage(m, w, img);
}

function bioPage(m: RoomPdfModel, bio: RoomPdfModel['bios'][number], images: RoomPdfImages): Content[] {
    const photo = bio.background ? images.get(pageKey(bio.background)) : undefined;
    const fill = !photo && bio.color ? bio.color : null;
    const color = photo || (fill && isDark(fill)) ? WHITE : BLACK;
    const chars = bio.paragraphs.reduce((n, p) => n + p.length, 0);
    const size = bioSize(chars);
    const out: Content[] = [];
    if (photo) out.push(fullBleed(photo.data), scrim(0.45));
    else if (fill) out.push({ canvas: [{ type: 'rect', x: 0, y: 0, w: PAGE_W, h: PAGE_H, color: fill }], absolutePosition: { x: 0, y: 0 } });
    const width = 470;
    // Centered on the page by measured height (the inset keeps long bios off the edges).
    out.push(
        vbox({ x: (PAGE_W - width) / 2, y: TEXT_INSET, w: width, h: PAGE_H - 2 * TEXT_INSET }, 'middle', {
            stack: [{ text: bio.name, fontSize: size + 4, margin: [0, 0, 0, size * 0.6] }, ...bio.paragraphs.map((p) => ({ text: p, margin: [0, 0, 0, size * 0.5] }) as Content)],
            fontSize: size,
            lineHeight: 1.2,
            color,
        }),
    );
    return out;
}

function backPage(m: RoomPdfModel): Content[] {
    const contact = [m.gallery.email, m.gallery.phone].filter(Boolean).join(' | ');
    return [
        block(60, PAGE_H / 2 - 70, PAGE_W - 120, {
            stack: [{ text: m.gallery.name, font: 'Germania', fontSize: 72, alignment: 'center' }, ...(contact ? [{ text: contact, fontSize: 18, alignment: 'center', margin: [0, 6, 0, 0] } as Content] : [])],
        }),
    ];
}

export function roomPdfDocument(m: RoomPdfModel, images: RoomPdfImages): TDocumentDefinitions {
    const pages: Content[][] = [coverPage(m, images), ...m.works.map((w) => workPage(m, w, images)), ...m.bios.map((b) => bioPage(m, b, images)), backPage(m)];
    const content: Content[] = [];
    pages.forEach((page, i) => {
        // Each page holds only absolutely positioned content; an empty flow item opens it.
        content.push({ text: '', pageBreak: i ? 'before' : undefined }, ...page);
    });
    const title = [m.heading, m.subtitle].filter(Boolean).join(' — ');
    return {
        info: { title, author: m.gallery.name, creator: m.gallery.name },
        pageSize: { width: PAGE_W, height: PAGE_H },
        pageMargins: [0, 0, 0, 0],
        defaultStyle: { font: 'Gentium', fontSize: 14, color: BLACK },
        content,
    };
}

export async function renderRoomPdf(m: RoomPdfModel, images: RoomPdfImages): Promise<Buffer> {
    useGalleryFonts();
    return pdfmake.createPdf(roomPdfDocument(m, images)).getBuffer();
}
