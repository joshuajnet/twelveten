import { Hono } from 'hono';
import { sql, type Transaction } from 'kysely';
import {
    invoiceCreateSchema,
    invoiceItemAddSchema,
    invoiceItemPatchSchema,
    invoicePatchSchema,
    invoicePaymentCreateSchema,
    invoiceSettingsPutSchema,
    invoiceStatus,
    invoiceTotals,
    INVOICES_PAGE_SIZE,
    statusFromPayments,
    todayIso,
    type InvoiceStatus,
} from '@twelveten/shared';
import type { AppEnv } from '../../env.ts';
import type { DB } from '../../db/index.ts';
import type { Database, InvoiceRow, WorkRow } from '../../db/types.ts';
import { addressesFor } from '../../people/queries.ts';
import { getInvoice, getSettings, listInvoices, toSettings } from '../../invoices/queries.ts';
import { renderInvoicePdf, type ImageMap } from '../../invoices/invoicePdf.ts';
import { maskedPaymentDetails, paymentDetails } from '../../invoices/payment.ts';
import type { Storage } from '../../storage/uploads.ts';
import { readMedia } from '../../storage/mediaRead.ts';
import { body, HttpError } from './errors.ts';
import { recordWorkChanges } from './inventory.ts';
import { closeGap, columns, conflictOr404, ensureCollectorProfile, findOr404, idParam, isUuid, nextPosition, pageParams, pdfResponse, sameVersion } from './util.ts';

type Trx = Transaction<Database>;

/** The next free number like 'INV-2026-007' (per prefix and year). */
async function nextNumber(trx: Trx, prefix: string, issuedOn: string): Promise<string> {
    const stem = `${prefix}${issuedOn.slice(0, 4)}-`;
    await sql`SELECT pg_advisory_xact_lock(hashtext(${`invoice-number:${stem}`}))`.execute(trx);
    const rows = await trx.selectFrom('invoices').select('number').where('number', 'like', `${stem.replace(/[\\%_]/g, (m) => `\\${m}`)}%`).execute();
    const max = rows.reduce((m, r) => Math.max(m, Number(/^(\d+)$/.exec(r.number.slice(stem.length))?.[1] ?? 0)), 0);
    return `${stem}${String(max + 1).padStart(3, '0')}`;
}

/** "To:" block from the person: name, primary address, phone, email. */
async function billToFor(trx: Trx, personId: string): Promise<string> {
    const p = await trx.selectFrom('persons').select(['name', 'email', 'phone']).where('id', '=', personId).executeTakeFirstOrThrow();
    const [primary] = await addressesFor(trx, 'person', personId);
    const a = primary?.address;
    const cityLine = a ? [a.city, [a.region, a.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ') : '';
    return [p.name, a?.line1, a?.line2, cityLine, a && a.country !== 'US' ? a.country : null, p.phone, p.email].filter(Boolean).join('\n');
}

/** Can this work go on an invoice for this person? */
function assertInvoiceable(w: Pick<WorkRow, 'status' | 'buyer_id' | 'title'>, personId: string) {
    const label = w.title || 'Untitled';
    if (w.buyer_id && w.buyer_id !== personId) throw new HttpError(400, `“${label}” is held for or sold to someone else`);
    if (!['available', 'on_hold', 'sold'].includes(w.status)) throw new HttpError(400, `“${label}” isn’t for sale`);
    if (w.status === 'sold' && w.buyer_id !== personId) throw new HttpError(400, `“${label}” is already sold`);
}

/** The works on a paid invoice are sold: its items stay as they were paid for. */
function assertNotPaid(inv: { status: InvoiceStatus }) {
    if (inv.status === 'paid') throw new HttpError(409, 'This invoice is paid; reopen it (or remove a payment) before changing its works');
}

/** Put a work on hold for the invoiced person (when it isn't already theirs). */
async function holdFor(trx: Trx, workId: string, personId: string, number: string, userId: string | null) {
    const before = await trx.selectFrom('works').selectAll().where('id', '=', workId).forUpdate().executeTakeFirstOrThrow();
    if (before.status === 'sold' || (before.status === 'on_hold' && before.buyer_id === personId)) return;
    const after = await trx.updateTable('works').set({ status: 'on_hold', buyer_id: personId }).where('id', '=', workId).returningAll().executeTakeFirstOrThrow();
    await recordWorkChanges(trx, before, after, `Invoice ${number}`, userId);
}

async function appendItem(trx: Trx, invoiceId: string, workId: string) {
    const w = await trx
        .selectFrom('works as w')
        .innerJoin('persons as p', 'p.id', 'w.artist_id')
        .select(['w.title', 'w.date_text', 'w.medium', 'w.dimensions', 'w.price_cents', 'p.name as artist_name'])
        .select((eb) => eb.selectFrom('work_images as i').select('i.url').whereRef('i.work_id', '=', 'w.id').orderBy('i.position').limit(1).as('image_url'))
        .where('w.id', '=', workId)
        .executeTakeFirstOrThrow();
    await trx
        .insertInto('invoice_items')
        .values({
            invoice_id: invoiceId,
            work_id: workId,
            position: await nextPosition(trx, 'invoice_items', { invoice_id: invoiceId }),
            artist_name: w.artist_name,
            title: w.title,
            date_text: w.date_text,
            medium: w.medium,
            dimensions: w.dimensions,
            image_url: w.image_url ?? null,
            price_cents: w.price_cents ?? 0,
        })
        .execute();
}

/**
 * Put an unpaid invoice's works back on sale (cancelled or deleted), unless another unpaid invoice of the
 * same buyer lists them.
 */
async function releaseWorks(trx: Trx, inv: Pick<InvoiceRow, 'id' | 'number' | 'person_id'>, items: { work_id: string | null }[], note: string, userId: string | null) {
    for (const item of items) {
        if (!item.work_id) continue;
        const elsewhere = await trx
            .selectFrom('invoice_items as it')
            .innerJoin('invoices as i', 'i.id', 'it.invoice_id')
            .select('i.id')
            .where('it.work_id', '=', item.work_id)
            .where('i.id', '!=', inv.id)
            .where('i.person_id', '=', inv.person_id)
            .where('i.status', 'in', ['open', 'partial'])
            .executeTakeFirst();
        if (elsewhere) continue;
        const before = await trx.selectFrom('works').selectAll().where('id', '=', item.work_id).forUpdate().executeTakeFirstOrThrow();
        if (before.buyer_id !== inv.person_id || (before.status !== 'on_hold' && before.status !== 'sold')) continue;
        const released = await trx
            .updateTable('works')
            .set({ status: 'available', buyer_id: null, sold_on: null, sale_price_cents: null })
            .where('id', '=', item.work_id)
            .returningAll()
            .executeTakeFirstOrThrow();
        await recordWorkChanges(trx, before, released, note, userId);
    }
}

/**
 * Recompute totals (the update also bumps the invoice's version); once payments exist they set the status. When the invoice becomes paid, its
 * works are recorded as sold to the buyer.
 */
async function refresh(trx: Trx, id: string, userId: string | null, explicitStatus?: InvoiceStatus): Promise<InvoiceRow> {
    const inv = await trx.selectFrom('invoices').selectAll().where('id', '=', id).forUpdate().executeTakeFirstOrThrow();
    const items = await trx.selectFrom('invoice_items').select(['work_id', 'price_cents']).where('invoice_id', '=', id).orderBy('position').execute();
    const t = invoiceTotals(
        items.map((i) => Number(i.price_cents)),
        inv.discount_bps,
        inv.tax_rate_bps,
        Number(inv.shipping_cents),
    );
    const pay = await trx
        .selectFrom('invoice_payments')
        .select([sql<number>`coalesce(sum(amount_cents), 0)`.as('paid'), sql<string | null>`max(paid_on)::text`.as('last')])
        .where('invoice_id', '=', id)
        .executeTakeFirstOrThrow();
    const paid = Number(pay.paid);
    if (explicitStatus === 'cancelled' && inv.status === 'paid') throw new HttpError(400, 'A paid invoice can’t be cancelled');
    // Cancelled is only set or cleared by hand; otherwise payments decide once there are any.
    const status = explicitStatus ?? (inv.status === 'cancelled' ? 'cancelled' : paid > 0 ? statusFromPayments(paid, t.totalCents) : inv.status);
    const after = await trx
        .updateTable('invoices')
        .set({ subtotal_cents: t.subtotalCents, discount_cents: t.discountCents, tax_cents: t.taxCents, total_cents: t.totalCents, status })
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirstOrThrow();

    if (status === 'paid' && inv.status !== 'paid') {
        const soldOn = pay.last ?? todayIso();
        for (const item of items) {
            if (!item.work_id) continue;
            const before = await trx.selectFrom('works').selectAll().where('id', '=', item.work_id).forUpdate().executeTakeFirstOrThrow();
            if (before.status === 'sold' && before.buyer_id === inv.person_id) continue;
            // The work's share of the invoice discount comes off its sale price.
            const share = t.subtotalCents ? Math.round((Number(item.price_cents) * t.discountCents) / t.subtotalCents) : 0;
            const sold = await trx
                .updateTable('works')
                .set({ status: 'sold', buyer_id: inv.person_id, sold_on: soldOn, sale_price_cents: Number(item.price_cents) - share, location: before.location ?? 'collector' })
                .where('id', '=', item.work_id)
                .returningAll()
                .executeTakeFirstOrThrow();
            await recordWorkChanges(trx, before, sold, `Invoice ${inv.number} paid`, userId);
        }
        await ensureCollectorProfile(trx, inv.person_id);
    }

    if (inv.status === 'paid' && status !== 'paid') {
        // No longer fully paid: the works are held for the buyer again, not sold.
        for (const item of items) {
            if (!item.work_id) continue;
            const before = await trx.selectFrom('works').selectAll().where('id', '=', item.work_id).forUpdate().executeTakeFirstOrThrow();
            if (before.status !== 'sold' || before.buyer_id !== inv.person_id) continue;
            const held = await trx
                .updateTable('works')
                .set({ status: 'on_hold', sold_on: null, sale_price_cents: null })
                .where('id', '=', item.work_id)
                .returningAll()
                .executeTakeFirstOrThrow();
            await recordWorkChanges(trx, before, held, `Invoice ${inv.number} no longer paid`, userId);
        }
    }

    if (status === 'cancelled' && inv.status !== 'cancelled') {
        // The buyer didn't pay and never received the works: they leave the collection and go back on sale.
        await releaseWorks(trx, inv, items, `Invoice ${inv.number} cancelled`, userId);
    } else if (inv.status === 'cancelled' && status !== 'cancelled') {
        // Reopened: hold the works for the buyer again where they're still free.
        for (const item of items) {
            if (!item.work_id) continue;
            const w = await trx.selectFrom('works').select(['status', 'buyer_id']).where('id', '=', item.work_id).executeTakeFirstOrThrow();
            if (w.status === 'available' && !w.buyer_id) await holdFor(trx, item.work_id, inv.person_id, inv.number, userId);
        }
    }
    return after;
}

/** Item images for the PDF; a missing image leaves its cell blank. */
async function loadImages(storage: Storage | undefined, urls: (string | null)[]): Promise<ImageMap> {
    const out: ImageMap = new Map();
    for (const url of new Set(urls.filter((u): u is string => Boolean(u?.startsWith('/media/'))))) {
        const data = await readMedia(storage, url);
        if (data) out.set(url, data);
    }
    return out;
}

export function invoiceRoutes(deps: { storage?: Storage } = {}) {
    const app = new Hono<AppEnv>();

    const invoiceOr404 = (db: DB, id: string) => findOr404((x) => getInvoice(db, x), id);

    // ---------- Settings ----------

    app.get('/invoice-settings', async (c) => c.json({ ...(await getSettings(c.var.db)), payment: maskedPaymentDetails() }));

    app.put('/invoice-settings', async (c) => {
        const input = await body(c, invoiceSettingsPutSchema);
        const row = await c.var.db
            .updateTable('invoice_settings')
            .set({
                gallery_name: input.galleryName,
                address: input.address,
                email: input.email,
                phone: input.phone,
                default_terms: input.defaultTerms,
                default_tax_rate_bps: input.defaultTaxRateBps,
                number_prefix: input.numberPrefix,
            })
            .where(sameVersion(input.updatedAt))
            .returningAll()
            .executeTakeFirst();
        if (!row) return conflictOr404(true, async () => ({ ...(await getSettings(c.var.db)), payment: maskedPaymentDetails() }));
        return c.json({ ...toSettings(row), payment: maskedPaymentDetails() });
    });

    // ---------- Invoices ----------

    app.get('/invoices', async (c) => {
        const status = c.req.query('status');
        const person = c.req.query('person');
        if (status && !invoiceStatus.safeParse(status).success) throw new HttpError(400, 'Unknown status');
        if (person && !isUuid(person)) throw new HttpError(400, 'Invalid person');
        const { page, pageSize } = pageParams(c, INVOICES_PAGE_SIZE);
        return c.json(await listInvoices(c.var.db, { status: status as InvoiceStatus | undefined, personId: person, q: c.req.query('q')?.trim() || undefined }, page, pageSize));
    });

    app.post('/invoices', async (c) => {
        const input = await body(c, invoiceCreateSchema);
        const db = c.var.db;
        const userId = c.var.userId;
        if (!(await db.selectFrom('persons').select('id').where('id', '=', input.personId).executeTakeFirst())) throw new HttpError(400, 'Person not found');
        const workIds = [...new Set(input.workIds)];
        const works = await db.selectFrom('works').select(['id', 'status', 'buyer_id', 'title']).where('id', 'in', workIds).execute();
        if (works.length !== workIds.length) throw new HttpError(400, 'Work not found');
        for (const w of works) assertInvoiceable(w, input.personId);

        const settings = await getSettings(db);
        const issuedOn = input.issuedOn ?? todayIso();
        const id = await db.transaction().execute(async (trx) => {
            const number = await nextNumber(trx, settings.numberPrefix, issuedOn);
            const created = await trx
                .insertInto('invoices')
                .values({
                    number,
                    person_id: input.personId,
                    issued_on: issuedOn,
                    bill_to: await billToFor(trx, input.personId),
                    discount_bps: input.discountBps ?? 0,
                    tax_rate_bps: input.taxRateBps ?? settings.defaultTaxRateBps,
                    shipping_cents: input.shippingCents ?? 0,
                    terms: settings.defaultTerms,
                })
                .returning('id')
                .executeTakeFirstOrThrow();
            for (const workId of workIds) {
                await appendItem(trx, created.id, workId);
                await holdFor(trx, workId, input.personId, number, userId);
            }
            await ensureCollectorProfile(trx, input.personId);
            await refresh(trx, created.id, userId);
            return created.id;
        });
        return c.json(await getInvoice(db, id), 201);
    });

    app.get('/invoices/:id', async (c) => c.json(await invoiceOr404(c.var.db, idParam(c))));

    app.patch('/invoices/:id', async (c) => {
        const id = idParam(c);
        const patch = await body(c, invoicePatchSchema);
        const db = c.var.db;
        await invoiceOr404(db, id);
        const values = columns(patch, {
            number: 'number',
            issuedOn: 'issued_on',
            currency: 'currency',
            billTo: 'bill_to',
            discountBps: 'discount_bps',
            taxRateBps: 'tax_rate_bps',
            shippingCents: 'shipping_cents',
            terms: 'terms',
            notes: 'notes',
        });
        if (!Object.keys(values).length && !patch.status) throw new HttpError(400, 'Nothing to update');
        const ok = await db.transaction().execute(async (trx) => {
            const touched = await trx
                .updateTable('invoices')
                .set({ ...values, updated_at: new Date() })
                .where('id', '=', id)
                .where(sameVersion(patch.updatedAt))
                .returning('id')
                .executeTakeFirst();
            if (!touched) return false;
            await refresh(trx, id, c.var.userId, patch.status);
            return true;
        });
        if (!ok) return conflictOr404(true, () => getInvoice(db, id));
        return c.json(await getInvoice(db, id));
    });

    app.delete('/invoices/:id', async (c) => {
        const id = idParam(c);
        const db = c.var.db;
        const inv = await invoiceOr404(db, id);
        if (inv.payments.length) throw new HttpError(409, 'This invoice has payments recorded; remove them before deleting it');
        if (inv.status === 'paid') throw new HttpError(409, 'A paid invoice can’t be deleted; reopen it first');
        await db.transaction().execute(async (trx) => {
            const items = await trx.selectFrom('invoice_items').select('work_id').where('invoice_id', '=', id).execute();
            await trx.deleteFrom('invoices').where('id', '=', id).execute();
            // Its works were held for the buyer: put them back on sale (cancelled invoices already did).
            if (inv.status !== 'cancelled') await releaseWorks(trx, { id, number: inv.number, person_id: inv.personId }, items, `Invoice ${inv.number} deleted`, c.var.userId);
        });
        return c.body(null, 204);
    });

    // ---------- Items ----------

    app.post('/invoices/:id/items', async (c) => {
        const id = idParam(c);
        const { workId } = await body(c, invoiceItemAddSchema);
        const db = c.var.db;
        const inv = await invoiceOr404(db, id);
        if (inv.status === 'cancelled') throw new HttpError(409, 'Reopen this invoice before adding works');
        assertNotPaid(inv);
        if (inv.items.some((i) => i.workId === workId)) throw new HttpError(409, 'That work is already on this invoice');
        const work = await db.selectFrom('works').select(['status', 'buyer_id', 'title']).where('id', '=', workId).executeTakeFirst();
        if (!work) throw new HttpError(400, 'Work not found');
        assertInvoiceable(work, inv.personId);
        await db.transaction().execute(async (trx) => {
            await appendItem(trx, id, workId);
            await holdFor(trx, workId, inv.personId, inv.number, c.var.userId);
            await refresh(trx, id, c.var.userId);
        });
        return c.json(await getInvoice(db, id), 201);
    });

    app.patch('/invoices/:id/items/:itemId', async (c) => {
        const { id, itemId } = c.req.param();
        const patch = await body(c, invoiceItemPatchSchema);
        const db = c.var.db;
        if (!isUuid(itemId)) throw new HttpError(404, 'Not found');
        assertNotPaid(await invoiceOr404(db, id));
        const values = columns(patch, { priceCents: 'price_cents', artistName: 'artist_name', title: 'title', dateText: 'date_text', medium: 'medium', dimensions: 'dimensions' });
        if (!Object.keys(values).length) throw new HttpError(400, 'Nothing to update');
        await db.transaction().execute(async (trx) => {
            const updated = await trx.updateTable('invoice_items').set(values).where('id', '=', itemId).where('invoice_id', '=', id).executeTakeFirst();
            if (!updated.numUpdatedRows) throw new HttpError(404, 'Not found');
            await refresh(trx, id, c.var.userId);
        });
        return c.json(await getInvoice(db, id));
    });

    app.delete('/invoices/:id/items/:itemId', async (c) => {
        const { id, itemId } = c.req.param();
        const db = c.var.db;
        if (!isUuid(itemId)) throw new HttpError(404, 'Not found');
        assertNotPaid(await invoiceOr404(db, id));
        await db.transaction().execute(async (trx) => {
            const item = await trx.deleteFrom('invoice_items').where('id', '=', itemId).where('invoice_id', '=', id).returning('position').executeTakeFirst();
            if (!item) throw new HttpError(404, 'Not found');
            await closeGap(trx, 'invoice_items', { invoice_id: id }, item.position);
            await refresh(trx, id, c.var.userId);
        });
        return c.json(await getInvoice(db, id));
    });

    // ---------- Payments ----------

    app.post('/invoices/:id/payments', async (c) => {
        const id = idParam(c);
        const input = await body(c, invoicePaymentCreateSchema);
        const db = c.var.db;
        await invoiceOr404(db, id);
        await db.transaction().execute(async (trx) => {
            await trx
                .insertInto('invoice_payments')
                .values({ invoice_id: id, amount_cents: input.amountCents, paid_on: input.paidOn, method: input.method ?? null, note: input.note ?? null, user_id: c.var.userId })
                .execute();
            await refresh(trx, id, c.var.userId);
        });
        return c.json(await getInvoice(db, id), 201);
    });

    app.delete('/invoices/:id/payments/:paymentId', async (c) => {
        const { id, paymentId } = c.req.param();
        const db = c.var.db;
        if (!isUuid(paymentId)) throw new HttpError(404, 'Not found');
        await invoiceOr404(db, id);
        await db.transaction().execute(async (trx) => {
            const deleted = await trx.deleteFrom('invoice_payments').where('id', '=', paymentId).where('invoice_id', '=', id).executeTakeFirst();
            if (!deleted.numDeletedRows) throw new HttpError(404, 'Not found');
            const left = await trx.selectFrom('invoice_payments').select('id').where('invoice_id', '=', id).executeTakeFirst();
            // With no payments left the invoice is open again.
            await refresh(trx, id, c.var.userId, left ? undefined : 'open');
        });
        return c.json(await getInvoice(db, id));
    });

    // ---------- PDF ----------

    app.get('/invoices/:id/invoice.pdf', async (c) => {
        const inv = await invoiceOr404(c.var.db, idParam(c));
        const settings = await getSettings(c.var.db);
        const images = await loadImages(deps.storage, inv.items.map((i) => i.imageUrl));
        const pdf = await renderInvoicePdf(inv, settings, paymentDetails(), images);
        const name = `${inv.number}${inv.titles ? ` ${inv.titles}` : ''}`.replace(/[^\w\- ,]+/g, '').slice(0, 80);
        return pdfResponse(c, pdf, `${name}.pdf`, c.req.query('download') !== '1');
    });

    return app;
}
