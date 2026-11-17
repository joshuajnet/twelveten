import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import type { Content } from 'pdfmake/interfaces';
import { isDark, PAGE_H, PAGE_W, pageKey, renderRoomPdf, roomPdfDocument, workImagePlacement, type RoomPdfImages, type RoomPdfModel, type RoomPdfWork } from './roomPdf.ts';
import { roomPdfFilename, roomPdfHash } from './pdfExport.ts';

const work = (o: Partial<RoomPdfWork> = {}): RoomPdfWork => ({
    artistName: 'Noelle Africh',
    title: 'Privacy',
    dateText: '2026',
    medium: 'Distemper on linen over panel',
    dimensions: '12x9 in. (22.86x20.48 cm)',
    edition: null,
    price: '$2,400.00',
    statusLabel: null,
    image: '/media/p.jpg',
    ...o,
});

const model = (o: Partial<RoomPdfModel> = {}): RoomPdfModel => ({
    heading: 'Noelle Africh',
    subtitle: 'NADA Miami 2026',
    gallery: { name: 'Twelve Ten', email: 'gallery@example.com', phone: '+1 555-555-0100' },
    cover: '/media/p.jpg',
    coverCrop: null,
    works: [work()],
    bios: [{ name: 'Noelle Africh', paragraphs: ['Lives and works in Chicago.'], background: null, crop: null, color: null }],
    ...o,
});

const img = (width: number, height: number) => ({ data: Buffer.from([0xff, 0xd8]), width, height });

/** All text in the document, flattened. */
function texts(c: unknown): string[] {
    if (typeof c === 'string') return [c];
    if (Array.isArray(c)) return c.flatMap(texts);
    if (c && typeof c === 'object') {
        const o = c as Record<string, unknown>;
        const table = (o.table as { body?: unknown } | undefined)?.body;
        return [o.text, o.stack, o.columns, o.content, table].flatMap((v) => (v === undefined ? [] : texts(v)));
    }
    return [];
}

/** Content split into pages at page breaks. */
function pages(content: Content[]): Content[][] {
    const out: Content[][] = [];
    for (const c of content) {
        if ((c as { pageBreak?: string }).pageBreak === 'before' || !out.length) out.push([]);
        out[out.length - 1]!.push(c);
    }
    return out;
}

describe('room PDF document', () => {
    it('has a cover, a page per work, bios and a back page', () => {
        const doc = roomPdfDocument(model({ works: [work(), work({ title: 'Castaway' })] }), new Map());
        const ps = pages(doc.content as Content[]);
        expect(ps).toHaveLength(5);
        expect(texts(ps[0]).join('')).toContain('Noelle Africh');
        expect(texts(ps[0]).join('')).toContain('NADA Miami 2026');
        expect(texts(ps[2]).join('')).toContain('Castaway');
        expect(texts(ps[3]).join('')).toContain('Lives and works in Chicago.');
        expect(texts(ps[4]).join('')).toContain('gallery@example.com | +1 555-555-0100');
        expect(doc.info?.title).toBe('Noelle Africh — NADA Miami 2026');
    });

    it('leaves the subtitle off when there is none', () => {
        const doc = roomPdfDocument(model({ subtitle: null }), new Map());
        expect(texts(pages(doc.content as Content[])[0]).join('|')).not.toContain('NADA');
        expect(doc.info?.title).toBe('Noelle Africh');
    });

    it('picks the layout from the image shape', () => {
        const portrait = roomPdfDocument(model({ bios: [] }), new Map([['/media/p.jpg', img(900, 1200)]]));
        const landscape = roomPdfDocument(model({ bios: [] }), new Map([['/media/p.jpg', img(1600, 1000)]]));
        // The portrait layout repeats the gallery name beside the image; the landscape one has a single caption line.
        expect(texts(pages(portrait.content as Content[])[1])).toContain('Twelve Ten');
        expect(texts(pages(landscape.content as Content[])[1])).not.toContain('Twelve Ten');
        expect(texts(pages(landscape.content as Content[])[1]).join('')).toBe('Noelle Africh, Privacy, 2026. Distemper on linen over panel. 12x9 in. (22.86x20.48 cm). $2,400.00');
    });

    it('shows the status instead of a price for unavailable works', () => {
        const doc = roomPdfDocument(model({ works: [work({ price: null, statusLabel: 'Sold' })] }), new Map());
        const page = texts(pages(doc.content as Content[])[1]);
        expect(page).toContain('Sold');
        expect(page.join('')).not.toContain('$');
    });

    it('puts a bio on its own full-bleed background when one is set', async () => {
        const photo = await sharp({ create: { width: 40, height: 28, channels: 3, background: '#888' } }).jpeg().toBuffer();
        const images: RoomPdfImages = new Map([[pageKey('/media/bio.jpg'), { data: photo, width: 40, height: 28 }]]);
        const bioPage = (background: string | null, color: string | null = null) =>
            pages(roomPdfDocument(model({ bios: [{ name: 'N', paragraphs: ['Bio.'], background, crop: null, color }] }), images).content as Content[])[2]!;
        const withPhoto = bioPage('/media/bio.jpg');
        expect(withPhoto.find((c) => 'image' in (c as object))).toMatchObject({ width: PAGE_W, height: PAGE_H, absolutePosition: { x: 0, y: 0 } });
        expect(JSON.stringify(withPhoto)).toContain('#ffffff');
        expect(bioPage(null).some((c) => 'image' in (c as object))).toBe(false);

        // A solid colour fills the page; the type turns white on dark colours, stays black on light ones.
        const fillOf = (page: Content[]) => (page.find((c) => 'canvas' in (c as object)) as { canvas: { color: string; w: number; h: number }[] } | undefined)?.canvas[0];
        expect(fillOf(bioPage(null, '#1a2b3c'))).toMatchObject({ color: '#1a2b3c', w: PAGE_W, h: PAGE_H });
        expect(JSON.stringify(bioPage(null, '#1a2b3c'))).toContain('"color":"#ffffff"');
        expect(JSON.stringify(bioPage(null, '#f4e9d0'))).toContain('"color":"#000000"');
        // A photo wins over a colour.
        expect(fillOf(bioPage('/media/bio.jpg', '#1a2b3c'))?.color).toBe('#000000');
        expect(isDark('#000000')).toBe(true);
        expect(isDark('#ffffff')).toBe(false);
    });

    it('runs work images to the page edges, never cropping them', () => {
        // Portrait: full height from the left edge.
        const portrait = workImagePlacement(work(), 900, 1200);
        expect(portrait).toMatchObject({ landscape: false, x: 0, y: 0 });
        expect(portrait.height).toBeCloseTo(PAGE_H);
        expect(portrait.width / portrait.height).toBeCloseTo(900 / 1200);
        // Square-ish works fill the width left of the caption column instead, centered vertically.
        const square = workImagePlacement(work(), 1100, 1000);
        expect(square.x).toBe(0);
        expect(square.width).toBeCloseTo(PAGE_W - 250);
        // Landscape: full width from the top edge, a caption strip below.
        const wide = workImagePlacement(work(), 2000, 1000);
        expect(wide).toMatchObject({ landscape: true, x: 0, y: 0 });
        expect(wide.width).toBeCloseTo(PAGE_W);
        expect(wide.height).toBeCloseTo(PAGE_W / 2);
        // Less wide: as tall as the caption strip allows, centered across.
        const tallish = workImagePlacement(work(), 1300, 1000);
        expect(tallish.y).toBe(0);
        expect(tallish.height).toBeGreaterThan(PAGE_H - 60);
        expect(tallish.x).toBeCloseTo((PAGE_W - tallish.width) / 2);
    });

    it('renders a PDF with real images', async () => {
        const jpeg = async (w: number, h: number) => ({ data: await sharp({ create: { width: w, height: h, channels: 3, background: '#556' } }).jpeg().toBuffer(), width: w, height: h });
        const images: RoomPdfImages = new Map([
            ['/media/p.jpg', await jpeg(90, 120)],
            ['/media/l.jpg', await jpeg(160, 100)],
            [pageKey('/media/p.jpg'), await jpeg(168, 119)],
        ]);
        const pdf = await renderRoomPdf(model({ works: [work(), work({ image: '/media/l.jpg' }), work({ image: null })] }), images);
        expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
        expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(6);
    });
});

describe('room PDF export helpers', () => {
    it('names the file after the heading and subtitle', () => {
        expect(roomPdfFilename(model())).toBe('noelle-africh-nada-miami-2026.pdf');
        expect(roomPdfFilename(model({ subtitle: null }))).toBe('noelle-africh.pdf');
    });

    it('changes the cache key when what the PDF shows changes', () => {
        expect(roomPdfHash(model())).toBe(roomPdfHash(model()));
        expect(roomPdfHash(model({ works: [work({ price: null })] }))).not.toBe(roomPdfHash(model()));
    });
});
