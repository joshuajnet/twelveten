import { describe, expect, it } from 'vitest';
import { adminHarness } from './admin-harness.ts';

const { call } = adminHarness();

async function artist(name: string) {
    return (await call('POST', '/admin/persons', { name, profiles: ['artist'] })).body as { id: string };
}
async function work(artistId: string, title: string, priceCents: number) {
    return (await call('POST', '/admin/works', { artistId, title, priceCents })).body as { id: string; updatedAt: string };
}
async function holdFor(w: { id: string; updatedAt: string }, buyerId: string) {
    return (await call('PATCH', `/admin/works/${w.id}`, { updatedAt: w.updatedAt, status: 'on_hold', buyerId })).body;
}

describe('collectors', () => {
    it('groups a collector’s on-hold and sold works by artist, A–Z, and ignores available ones', async () => {
        const zed = await artist('Zed Zebra');
        const amy = await artist('Amy Aardvark');
        const buyer = (await call('POST', '/admin/persons', { name: 'Cora Collector' })).body;
        expect(buyer.profiles).toEqual([]);

        await holdFor(await work(zed.id, 'Zed one', 1000), buyer.id);
        const sold = await work(amy.id, 'Amy sold', 2000);
        await call('PATCH', `/admin/works/${sold.id}`, { updatedAt: sold.updatedAt, status: 'sold', buyerId: buyer.id, soldOn: '2026-01-02' });
        await work(amy.id, 'Amy available', 3000);

        const person = (await call('GET', `/admin/persons/${buyer.id}`)).body;
        // Holding or buying a work makes them a collector.
        expect(person.profiles).toEqual(['collector']);
        expect(person.collectorProfile.collection.map((g: { name: string; works: { title: string }[] }) => [g.name, g.works.map((w) => w.title)])).toEqual([
            ['Amy Aardvark', ['Amy sold']],
            ['Zed Zebra', ['Zed one']],
        ]);
        expect(person.collectorProfile.collection[0].artistId).toBe(amy.id);

        const list = (await call('GET', '/admin/persons?profile=collector&q=cora')).body;
        expect(list.items[0]).toMatchObject({ profiles: ['collector'], collector: { works: 2, artists: 2, openInvoices: 0 } });
        expect((await call('GET', '/admin/persons?profile=none&q=cora')).body.total).toBe(0);
    });

    it('adds, edits and removes a collector profile', async () => {
        const p = (await call('POST', '/admin/persons', { name: 'Nina Notes' })).body;
        const added = await call('PUT', `/admin/persons/${p.id}/collector-profile`, { notes: 'Likes small works' });
        expect(added.status).toBe(201);
        expect(added.body.collectorProfile).toMatchObject({ notes: 'Likes small works', collection: [], invoices: [] });
        const stale = added.body.collectorProfile.updatedAt;
        const edited = await call('PUT', `/admin/persons/${p.id}/collector-profile`, { notes: 'Advisor: Sam', updatedAt: stale });
        expect(edited.body.collectorProfile.notes).toBe('Advisor: Sam');
        expect((await call('PUT', `/admin/persons/${p.id}/collector-profile`, { notes: 'x', updatedAt: '2000-01-01T00:00:00.000Z' })).status).toBe(409);
        expect((await call('DELETE', `/admin/persons/${p.id}/collector-profile`)).body.profiles).toEqual([]);
    });
});

describe('invoices', () => {
    async function setup(name: string, prices: number[]) {
        const a = await artist(`${name} Artist`);
        const buyer = (await call('POST', '/admin/persons', { name: `${name} Buyer`, email: `${name.toLowerCase()}@example.com` })).body;
        const works = [];
        for (const [i, p] of prices.entries()) works.push(await work(a.id, `${name} ${i + 1}`, p));
        return { artist: a, buyer, works };
    }

    it('creates an invoice from works, holds them for the buyer, and computes totals like the paper invoices', async () => {
        const { buyer, works } = await setup('Sender', [260000]);
        const res = await call('POST', '/admin/invoices', { personId: buyer.id, workIds: [works[0]!.id], discountBps: 1500, issuedOn: '2026-06-04' });
        expect(res.status).toBe(201);
        // $2,600 − 15% = $2,210; tax 10.25% = $226.525 → $226.52 (half to even); total $2,436.52.
        expect(res.body).toMatchObject({
            number: 'INV-2026-001',
            status: 'open',
            subtotalCents: 260000,
            discountCents: 39000,
            taxRateBps: 1025,
            taxCents: 22652,
            totalCents: 243652,
            balanceCents: 243652,
            billTo: 'Sender Buyer\nsender@example.com',
            items: [{ title: 'Sender 1', artistName: 'Sender Artist', priceCents: 260000 }],
        });
        expect(res.body.terms).toMatch(/thirty days/);
        const w = (await call('GET', `/admin/works/${works[0]!.id}`)).body;
        expect(w).toMatchObject({ status: 'on_hold', buyer: { id: buyer.id } });
        expect(w.invoices.map((i: { number: string }) => i.number)).toEqual(['INV-2026-001']);
        expect((await call('GET', `/admin/persons/${buyer.id}`)).body.profiles).toEqual(['collector']);

        // The next number in the same year.
        const { buyer: b2, works: w2 } = await setup('Next', [1000]);
        expect((await call('POST', '/admin/invoices', { personId: b2.id, workIds: [w2[0]!.id], issuedOn: '2026-07-01' })).body.number).toBe('INV-2026-002');
    });

    it('refuses works held for or sold to someone else', async () => {
        const { buyer, works } = await setup('Taken', [1000]);
        const other = (await call('POST', '/admin/persons', { name: 'Other Person' })).body;
        await holdFor(works[0]!, other.id);
        expect((await call('POST', '/admin/invoices', { personId: buyer.id, workIds: [works[0]!.id] })).status).toBe(400);
        expect((await call('POST', '/admin/invoices', { personId: buyer.id, workIds: [] })).status).toBe(400);
    });

    it('moves from open to partial to paid with payments, then records the works as sold', async () => {
        const { buyer, works } = await setup('Paying', [240000]);
        let inv = (await call('POST', '/admin/invoices', { personId: buyer.id, workIds: [works[0]!.id], discountBps: 1000, taxRateBps: 0 })).body;
        expect(inv.totalCents).toBe(216000);

        inv = (await call('POST', `/admin/invoices/${inv.id}/payments`, { amountCents: 50000, paidOn: '2026-05-29', method: 'Zelle' })).body;
        expect(inv).toMatchObject({ status: 'partial', paidCents: 50000, balanceCents: 166000 });
        expect((await call('GET', `/admin/works/${works[0]!.id}`)).body.status).toBe('on_hold');

        inv = (await call('POST', `/admin/invoices/${inv.id}/payments`, { amountCents: 166000, paidOn: '2026-08-11' })).body;
        expect(inv).toMatchObject({ status: 'paid', balanceCents: 0 });
        const w = (await call('GET', `/admin/works/${works[0]!.id}`)).body;
        // Sale price is the invoiced price less its share of the discount.
        expect(w).toMatchObject({ status: 'sold', soldOn: '2026-08-11', salePriceCents: 216000, buyer: { id: buyer.id } });
        const history = (await call('GET', `/admin/works/${works[0]!.id}/history`)).body.items;
        expect(history[0].note).toBe(`Invoice ${inv.number} paid`);

        // Invoices with payments can't be deleted; removing every payment reopens it.
        expect((await call('DELETE', `/admin/invoices/${inv.id}`)).status).toBe(409);
        for (const p of inv.payments) inv = (await call('DELETE', `/admin/invoices/${inv.id}/payments/${p.id}`)).body;
        expect(inv.status).toBe('open');
        expect((await call('DELETE', `/admin/invoices/${inv.id}`)).status).toBe(204);
    });

    it('edits fields with an optimistic lock, recomputes totals, and manages items', async () => {
        const { buyer, works } = await setup('Pair', [260000, 260000]);
        let inv = (await call('POST', '/admin/invoices', { personId: buyer.id, workIds: [works[0]!.id] })).body;
        const stale = inv.updatedAt;
        inv = (await call('PATCH', `/admin/invoices/${inv.id}`, { updatedAt: inv.updatedAt, discountBps: 1000, taxRateBps: 0, billTo: 'Pair Buyer\n1 Main St' })).body;
        expect(inv).toMatchObject({ discountCents: 26000, taxCents: 0, totalCents: 234000, billTo: 'Pair Buyer\n1 Main St' });
        expect((await call('PATCH', `/admin/invoices/${inv.id}`, { updatedAt: stale, shippingCents: 100 })).status).toBe(409);

        inv = (await call('POST', `/admin/invoices/${inv.id}/items`, { workId: works[1]!.id })).body;
        expect([inv.items.length, inv.totalCents]).toEqual([2, 468000]);
        expect((await call('POST', `/admin/invoices/${inv.id}/items`, { workId: works[1]!.id })).status).toBe(409);
        inv = (await call('PATCH', `/admin/invoices/${inv.id}/items/${inv.items[1].id}`, { priceCents: 250000 })).body;
        expect(inv.subtotalCents).toBe(510000);
        inv = (await call('DELETE', `/admin/invoices/${inv.id}/items/${inv.items[0].id}`)).body;
        expect(inv.items.map((i: { position: number; title: string }) => [i.position, i.title])).toEqual([[0, 'Pair 2']]);

        // Marking it paid by hand also records the sale.
        inv = (await call('PATCH', `/admin/invoices/${inv.id}`, { updatedAt: inv.updatedAt, status: 'paid' })).body;
        expect(inv.status).toBe('paid');
        expect((await call('GET', `/admin/works/${works[1]!.id}`)).body.status).toBe('sold');
    });

    it('cancels an unpaid invoice: its works leave the collection and go back on sale; reopening holds them again', async () => {
        const { buyer, works } = await setup('Declined', [100000, 50000]);
        let inv = (await call('POST', '/admin/invoices', { personId: buyer.id, workIds: [works[0]!.id, works[1]!.id] })).body;
        // One work had been marked sold to them by hand before they backed out.
        const marked = (await call('GET', `/admin/works/${works[1]!.id}`)).body;
        await call('PATCH', `/admin/works/${marked.id}`, { updatedAt: marked.updatedAt, status: 'sold', soldOn: '2026-01-01', salePriceCents: 50000 });
        expect((await call('GET', `/admin/persons/${buyer.id}`)).body.collectorProfile.collection[0].works).toHaveLength(2);

        inv = (await call('PATCH', `/admin/invoices/${inv.id}`, { updatedAt: inv.updatedAt, status: 'cancelled' })).body;
        expect(inv.status).toBe('cancelled');
        for (const w of works) {
            const after = (await call('GET', `/admin/works/${w.id}`)).body;
            expect([after.status, after.buyer, after.soldOn, after.salePriceCents]).toEqual(['available', null, null, null]);
        }
        expect((await call('GET', `/admin/works/${works[0]!.id}/history`)).body.items[0].note).toBe(`Invoice ${inv.number} cancelled`);
        const person = (await call('GET', `/admin/persons/${buyer.id}`)).body;
        expect(person.collectorProfile.collection).toEqual([]);
        // The cancelled invoice stays on record.
        expect(person.collectorProfile.invoices.map((i: { status: string }) => i.status)).toEqual(['cancelled']);

        // Payments don't change a cancelled invoice; adding works needs it reopened.
        inv = (await call('POST', `/admin/invoices/${inv.id}/payments`, { amountCents: 100, paidOn: '2026-01-01' })).body;
        expect(inv.status).toBe('cancelled');
        expect((await call('POST', `/admin/invoices/${inv.id}/items`, { workId: works[0]!.id })).status).toBe(409);
        expect((await call('GET', '/admin/persons?profile=collector&q=declined')).body.items[0].collector).toMatchObject({ works: 0, openInvoices: 0 });

        inv = (await call('PATCH', `/admin/invoices/${inv.id}`, { updatedAt: inv.updatedAt, status: 'open' })).body;
        const w = (await call('GET', `/admin/works/${works[0]!.id}`)).body;
        expect([w.status, w.buyer?.id]).toEqual(['on_hold', buyer.id]);

        // A paid invoice can't be cancelled.
        inv = (await call('POST', `/admin/invoices/${inv.id}/payments`, { amountCents: inv.balanceCents, paidOn: '2026-01-02' })).body;
        expect(inv.status).toBe('paid');
        expect((await call('PATCH', `/admin/invoices/${inv.id}`, { updatedAt: inv.updatedAt, status: 'cancelled' })).status).toBe(400);
    });

    it('lists and filters invoices and renders the PDF', async () => {
        const { buyer, works } = await setup('Listed', [100000]);
        const inv = (await call('POST', '/admin/invoices', { personId: buyer.id, workIds: [works[0]!.id] })).body;
        const found = (await call('GET', '/admin/invoices?q=listed')).body;
        expect(found.items.map((i: { id: string }) => i.id)).toEqual([inv.id]);
        expect(found.items[0]).toMatchObject({ personName: 'Listed Buyer', titles: 'Listed 1' });
        expect((await call('GET', `/admin/invoices?person=${buyer.id}&status=paid`)).body.total).toBe(0);
        expect((await call('GET', '/admin/invoices?status=void')).status).toBe(400);

        const pdf = await call('GET', `/admin/invoices/${inv.id}/invoice.pdf?download=1`);
        expect(pdf.status).toBe(200);
        expect(pdf.headers.get('content-disposition')).toMatch(/^attachment; filename="INV-\d{4}-\d{3} Listed 1\.pdf"$/);
        expect(pdf.bytes!.subarray(0, 4).toString()).toBe('%PDF');
    });

    it('keeps invoice settings editable and payment details masked', async () => {
        const s = (await call('GET', '/admin/invoice-settings')).body;
        expect(s).toMatchObject({ galleryName: 'Twelve Ten', defaultTaxRateBps: 1025, numberPrefix: 'INV-' });
        expect(Object.keys(s.payment).sort()).toEqual(['checksPayableTo', 'wireAccount', 'wireRouting', 'zelle']);
        const saved = await call('PUT', '/admin/invoice-settings', { ...s, payment: undefined, phone: '+1 555 0100' });
        expect(saved.body.phone).toBe('+1 555 0100');
        expect((await call('PUT', '/admin/invoice-settings', { ...s, payment: undefined })).status).toBe(409);
    });

    it('is admin-only', async () => {
        const id = '00000000-0000-4000-8000-000000000000';
        const routes: [string, string][] = [
            ['GET', '/admin/invoices'],
            ['POST', '/admin/invoices'],
            ['GET', `/admin/invoices/${id}`],
            ['PATCH', `/admin/invoices/${id}`],
            ['GET', `/admin/invoices/${id}/invoice.pdf`],
            ['POST', `/admin/invoices/${id}/payments`],
            ['GET', '/admin/invoice-settings'],
            ['PUT', `/admin/persons/${id}/collector-profile`],
        ];
        for (const [method, path] of routes) {
            expect([method, path, (await call(method, path, method === 'GET' ? undefined : {}, 'anon')).status]).toEqual([method, path, 401]);
            expect([method, path, (await call(method, path, method === 'GET' ? undefined : {}, 'user')).status]).toEqual([method, path, 403]);
        }
    });
});
