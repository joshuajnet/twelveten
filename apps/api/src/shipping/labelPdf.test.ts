import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { addressLines, labelDocument, renderLabelPdf, type LabelWork } from './labelPdf.ts';

const works: LabelWork[] = [
    { artistName: 'Noelle Africh', title: 'Example Work', dateText: '2025', medium: 'Distemper', dimensions: '15 x 15 in.', inventoryNumber: 'NA-001', imageUrl: '/media/missing.jpg' },
    { artistName: 'Noelle Africh', title: '', dateText: null, medium: null, dimensions: null, inventoryNumber: null, imageUrl: null },
];
const addresses = { galleryName: 'Twelve Ten', returnAddress: ['Twelve Ten', '1210 W Example St'], destination: addressLines(' Avery Sample \n\n100 Example Street\n') };

describe('shipping label PDF', () => {
    it('lays out one page per work with both addresses and the caption, never a price', () => {
        const doc = labelDocument(works, addresses);
        const content = doc.content as { pageBreak?: string }[];
        expect(content).toHaveLength(2);
        expect(content.map((c) => c.pageBreak)).toEqual([undefined, 'before']);
        const json = JSON.stringify(doc);
        for (const s of ['FROM', 'SHIP TO', 'Twelve Ten', '1210 W Example St', 'Avery Sample', '100 Example Street', 'Example Work', ', 2025', 'Distemper', '15 x 15 in.', 'Inv. no. NA-001', 'Untitled', '1 of 2', '2 of 2']) {
            expect(json).toContain(s);
        }
        expect(json).not.toMatch(/\$|price/i);
        expect(addresses.destination).toEqual(['Avery Sample', '100 Example Street']);
    });

    it('fits each work on one page, with a large image and a long address', async () => {
        const data = await sharp({ create: { width: 1000, height: 1400, channels: 3, background: '#808080' } }).jpeg().toBuffer();
        const long = { ...addresses, returnAddress: ['A', 'B', 'C', 'D', 'E'], destination: ['Name', 'Company', 'Street', 'Suite 400', 'City, ST 00000', 'Country'] };
        const pdf = await renderLabelPdf([works[0]!, { ...works[0]!, imageUrl: '/media/missing.jpg' }], long, new Map([['/media/missing.jpg', { data, width: 1000, height: 1400 }]]));
        expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(2);
    });

    it('renders a PDF, without an image when it is missing', async () => {
        const pdf = await renderLabelPdf(works.slice(0, 1), addresses);
        expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    });
});
