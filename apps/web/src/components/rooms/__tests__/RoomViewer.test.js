import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import RoomViewer from '../RoomViewer.vue';

const work = (id, artistId, artistName) => ({
    id,
    artistId,
    artistName,
    title: `Work ${id}`,
    dateText: '2025',
    medium: 'Oil on linen',
    dimensions: '40 x 30 cm',
    edition: 'Edition of 3',
    images: [],
    available: true,
    statusLabel: null,
    price: null,
});
const artist = (id, name) => ({ id, name, portrait: null, bioHtml: `<p>${name} bio</p>`, cvHtml: null, press: null });

const room = {
    title: 'Room',
    introHtml: null,
    works: [work('w1', 'a1', 'Ann'), work('w2', 'a2', 'Bo')],
    artists: [artist('a1', 'Ann'), artist('a2', 'Bo')],
    viewer: { name: 'Pat' },
    visitId: null,
};

const mountRoom = () => mount(RoomViewer, { props: { room, token: 'x'.repeat(43), preview: true }, global: { stubs: { teleport: true } } });

describe('RoomViewer', () => {
    it('opens on the grid, each tile with the full work details and About the artist', async () => {
        const wrapper = mountRoom();
        const tiles = wrapper.findAll('[data-testid="room-tile"]');
        expect(tiles).toHaveLength(2);
        for (const text of ['Ann', 'Work w1, 2025', 'Oil on linen', '40 x 30 cm', 'Edition of 3']) expect(tiles[0].text()).toContain(text);

        await tiles[1].findAll('button').find((b) => b.text() === 'About the artist').trigger('click');
        expect(wrapper.findAll('[data-testid="room-artist"]')).toHaveLength(1);
        await wrapper.find('[data-testid="back-to-work"]').trigger('click');
        expect(wrapper.findAll('[data-testid="room-tile"]')).toHaveLength(2);
    });

    it('has no “About the artist” when the room has a single artist', () => {
        const wrapper = mount(RoomViewer, { props: { room: { ...room, artists: [room.artists[0]] }, token: 'x'.repeat(43), preview: true }, global: { stubs: { teleport: true } } });
        expect(wrapper.findAll('button').filter((b) => b.text() === 'About the artist')).toHaveLength(0);
    });

    it('“About the artist” shows only that artist, with a way back to the works and to all artists', async () => {
        const wrapper = mountRoom();
        const about = () => wrapper.findAll('[data-testid="room-tile"]')[1].findAll('button').find((b) => b.text() === 'About the artist');
        await about().trigger('click');
        let artists = wrapper.findAll('[data-testid="room-artist"]');
        expect(artists).toHaveLength(1);
        expect(artists[0].text()).toContain('Bo bio');

        await wrapper.findAll('button').find((b) => b.text() === 'See all artists').trigger('click');
        expect(wrapper.findAll('[data-testid="room-artist"]')).toHaveLength(2);

        await wrapper.findAll('button').find((b) => b.text() === 'Works (2)').trigger('click');
        await about().trigger('click');
        await wrapper.find('[data-testid="back-to-work"]').trigger('click');
        expect(wrapper.findAll('[data-testid="room-tile"]')).toHaveLength(2);
    });
});
