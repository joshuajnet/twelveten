import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { pdfmake, useGalleryFonts } from '../lib/pdf.ts';
import type { PdfImage } from '../lib/pdfImages.ts';

/**
 * Shipping labels: US Letter portrait, one page per work. Gallery name, return address (FROM),
 * a boxed ship-to address, the work's picture and its caption. Never the price.
 */

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 54;
const CONTENT_W = PAGE_W - 2 * MARGIN;
/** The box work images are fitted into (points). */
/** Space between the ship-to box and the image. */
const GAP = 28;
export const LABEL_IMAGE_BOX = { width: CONTENT_W, height: 320 };

export interface LabelWork {
    artistName: string;
    title: string;
    dateText: string | null;
    medium: string | null;
    dimensions: string | null;
    inventoryNumber: string | null;
    /** Primary image URL (the key into the image map). */
    imageUrl: string | null;
}

export interface LabelAddresses {
    galleryName: string;
    /** Return address lines (FROM). */
    returnAddress: string[];
    /** Ship-to lines. */
    destination: string[];
}

/** Prepared JPEGs keyed by image URL. */
export type LabelImages = Map<string, PdfImage>;

export const addressLines = (s: string) =>
    s
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

const dataUrl = (b: Buffer) => `data:image/jpeg;base64,${b.toString('base64')}`;
const smallCaps = (text: string): Content => ({ text, fontSize: 8.5, bold: true, characterSpacing: 1.2, color: '#555555', margin: [0, 0, 0, 4] });

/**
 * Points left for the image once everything else on the page is laid out, estimated generously
 * from the line counts (Gentium's lines are about 1.7× the font size), so a page never spills over.
 */
function imageRoom(w: LabelWork, a: LabelAddresses): number {
    const line = (size: number, lineHeight = 1) => size * 1.7 * lineHeight;
    const smallCapsH = line(8.5) + 4;
    const header = Math.max(smallCapsH + a.returnAddress.length * line(10.5), 40);
    const shipTo = 20 + 3 + 10 + 12 + smallCapsH + a.destination.length * line(16);
    const gap = GAP;
    const caption = 12 + 2 * line(13, 1.05) + [w.medium, w.dimensions].filter(Boolean).length * line(11, 1.05);
    const footer = 8 + line(9.5);
    return Math.max(120, PAGE_H - 2 * MARGIN - header - shipTo - gap - caption - footer - 12);
}

function labelPage(w: LabelWork, a: LabelAddresses, images: LabelImages, n: number, total: number): Content[] {
    const img = w.imageUrl ? images.get(w.imageUrl) : undefined;
    // Drawn at the prepared image's proportions, as large as the box and the room the text leaves allow.
    const maxH = Math.min(LABEL_IMAGE_BOX.height, imageRoom(w, a));
    const scale = img ? Math.min(LABEL_IMAGE_BOX.width / img.width, maxH / img.height) : 0;
    const caption = [w.dateText ? [{ text: w.title || 'Untitled', italics: true }, `, ${w.dateText}`] : { text: w.title || 'Untitled', italics: true }];
    return [
        {
            columns: [
                { width: '*', stack: [smallCaps('FROM'), ...a.returnAddress.map((l) => ({ text: l, fontSize: 10.5 }))], lineHeight: 1 },
                { width: 'auto', text: a.galleryName, font: 'Germania', fontSize: 24, alignment: 'right' },
            ],
            columnGap: 20,
        },
        {
            margin: [0, 20, 0, 0],
            table: {
                widths: ['*'],
                body: [[{ stack: [smallCaps('SHIP TO'), ...a.destination.map((l) => ({ text: l, fontSize: 16 }))], lineHeight: 1, margin: [14, 10, 14, 12] }]],
            },
            layout: { hLineWidth: () => 1.5, vLineWidth: () => 1.5, hLineColor: () => '#000000', vLineColor: () => '#000000' },
        },
        img
            ? { image: dataUrl(img.data), width: img.width * scale, height: img.height * scale, alignment: 'center', margin: [0, GAP, 0, 0] }
            : { text: '', margin: [0, 0, 0, 0] },
        {
            margin: [0, img ? 12 : GAP, 0, 0],
            stack: [
                { text: w.artistName, fontSize: 13 },
                { text: caption.flat(), fontSize: 13 },
                ...[w.medium, w.dimensions].filter(Boolean).map((t) => ({ text: t!, fontSize: 11 })),
            ],
            lineHeight: 1.05,
        },
        {
            columns: [
                { width: '*', text: w.inventoryNumber ? `Inv. no. ${w.inventoryNumber}` : '' },
                { width: 'auto', text: total > 1 ? `${n} of ${total}` : '' },
            ],
            fontSize: 9.5,
            color: '#555555',
            margin: [0, 8, 0, 0],
        },
    ];
}

export function labelDocument(works: LabelWork[], a: LabelAddresses, images: LabelImages = new Map()): TDocumentDefinitions {
    return {
        info: { title: works.length === 1 ? `Shipping label – ${works[0]!.title || 'Untitled'}` : 'Shipping labels', author: a.galleryName, creator: a.galleryName },
        pageSize: 'LETTER',
        pageMargins: [MARGIN, MARGIN, MARGIN, MARGIN],
        defaultStyle: { font: 'Gentium', fontSize: 11, lineHeight: 1.15 },
        content: works.map((w, i) => ({ stack: labelPage(w, a, images, i + 1, works.length), ...(i ? { pageBreak: 'before' as const } : {}) })),
    };
}

export async function renderLabelPdf(works: LabelWork[], a: LabelAddresses, images?: LabelImages): Promise<Buffer> {
    useGalleryFonts();
    return pdfmake.createPdf(labelDocument(works, a, images)).getBuffer();
}
