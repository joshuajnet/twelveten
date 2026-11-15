import { describe, expect, it } from 'vitest';
import { formatAddress } from '@twelveten/shared';
import { adminHarness } from './admin-harness.ts';

const { db, call } = adminHarness();

const person = async (name: string) => (await call('POST', '/admin/persons', { name })).body as { id: string };
const list = async (id: string) => (await call('GET', `/admin/addresses?entity=person&id=${id}`)).body.items as any[];

describe('addresses', () => {
    it('attaches structured addresses; the first becomes primary and only one stays primary', async () => {
        const p = await person('Addie Address');
        const first = await call('POST', '/admin/addresses', {
            entity: 'person',
            entityId: p.id,
            label: 'Studio',
            address: { line1: '12 Main St', city: 'Tulsa', region: 'OK', postalCode: '74103', country: 'us' },
        });
        expect(first.status).toBe(201);
        expect(first.body.items[0]).toMatchObject({ label: 'Studio', isPrimary: true, sharedWith: 1, address: { country: 'US', city: 'Tulsa' } });

        await call('POST', '/admin/addresses', { entity: 'person', entityId: p.id, label: 'Home', address: { line1: '1 Elm', city: 'Paris', country: 'FR' } });
        let items = await list(p.id);
        expect(items.map((i) => [i.label, i.isPrimary])).toEqual([
            ['Studio', true],
            ['Home', false],
        ]);

        const home = items[1];
        await call('PATCH', `/admin/address-links/${home.linkId}`, { isPrimary: true });
        items = await list(p.id);
        expect(items.filter((i) => i.isPrimary).map((i) => i.label)).toEqual(['Home']);

        // Editing the address itself, with a version check.
        const edited = await call('PATCH', `/admin/addresses/${home.address.id}`, { updatedAt: home.address.updatedAt, line2: 'Apt 4' });
        expect(edited.status).toBe(200);
        expect((await call('PATCH', `/admin/addresses/${home.address.id}`, { updatedAt: home.address.updatedAt, line2: 'x' })).status).toBe(409);

        expect(formatAddress(items[1].address)).toEqual(['12 Main St', 'Tulsa, OK 74103']);
        expect(formatAddress({ ...edited.body })).toEqual(['1 Elm', 'Apt 4', 'Paris', 'FR']);
    });

    it('shares one address between people; detaching from one keeps it for the other', async () => {
        const a = await person('Sharer A');
        const b = await person('Sharer B');
        const created = await call('POST', '/admin/addresses', { entity: 'person', entityId: a.id, address: { line1: '5 Shared Rd' } });
        const addressId = created.body.items[0].address.id;
        const attached = await call('POST', '/admin/addresses', { entity: 'person', entityId: b.id, addressId, label: 'Shipping' });
        expect(attached.body.items[0]).toMatchObject({ sharedWith: 2, label: 'Shipping' });

        await call('DELETE', `/admin/address-links/${created.body.items[0].linkId}`);
        expect(await list(a.id)).toEqual([]);
        expect((await list(b.id))[0].address.id).toBe(addressId);

        // Detaching the last link deletes the address.
        await call('DELETE', `/admin/address-links/${(await list(b.id))[0].linkId}`);
        expect(await db.selectFrom('addresses').select('id').where('id', '=', addressId).executeTakeFirst()).toBeUndefined();
    });

    it('removes links and orphaned addresses when a person is deleted', async () => {
        const p = await person('Gone Soon');
        const res = await call('POST', '/admin/addresses', { entity: 'person', entityId: p.id, address: { line1: '9 Gone Ave' } });
        const addressId = res.body.items[0].address.id;
        await call('DELETE', `/admin/persons/${p.id}`);
        expect(await db.selectFrom('address_links').select('id').where('entity_id', '=', p.id).execute()).toEqual([]);
        expect(await db.selectFrom('addresses').select('id').where('id', '=', addressId).executeTakeFirst()).toBeUndefined();
    });

    it('promotes another address when the primary one is detached', async () => {
        const p = await person('Promo Person');
        await call('POST', '/admin/addresses', { entity: 'person', entityId: p.id, address: { line1: 'A' } });
        await call('POST', '/admin/addresses', { entity: 'person', entityId: p.id, address: { line1: 'B' } });
        const [primary] = await list(p.id);
        const after = (await call('DELETE', `/admin/address-links/${primary.linkId}`)).body.items;
        expect(after.map((i: any) => [i.address.line1, i.isPrimary])).toEqual([['B', true]]);
    });

    it('validates input', async () => {
        const p = await person('Val Idate');
        expect((await call('GET', `/admin/addresses?entity=planet&id=${p.id}`)).status).toBe(400);
        expect((await call('POST', '/admin/addresses', { entity: 'planet', entityId: p.id, address: {} })).status).toBe(400);
        expect((await call('POST', '/admin/addresses', { entity: 'person', entityId: p.id })).status).toBe(400);
        expect((await call('POST', '/admin/addresses', { entity: 'person', entityId: p.id, address: { country: 'USA' } })).status).toBe(400);
        expect((await call('POST', '/admin/addresses', { entity: 'person', entityId: '00000000-0000-4000-8000-000000000000', address: {} })).status).toBe(404);
    });
});
