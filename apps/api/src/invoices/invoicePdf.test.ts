import { describe, expect, it } from 'vitest';
import type { Invoice } from '@twelveten/shared';
import { imageDataUrl, invoiceDocument, longDate, renderInvoicePdf } from './invoicePdf.ts';

const invoice: Invoice = {
    id: 'i',
    number: 'INV-2026-006',
    personId: 'p',
    personName: 'Avery Sample',
    issuedOn: '2026-05-29',
    status: 'paid',
    currency: 'USD',
    totalCents: 216000,
    paidCents: 216000,
    balanceCents: 0,
    titles: 'Example Work',
    updatedAt: '',
    billTo: 'Avery Sample\n100 Example Street\navery@example.com',
    discountBps: 1000,
    taxRateBps: 0,
    shippingCents: 0,
    subtotalCents: 240000,
    discountCents: 24000,
    taxCents: 0,
    terms: 'Payment must be remitted within 90 days of receipt.',
    notes: 'private',
    createdAt: '',
    items: [{ id: 'a', workId: 'w', position: 0, artistName: 'Noelle Africh', title: 'Example Work', dateText: '2025', medium: 'Distemper', dimensions: '15 x 15 in.', imageUrl: null, priceCents: 240000 }],
    payments: [{ id: 'x', amountCents: 216000, paidOn: '2026-08-11', method: null, note: null, userName: null, createdAt: '' }],
};
const settings = { galleryName: 'Twelve Ten', address: '1104 W Thorndale Ave\nChicago, IL 60660', email: 'mail@example.com', phone: '', defaultTerms: '', defaultTaxRateBps: 1025, numberPrefix: 'INV-', updatedAt: '' };
const payment = { zelle: '555-0100', wireRouting: null, wireAccount: '000111', checksPayableTo: 'Twelve Ten LLC' };

describe('invoice PDF', () => {
    it('formats dates like the paper invoices', () => {
        expect(['2026-05-18', '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-11', '2026-05-22'].map(longDate)).toEqual([
            'May 18th, 2026',
            'May 1st, 2026',
            'May 2nd, 2026',
            'May 3rd, 2026',
            'May 11th, 2026',
            'May 22nd, 2026',
        ]);
    });

    it('prints the To block, items, discount, payments and payment details, but not private notes', () => {
        const text = JSON.stringify(invoiceDocument(invoice, settings, payment).content);
        for (const s of ['May 29th, 2026', 'Avery Sample', '100 Example Street', 'Example Work', '$2,400.00', 'Discount (10%)', '-$240.00', 'Paid (8/11/2026)', 'Balance due', '$0.00', '555-0100', '000111', 'Twelve Ten LLC', '90 days']) {
            expect(text).toContain(s);
        }
        expect(text).not.toContain('private');
        // Unset payment lines are left off.
        expect(text).not.toContain('Routing');
    });

    it('accepts only JPEG and PNG images', () => {
        expect(imageDataUrl(Buffer.from([0xff, 0xd8, 0xff]))).toMatch(/^data:image\/jpeg;base64,/);
        expect(imageDataUrl(Buffer.from('RIFF0000WEBP'))).toBeNull();
    });

    it('renders with the gallery fonts', async () => {
        const pdf = await renderInvoicePdf(invoice, settings, payment);
        expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
        expect(pdf.toString('latin1')).toMatch(/GermaniaOne/);
    });
});
