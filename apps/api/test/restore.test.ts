import { describe, expect, it } from 'vitest';
import { adminHarness } from './admin-harness.ts';

const { db, call, rendered } = adminHarness();

const artist = async (name: string) => (await call('POST', '/admin/persons', { name, profiles: ['artist'] })).body;
const deletedItem = async (entityId: string) => ((await call('GET', '/admin/deleted')).body.items as { revisionId: string; entityId: string; title: string; detail: string }[]).find((i) => i.entityId === entityId);

describe('restoring from history', () => {
    it('keeps an artist’s place in each exhibition’s artist order', async () => {
        const e = (await call('POST', '/admin/exhibitions', { kind: 'exhibition', title: 'Order Show', startsOn: '2027-01-01', endsOn: '2027-02-01' })).body;
        const first = await artist('Order First');
        const second = await artist('Order Second');
        await call('PUT', `/admin/persons/${first.id}/artist-profile/exhibitions`, { exhibitionIds: [e.id] });
        await call('PUT', `/admin/persons/${second.id}/artist-profile/exhibitions`, { exhibitionIds: [e.id] });
        const before = (await call('GET', `/admin/persons/${second.id}`)).body.artistProfile;
        await call('PUT', `/admin/persons/${second.id}/artist-profile`, { updatedAt: before.updatedAt, inventoryPrefix: 'ORD' });

        const revs = (await call('GET', `/admin/revisions?entity=artist_profile&id=${second.id}`)).body.items;
        expect((await call('POST', `/admin/revisions/${revs[0].id}/restore`)).status).toBe(200);
        const positions = await db.selectFrom('exhibition_artists').select(['artist_id', 'position']).where('exhibition_id', '=', e.id).orderBy('position').execute();
        expect(positions).toEqual([
            { artist_id: first.id, position: 0 },
            { artist_id: second.id, position: 1 },
        ]);
    });

    it('brings back deleted press with its artist links and republishes its exhibition', async () => {
        const e = (await call('POST', '/admin/exhibitions', { kind: 'exhibition', title: 'Press Show', startsOn: '2027-03-01', endsOn: '2027-04-01' })).body;
        const a = await artist('Pressed Artist');
        const press = (await call('POST', '/admin/press', { outlet: 'Gazette', title: 'Press Show review', url: 'https://example.com/press-show', publishedOn: '2027-03-10', exhibitionId: e.id })).body;
        await call('POST', `/admin/persons/${a.id}/artist-profile/press`, { pressId: press.id });
        expect((await call('DELETE', `/admin/press/${press.id}`)).status).toBe(204);

        const item = await deletedItem(press.id);
        expect(item).toMatchObject({ title: 'Press Show review', detail: 'Press · Gazette' });
        rendered.length = 0;
        expect((await call('POST', `/admin/revisions/${item!.revisionId}/restore`)).status).toBe(200);
        expect(rendered.flat()).toEqual(expect.arrayContaining(['/news', `/exhibitions/${e.slug}`]));
        const press2 = (await call('GET', `/admin/persons/${a.id}`)).body.artistProfile.press;
        expect(press2.map((p: { id: string; direct: boolean }) => [p.id, p.direct])).toEqual([[press.id, true]]);
        expect(await deletedItem(press.id)).toBeUndefined();
    });

    it('brings back a deleted person with their addresses and collector profile', async () => {
        const p = (await call('POST', '/admin/persons', { name: 'Gone Collector', profiles: ['collector'] })).body;
        await call('PUT', `/admin/persons/${p.id}/collector-profile`, { updatedAt: (await call('GET', `/admin/persons/${p.id}`)).body.collectorProfile.updatedAt, notes: 'Likes paper' });
        await call('POST', '/admin/addresses', { entity: 'person', entityId: p.id, label: 'Home', address: { line1: '1 Elm', city: 'Tulsa', country: 'US' } });
        await call('POST', '/admin/addresses', { entity: 'person', entityId: p.id, label: 'Office', address: { line1: '2 Oak', city: 'Paris', country: 'FR' } });
        expect((await call('DELETE', `/admin/persons/${p.id}`)).status).toBe(204);

        const item = await deletedItem(p.id);
        expect(item).toMatchObject({ title: 'Gone Collector', detail: 'Person' });
        expect((await call('POST', `/admin/revisions/${item!.revisionId}/restore`)).status).toBe(200);
        const back = (await call('GET', `/admin/persons/${p.id}`)).body;
        expect(back.collectorProfile).toMatchObject({ notes: 'Likes paper' });
        expect(back.addresses.map((l: any) => [l.label, l.isPrimary, l.address.city])).toEqual([
            ['Home', true, 'Tulsa'],
            ['Office', false, 'Paris'],
        ]);
    });

    it('lists deleted works', async () => {
        const a = await artist('Work Deleter');
        const w = (await call('POST', '/admin/works', { artistId: a.id, title: 'Lost Work' })).body;
        await call('DELETE', `/admin/works/${w.id}`);
        expect(await deletedItem(w.id)).toMatchObject({ title: 'Lost Work', detail: 'Work' });
    });
});
