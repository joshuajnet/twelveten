import { sql } from 'kysely';
import type { Invoice, InvoiceSettingsBase, InvoiceStatus, InvoiceSummary, NumberedPage } from '@twelveten/shared';
import type { DB } from '../db/index.ts';
import { likePattern, numberedPage } from '../lib/paging.ts';
import type { InvoiceSettingsRow } from '../db/types.ts';

type Q = Pick<DB, 'selectFrom'>;

/** Invoices with the buyer's name, the amount paid so far and the invoiced titles. */
function summaryQuery(db: Q) {
    return db
        .selectFrom('invoices as i')
        .innerJoin('persons as p', 'p.id', 'i.person_id')
        .select([
            'i.id',
            'i.number',
            'i.person_id',
            'p.name as person_name',
            'i.issued_on',
            'i.status',
            'i.currency',
            'i.total_cents',
            'i.updated_at',
            (eb) => eb.selectFrom('invoice_payments as pay').select(sql<number>`coalesce(sum(pay.amount_cents), 0)`.as('n')).whereRef('pay.invoice_id', '=', 'i.id').as('paid_cents'),
            (eb) =>
                eb
                    .selectFrom('invoice_items as it')
                    .select(sql<string>`string_agg(nullif(it.title, ''), ', ' ORDER BY it.position)`.as('t'))
                    .whereRef('it.invoice_id', '=', 'i.id')
                    .as('titles'),
        ]);
}

interface SummaryRow {
    id: string;
    number: string;
    person_id: string;
    person_name: string;
    issued_on: string;
    status: InvoiceStatus;
    currency: string;
    total_cents: number;
    updated_at: string;
    paid_cents: number | null;
    titles: string | null;
}

function toSummary(r: SummaryRow): InvoiceSummary {
    const total = Number(r.total_cents);
    const paid = Number(r.paid_cents ?? 0);
    return {
        id: r.id,
        number: r.number,
        personId: r.person_id,
        personName: r.person_name,
        issuedOn: r.issued_on,
        status: r.status,
        currency: r.currency,
        totalCents: total,
        paidCents: paid,
        balanceCents: Math.max(0, total - paid),
        titles: r.titles ?? '',
        updatedAt: r.updated_at,
    };
}

export interface InvoiceFilters {
    status?: InvoiceStatus;
    personId?: string;
    q?: string;
}

/** Newest first, one numbered page at a time. */
export async function listInvoices(db: Q, f: InvoiceFilters, page: number, pageSize: number): Promise<NumberedPage<InvoiceSummary>> {
    let q = summaryQuery(db).orderBy('i.issued_on', 'desc').orderBy('i.created_at', 'desc').orderBy('i.id', 'desc');
    if (f.status) q = q.where('i.status', '=', f.status);
    if (f.personId) q = q.where('i.person_id', '=', f.personId);
    if (f.q) {
        const like = likePattern(f.q);
        q = q.where((eb) =>
            eb.or([
                eb('i.number', 'ilike', like),
                eb('p.name', 'ilike', like),
                eb.exists(eb.selectFrom('invoice_items as s').select('s.id').whereRef('s.invoice_id', '=', 'i.id').where((e) => e.or([e('s.title', 'ilike', like), e('s.artist_name', 'ilike', like)]))),
            ]),
        );
    }
    return numberedPage(q, page, pageSize, toSummary);
}

export async function invoicesForPerson(db: Q, personId: string): Promise<InvoiceSummary[]> {
    const rows = await summaryQuery(db).where('i.person_id', '=', personId).orderBy('i.issued_on', 'desc').orderBy('i.id', 'desc').execute();
    return rows.map(toSummary);
}

/** Invoices (other than `exceptId`) that list this work. */
export async function invoicesForWork(db: Q, workId: string, exceptId?: string): Promise<InvoiceSummary[]> {
    let q = summaryQuery(db).where((eb) => eb.exists(eb.selectFrom('invoice_items as w').select('w.id').whereRef('w.invoice_id', '=', 'i.id').where('w.work_id', '=', workId)));
    if (exceptId) q = q.where('i.id', '!=', exceptId);
    return (await q.orderBy('i.issued_on', 'desc').execute()).map(toSummary);
}

export async function getInvoice(db: Q, id: string): Promise<Invoice | null> {
    const summary = await summaryQuery(db).where('i.id', '=', id).executeTakeFirst();
    if (!summary) return null;
    const [row, items, payments] = await Promise.all([
        db.selectFrom('invoices').selectAll().where('id', '=', id).executeTakeFirstOrThrow(),
        db.selectFrom('invoice_items').selectAll().where('invoice_id', '=', id).orderBy('position').execute(),
        db
            .selectFrom('invoice_payments as pay')
            .leftJoin('user as u', 'u.id', 'pay.user_id')
            .select(['pay.id', 'pay.amount_cents', 'pay.paid_on', 'pay.method', 'pay.note', 'pay.created_at', 'u.name as user_name'])
            .where('pay.invoice_id', '=', id)
            .orderBy('pay.paid_on')
            .orderBy('pay.created_at')
            .execute(),
    ]);
    return {
        ...toSummary(summary),
        billTo: row.bill_to,
        discountBps: row.discount_bps,
        taxRateBps: row.tax_rate_bps,
        shippingCents: Number(row.shipping_cents),
        subtotalCents: Number(row.subtotal_cents),
        discountCents: Number(row.discount_cents),
        taxCents: Number(row.tax_cents),
        terms: row.terms,
        notes: row.notes,
        createdAt: row.created_at,
        items: items.map((it) => ({
            id: it.id,
            workId: it.work_id,
            position: it.position,
            artistName: it.artist_name,
            title: it.title,
            dateText: it.date_text,
            medium: it.medium,
            dimensions: it.dimensions,
            imageUrl: it.image_url,
            priceCents: Number(it.price_cents),
        })),
        payments: payments.map((p) => ({
            id: p.id,
            amountCents: Number(p.amount_cents),
            paidOn: p.paid_on,
            method: p.method,
            note: p.note,
            userName: p.user_name,
            createdAt: p.created_at,
        })),
    };
}

export function toSettings(r: InvoiceSettingsRow): InvoiceSettingsBase {
    return {
        galleryName: r.gallery_name,
        address: r.address,
        email: r.email,
        phone: r.phone,
        defaultTerms: r.default_terms,
        defaultTaxRateBps: r.default_tax_rate_bps,
        numberPrefix: r.number_prefix,
        updatedAt: r.updated_at,
    };
}

export async function getSettings(db: Q): Promise<InvoiceSettingsBase> {
    return toSettings(await db.selectFrom('invoice_settings').selectAll().executeTakeFirstOrThrow());
}
