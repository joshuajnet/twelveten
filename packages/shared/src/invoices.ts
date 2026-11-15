/** Invoices for collectors' purchases. Admin-only, never part of public payloads. */
import { z } from 'zod';
import { schemas } from './content.ts';

const { isoDate, isoTimestamp, uuid } = schemas;
const text = z.string().trim();

/** Default number of invoices per page. */
export const INVOICES_PAGE_SIZE = 25;

export const INVOICE_STATUSES = {
    open: 'Open',
    partial: 'Partial payment',
    paid: 'Paid',
    /** The buyer declined to pay. Set by hand; its works leave their collection and go back on sale. */
    cancelled: 'Cancelled',
} as const;
export const invoiceStatus = z.enum(Object.keys(INVOICE_STATUSES) as [keyof typeof INVOICE_STATUSES, ...(keyof typeof INVOICE_STATUSES)[]]);
export type InvoiceStatus = z.infer<typeof invoiceStatus>;

export interface InvoiceItem {
    id: string;
    /** The inventory work, while it exists. */
    workId: string | null;
    position: number;
    artistName: string;
    title: string;
    dateText: string | null;
    medium: string | null;
    dimensions: string | null;
    imageUrl: string | null;
    priceCents: number;
}

export interface InvoicePayment {
    id: string;
    amountCents: number;
    paidOn: string;
    method: string | null;
    note: string | null;
    userName: string | null;
    createdAt: string;
}

/** List row. */
export interface InvoiceSummary {
    id: string;
    number: string;
    personId: string;
    personName: string;
    issuedOn: string;
    status: InvoiceStatus;
    currency: string;
    totalCents: number;
    paidCents: number;
    balanceCents: number;
    /** "Blue", "Red, Green". */
    titles: string;
    updatedAt: string;
}

export interface Invoice extends InvoiceSummary {
    billTo: string;
    discountBps: number;
    taxRateBps: number;
    shippingCents: number;
    subtotalCents: number;
    discountCents: number;
    taxCents: number;
    terms: string;
    notes: string | null;
    items: InvoiceItem[];
    payments: InvoicePayment[];
    createdAt: string;
}

/** Invoice settings as stored; `InvoiceSettings` adds the env payment details. */
export interface InvoiceSettingsBase {
    galleryName: string;
    /** One line per line. */
    address: string;
    email: string;
    phone: string;
    defaultTerms: string;
    defaultTaxRateBps: number;
    numberPrefix: string;
    updatedAt: string;
}

export interface InvoiceSettings extends InvoiceSettingsBase {
    /** How to pay, from server env (INVOICE_*); read-only here. The account number is masked. */
    payment: InvoicePaymentDetails;
}

export interface InvoicePaymentDetails {
    zelle: string | null;
    wireRouting: string | null;
    wireAccount: string | null;
    checksPayableTo: string | null;
}

const bps = z.number().int().min(0).max(10000);
const cents = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const currency = text.transform((v) => v.toUpperCase()).pipe(z.string().regex(/^[A-Z]{3}$/, 'Three-letter currency code'));

export const invoiceCreateSchema = z.object({
    personId: uuid,
    workIds: z.array(uuid).min(1, 'Choose at least one work').max(50),
    issuedOn: isoDate.optional(),
    discountBps: bps.optional(),
    taxRateBps: bps.optional(),
    shippingCents: cents.optional(),
});
export type InvoiceCreate = z.input<typeof invoiceCreateSchema>;

export const invoicePatchSchema = z.object({
    updatedAt: isoTimestamp,
    number: text.min(1).max(40).optional(),
    issuedOn: isoDate.optional(),
    status: invoiceStatus.optional(),
    currency: currency.optional(),
    billTo: text.max(2000).optional(),
    discountBps: bps.optional(),
    taxRateBps: bps.optional(),
    shippingCents: cents.optional(),
    terms: text.max(4000).optional(),
    notes: text.nullable().optional(),
});
export type InvoicePatch = z.input<typeof invoicePatchSchema>;

export const invoiceItemAddSchema = z.object({ workId: uuid });
export const invoiceItemPatchSchema = z.object({
    priceCents: cents.optional(),
    artistName: text.optional(),
    title: text.optional(),
    dateText: text.nullable().optional(),
    medium: text.nullable().optional(),
    dimensions: text.nullable().optional(),
});
export type InvoiceItemPatch = z.input<typeof invoiceItemPatchSchema>;

export const invoicePaymentCreateSchema = z.object({
    amountCents: z.number().int().min(1, 'Enter an amount').max(Number.MAX_SAFE_INTEGER),
    paidOn: isoDate,
    method: text.nullable().optional(),
    note: text.nullable().optional(),
});
export type InvoicePaymentCreate = z.input<typeof invoicePaymentCreateSchema>;

export const invoiceSettingsPutSchema = z.object({
    updatedAt: isoTimestamp,
    galleryName: text.min(1),
    address: text.max(1000),
    email: text.max(200),
    phone: text.max(100),
    defaultTerms: text.max(4000),
    defaultTaxRateBps: bps,
    numberPrefix: text.max(20),
});
export type InvoiceSettingsPut = z.input<typeof invoiceSettingsPutSchema>;

/** Round to the nearest integer, halves to even (so $226.525 → $226.52, as on paper invoices). */
export function roundHalfEven(x: number): number {
    const r = Math.round(x);
    return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

export interface InvoiceTotals {
    subtotalCents: number;
    discountCents: number;
    taxCents: number;
    totalCents: number;
}

/** Subtotal − discount, tax on the discounted amount, then shipping. */
export function invoiceTotals(prices: number[], discountBps: number, taxRateBps: number, shippingCents: number): InvoiceTotals {
    const subtotalCents = prices.reduce((a, b) => a + b, 0);
    const discountCents = roundHalfEven((subtotalCents * discountBps) / 10000);
    const taxCents = roundHalfEven(((subtotalCents - discountCents) * taxRateBps) / 10000);
    return { subtotalCents, discountCents, taxCents, totalCents: subtotalCents - discountCents + taxCents + shippingCents };
}

/** Still expecting payment. */
export const isUnpaid = (s: InvoiceStatus) => s === 'open' || s === 'partial';

/** What payments say the status is. */
export function statusFromPayments(paidCents: number, totalCents: number): 'open' | 'partial' | 'paid' {
    if (paidCents <= 0) return 'open';
    return paidCents >= totalCents ? 'paid' : 'partial';
}

/** 1025 → '10.25%'. */
export function formatPercent(basisPoints: number): string {
    return `${Number((basisPoints / 100).toFixed(2))}%`;
}

/** '10.25' or '10.25%' → 1025; '' → 0; NaN when unparseable or over 100%. */
export function parsePercent(input: string): number {
    const cleaned = input.replace(/[%\s]/g, '');
    if (!cleaned) return 0;
    if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return Number.NaN;
    const v = Math.round(Number(cleaned) * 100);
    return v > 10000 ? Number.NaN : v;
}
