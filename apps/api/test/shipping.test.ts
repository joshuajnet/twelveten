import { describe, expect, it } from 'vitest';
import { labelWorks } from '../src/shipping/labels.ts';
import { adminHarness } from './admin-harness.ts';

const { call, db } = adminHarness();

async function artist(name: string) {
    return (await call('POST', '/admin/persons', { name, profiles: ['artist'] })).body as { id: string };
}
async function work(artistId: string, title: string) {
    return (await call('POST', '/admin/works', { artistId, title, priceCents: 123456, inventoryNumber: `SL-${title}` })).body as { id: string };
}
const pages = (pdf: Buffer) => pdf.toString('latin1').match(/\/Type \/Page\b/g)?.length ?? 0;
const destination = 'Avery Sample\n100 Example Street\nTulsa, OK 74103';

describe('shipping labels', () => {
    it('makes one page per work for a work list, a room and the inventory filters', async () => {
        const a = await artist('Label Artist');
        const [w1, w2, w3] = [await work(a.id, 'One'), await work(a.id, 'Two'), await work(a.id, 'Three')];

        const one = await call('POST', '/admin/shipping-labels.pdf?download=1', { source: { kind: 'works', workIds: [w1.id] }, destination });
        expect(one.status).toBe(200);
        expect(one.headers.get('content-disposition')).toBe('attachment; filename="Shipping label - SL-One.pdf"');
        expect(one.bytes!.subarray(0, 4).toString()).toBe('%PDF');
        expect(pages(one.bytes!)).toBe(1);

        const room = (await call('POST', '/admin/rooms', { title: 'Label room', works: [w3.id, w1.id] })).body;
        const roomPdf = await call('POST', '/admin/shipping-labels.pdf', { source: { kind: 'room', roomId: room.id }, destination, returnAddress: 'Studio\n1 Back Lane' });
        expect(roomPdf.status).toBe(200);
        expect(roomPdf.headers.get('content-disposition')).toBe('inline; filename="Shipping labels - Label room.pdf"');
        expect(pages(roomPdf.bytes!)).toBe(2);
        expect((await labelWorks(db, { kind: 'room', roomId: room.id })).works.map((w) => w.title)).toEqual(['Three', 'One']);

        const inv = await call('POST', '/admin/shipping-labels.pdf', { source: { kind: 'inventory', artist: a.id, statuses: ['available'] }, destination });
        expect(pages(inv.bytes!)).toBe(3);
        expect((await labelWorks(db, { kind: 'works', workIds: [w2.id, w1.id] })).works.map((w) => w.title)).toEqual(['Two', 'One']);
    });

    it('rejects bad requests', async () => {
        const a = await artist('Label Reject');
        const w = await work(a.id, 'Reject');
        const src = { kind: 'works', workIds: [w.id] };
        expect((await call('POST', '/admin/shipping-labels.pdf', { source: src, destination: '  ' })).status).toBe(400);
        expect((await call('POST', '/admin/shipping-labels.pdf', { source: src, destination, returnAddress: '' })).status).toBe(400);
        expect((await call('POST', '/admin/shipping-labels.pdf', { source: { kind: 'works', workIds: Array(201).fill(w.id) }, destination })).status).toBe(400);
        expect((await call('POST', '/admin/shipping-labels.pdf', { source: { kind: 'works', workIds: ['00000000-0000-4000-8000-000000000000'] }, destination })).status).toBe(404);
        expect((await call('POST', '/admin/shipping-labels.pdf', { source: { kind: 'room', roomId: '00000000-0000-4000-8000-000000000000' }, destination })).status).toBe(404);
        expect((await call('POST', '/admin/shipping-labels.pdf', { source: { kind: 'inventory', q: 'no such work anywhere' }, destination })).status).toBe(400);
    });

    it('is admin-only', async () => {
        const req = { source: { kind: 'inventory' }, destination };
        expect((await call('POST', '/admin/shipping-labels.pdf', req, 'anon')).status).toBe(401);
        expect((await call('POST', '/admin/shipping-labels.pdf', req, 'user')).status).toBe(403);
    });
});
