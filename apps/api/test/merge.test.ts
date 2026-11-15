import { describe, expect, it } from 'vitest';
import { adminHarness } from './admin-harness.ts';

const { call, db } = adminHarness();

const person = async (body: Record<string, unknown>) => (await call('POST', '/admin/persons', body)).body;

describe('duplicates', () => {
    it('suggests people with the same email, email name, phone or a similar name, until dismissed', async () => {
        const a = await person({ name: 'Harriet Quill', email: 'harriet.quill@example.com', phone: '(312) 555-0199' });
        const b = await person({ name: 'Harriet  Quil', email: 'HARRIET.QUILL@other.org' });
        const c = await person({ name: 'Someone Else', phone: '312.555.0199' });
        const d = await person({ name: 'Unrelated Person', email: 'harriet.quill@example.com' });

        const res = await call('GET', `/admin/persons/${a.id}/duplicates`);
        expect(res.status).toBe(200);
        const byOther = new Map(res.body.items.map((p: any) => [p.a.id === a.id ? p.b.id : p.a.id, p]));
        expect((byOther.get(b.id) as any).reasons).toEqual(['Same email name, other domain', 'Similar name']);
        expect((byOther.get(c.id) as any).reasons).toEqual(['Same phone']);
        expect((byOther.get(d.id) as any).reasons).toEqual(['Same email']);
        expect((byOther.get(d.id) as any).score).toBe(100);
        // Best first.
        expect(res.body.items[0].reasons).toContain('Same email');

        expect((await call('POST', '/admin/persons/duplicates/dismiss', { aId: d.id, bId: a.id })).status).toBe(204);
        const after = (await call('GET', `/admin/persons/${a.id}/duplicates`)).body.items;
        expect(after.some((p: any) => p.a.id === d.id || p.b.id === d.id)).toBe(false);

        const list = await call('GET', '/admin/persons/duplicates');
        expect(list.status).toBe(200);
        expect(list.body.total).toBeGreaterThan(0);
        expect((await call('GET', '/admin/persons/duplicates/count')).body.count).toBe(list.body.total);
    });
});

describe('alias emails', () => {
    it('adds and removes aliases; refuses one another person uses', async () => {
        const p = await person({ name: 'Alias Owner', email: 'owner@example.com' });
        const other = await person({ name: 'Other Owner', email: 'taken@example.com' });
        const res = await call('PUT', `/admin/persons/${p.id}/emails`, { emails: ['Second@Example.com', 'owner@example.com'] });
        expect(res.status).toBe(200);
        expect(res.body.emails).toEqual(['second@example.com']);
        const clash = await call('PUT', `/admin/persons/${p.id}/emails`, { emails: ['taken@example.com'] });
        expect(clash.status).toBe(409);
        expect(clash.body.error).toContain('Other Owner');
        expect((await call('PUT', `/admin/persons/${p.id}/emails`, { emails: [] })).body.emails).toEqual([]);
        expect(other.id).toBeTruthy();
    });
});

describe('merge', () => {
    it('moves addresses, aliases, purchases, invoices and the collector profile, then deletes the source', async () => {
        const artist = await person({ name: 'Merge Artist', profiles: ['artist'] });
        const keep = await person({ name: 'Kim Keeper', email: 'kim@example.com', notes: 'Kept notes' });
        const dupe = await person({ name: 'Kimberly Keeper', email: 'kimberly@work.example', phone: '555-1234', notes: 'Dupe notes' });

        await call('POST', '/admin/addresses', { entity: 'person', entityId: keep.id, address: { line1: '1 Main St', city: 'Chicago', country: 'US' }, isPrimary: true });
        await call('POST', '/admin/addresses', { entity: 'person', entityId: dupe.id, address: { line1: '1 Main St', city: 'Chicago', country: 'US' } });
        await call('POST', '/admin/addresses', { entity: 'person', entityId: dupe.id, address: { line1: '9 Lake Rd', city: 'Evanston', country: 'US' }, isPrimary: true });
        await call('PUT', `/admin/persons/${dupe.id}/emails`, { emails: ['kim.k@old.example'] });

        const w = (await call('POST', '/admin/works', { artistId: artist.id, title: 'Held', priceCents: 1000 })).body;
        await call('PATCH', `/admin/works/${w.id}`, { updatedAt: w.updatedAt, status: 'on_hold', buyerId: dupe.id });
        const inv = (await call('POST', '/admin/invoices', { personId: dupe.id, workIds: [w.id] })).body;
        await call('PUT', `/admin/persons/${dupe.id}/collector-profile`, { notes: 'Dupe collector', updatedAt: (await call('GET', `/admin/persons/${dupe.id}`)).body.collectorProfile.updatedAt });

        const [k, d] = [(await call('GET', `/admin/persons/${keep.id}`)).body, (await call('GET', `/admin/persons/${dupe.id}`)).body];
        const stale = await call('POST', `/admin/persons/${dupe.id}/merge`, { intoId: keep.id, updatedAt: '2000-01-01T00:00:00.000Z', intoUpdatedAt: k.updatedAt });
        expect(stale.status).toBe(409);

        const res = await call('POST', `/admin/persons/${dupe.id}/merge`, {
            intoId: keep.id,
            fields: { phone: 'source', name: 'target' },
            updatedAt: d.updatedAt,
            intoUpdatedAt: k.updatedAt,
        });
        expect(res.status).toBe(200);
        const merged = res.body;
        expect(merged).toMatchObject({ name: 'Kim Keeper', email: 'kim@example.com', phone: '555-1234', notes: 'Kept notes\n\nDupe notes' });
        expect(merged.emails.sort()).toEqual(['kim.k@old.example', 'kimberly@work.example']);
        // The identical address is dropped; the other moves over without taking the primary flag.
        expect(merged.addresses.map((a: any) => [a.address.line1, a.isPrimary])).toEqual([
            ['1 Main St', true],
            ['9 Lake Rd', false],
        ]);
        expect(merged.profiles).toEqual(['collector']);
        expect(merged.collectorProfile.notes).toBe('Dupe collector');
        expect(merged.collectorProfile.collection[0].works[0].id).toBe(w.id);
        expect(merged.collectorProfile.invoices.map((i: any) => i.id)).toEqual([inv.id]);

        expect((await call('GET', `/admin/persons/${dupe.id}`)).status).toBe(404);
        const revs = (await call('GET', `/admin/revisions?entity=person&id=${dupe.id}`)).body.items;
        expect(revs[0].action).toBe('merge');
        expect((await call('POST', `/admin/revisions/${revs[0].id}/restore`)).status).toBe(400);
        // The deleted source doesn't show up as "recently deleted".
        expect((await call('GET', '/admin/deleted')).body.items.some((i: any) => i.entityId === dupe.id)).toBe(false);
        const left = await db.selectFrom('address_links').select('id').where('entity_id', '=', dupe.id).execute();
        expect(left).toEqual([]);
    });

    it('refuses to merge an artist into someone else', async () => {
        const artist = await person({ name: 'Arty Merge', profiles: ['artist'] });
        const other = await person({ name: 'Arty Merge Two' });
        const [a, o] = [(await call('GET', `/admin/persons/${artist.id}`)).body, (await call('GET', `/admin/persons/${other.id}`)).body];
        const res = await call('POST', `/admin/persons/${artist.id}/merge`, { intoId: other.id, updatedAt: a.updatedAt, intoUpdatedAt: o.updatedAt });
        expect(res.status).toBe(409);
        expect(res.body.error).toContain('merge Arty Merge Two into them instead');
        // The other way round works.
        const ok = await call('POST', `/admin/persons/${other.id}/merge`, { intoId: artist.id, updatedAt: o.updatedAt, intoUpdatedAt: a.updatedAt });
        expect(ok.status).toBe(200);
        expect(ok.body.profiles).toEqual(['artist']);
    });
});
