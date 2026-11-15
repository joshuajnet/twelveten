import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { formatPercent, type Invoice, type InvoicePaymentDetails, type InvoiceSettingsBase } from '@twelveten/shared';
import { pdfmake, useGalleryFonts } from '../lib/pdf.ts';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** '2026-05-18' → 'May 18th, 2026'. */
export function longDate(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
    const suffix = d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th';
    return `${MONTHS[m - 1]} ${d}${suffix}, ${y}`;
}

/** '2026-05-29' → '5/29/2026'. */
const shortDate = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return `${m}/${d}/${y}`;
};

const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);

/** Image bytes (JPEG or PNG) for each item image URL; missing ones are left blank. */
export type ImageMap = Map<string, Buffer>;

export function imageDataUrl(buf: Buffer): string | null {
    if (buf[0] === 0xff && buf[1] === 0xd8) return `data:image/jpeg;base64,${buf.toString('base64')}`;
    if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return `data:image/png;base64,${buf.toString('base64')}`;
    return null;
}

export function invoiceDocument(inv: Invoice, settings: InvoiceSettingsBase, payment: InvoicePaymentDetails, images: ImageMap = new Map()): TDocumentDefinitions {
    // Always two decimals, as on paper invoices ($2,400.00).
    const fmt = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: inv.currency, minimumFractionDigits: 2 }).format(cents / 100);
    const [toName = '', ...toRest] = lines(inv.billTo);
    const galleryLines = [...lines(settings.address), settings.email, settings.phone].filter(Boolean);

    const header: Content = {
        columns: [
            {
                width: '*',
                stack: [
                    { text: 'INVOICE', bold: true, fontSize: 13, margin: [0, 6, 0, 8] },
                    { text: [{ text: 'Date: ', bold: true }, longDate(inv.issuedOn)], margin: [0, 0, 0, 4] },
                    { text: [{ text: 'To: ', bold: true }, toName] },
                    ...toRest.map((l) => ({ text: l, fontSize: 10.5 })),
                ],
            },
            {
                width: 'auto',
                alignment: 'right',
                stack: [
                    { text: settings.galleryName, font: 'Germania', fontSize: 24, margin: [0, 0, 0, 6] },
                    ...galleryLines.map((l) => ({ text: l, fontSize: 10, lineHeight: 1.35 })),
                ],
            },
        ],
    };

    const itemRows: Content[][] = inv.items.map((it) => {
        const data = it.imageUrl ? images.get(it.imageUrl) : undefined;
        const url = data ? imageDataUrl(data) : null;
        return [
            url ? { image: url, fit: [120, 78], alignment: 'center' } : { text: '' },
            {
                stack: [
                    { text: it.artistName, fontSize: 11.5 },
                    { text: it.title || 'Untitled', italics: true, fontSize: 11.5 },
                    ...[it.dateText, it.medium, it.dimensions].filter(Boolean).map((t) => ({ text: t!, fontSize: 10 })),
                ],
                lineHeight: 1.15,
                margin: [10, 0, 0, 0],
            },
            { text: fmt(it.priceCents), alignment: 'right', fontSize: 10 },
        ];
    });

    const totals: Content[] = [{ text: [{ text: 'Subtotal  ', bold: true }, fmt(inv.subtotalCents)], fontSize: 10 }];
    if (inv.discountCents) totals.push({ text: `Discount (${formatPercent(inv.discountBps)})  -${fmt(inv.discountCents)}`, fontSize: 10 });
    if (inv.taxCents) totals.push({ text: `Sales Tax  ${fmt(inv.taxCents)}`, fontSize: 10 });
    if (inv.shippingCents) totals.push({ text: `Shipping  ${fmt(inv.shippingCents)}`, fontSize: 10 });
    for (const p of inv.payments) totals.push({ text: `Paid (${shortDate(p.paidOn)})  -${fmt(p.amountCents)}`, fontSize: 10 });
    const owing = inv.payments.length ? inv.balanceCents : inv.totalCents;
    totals.push({ text: inv.payments.length ? 'Balance due' : 'Total', bold: true, fontSize: 14, margin: [0, 6, 0, 0] });
    totals.push({ text: fmt(owing), fontSize: 13 });

    const payLines: Content[] = [];
    if (payment.zelle) payLines.push({ text: [{ text: 'Zelle', bold: true, italics: true }, { text: ` at ${payment.zelle}`, italics: true }] });
    if (payment.wireRouting || payment.wireAccount) {
        const rows: TableCell[][] = [];
        if (payment.wireRouting) rows.push([{ text: 'Routing', bold: true }, { text: payment.wireRouting }]);
        if (payment.wireAccount) rows.push([{ text: 'Account', bold: true }, { text: payment.wireAccount }]);
        rows[0]!.unshift({ text: 'Wire transfer:', bold: true, italics: true, rowSpan: rows.length });
        for (const r of rows.slice(1)) r.unshift({ text: '' });
        // Centred as a block: the label beside the routing and account numbers.
        payLines.push({
            columns: [
                { width: '*', text: '' },
                {
                    width: 'auto',
                    table: { body: rows },
                    layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 4, paddingRight: () => 4, paddingTop: () => 1, paddingBottom: () => 1 },
                    alignment: 'left',
                },
                { width: '*', text: '' },
            ],
            margin: [0, 3, 0, 3],
        });
    }
    if (payment.checksPayableTo) payLines.push({ text: `Please make checks payable to ${payment.checksPayableTo}.`, italics: true });

    const footerText = [settings.galleryName, lines(settings.address).join(' '), settings.phone, settings.email].filter(Boolean);

    return {
        info: { title: `Invoice ${inv.number}`, author: settings.galleryName, creator: settings.galleryName },
        pageSize: 'LETTER',
        pageMargins: [72, 64, 72, 72],
        defaultStyle: { font: 'Gentium', fontSize: 11, lineHeight: 1.2 },
        content: [
            header,
            {
                margin: [0, 20, 0, 0],
                table: {
                    widths: [130, '*', 90],
                    body: [[{ text: '' }, { text: 'Item', bold: true, margin: [10, 0, 0, 10] }, { text: 'Price', bold: true, alignment: 'right' }], ...itemRows],
                },
                layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 2, paddingBottom: () => 8 },
            },
            { stack: totals, alignment: 'right', margin: [0, 10, 0, 0], unbreakable: true },
            {
                stack: [
                    { text: 'Thank you!', bold: true, margin: [0, 0, 0, 10] },
                    ...payLines,
                    ...(inv.terms ? [{ text: lines(inv.terms).join('\n'), italics: true, fontSize: 9, margin: [0, 10, 0, 0] } as Content] : []),
                ],
                alignment: 'center',
                fontSize: 10.5,
                lineHeight: 1.05,
                margin: [0, 18, 0, 0],
                unbreakable: true,
            },
        ],
        footer: () => ({
            text: [
                { text: footerText[0] ?? '', font: 'Germania', fontSize: 11 },
                { text: footerText.length > 1 ? ` | ${footerText.slice(1).join(' | ')}` : '', fontSize: 9.5 },
            ],
            alignment: 'center',
            margin: [40, 30, 40, 0],
        }),
    };
}

export async function renderInvoicePdf(inv: Invoice, settings: InvoiceSettingsBase, payment: InvoicePaymentDetails, images?: ImageMap): Promise<Buffer> {
    useGalleryFonts();
    return pdfmake.createPdf(invoiceDocument(inv, settings, payment, images)).getBuffer();
}
