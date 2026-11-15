import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import RoomViewer from '../RoomViewer.vue';

const work = (id, artistId, artistName) => ({
    id,
    artistId,
    artistName,
    title: `Work ${id}`,
    dateText: '2025',
    medium: null,
    dimensions: null,
    edition: null,
    images: [],
    available: true,
    statusLabel: null,
    price: null,
});
const artist = (id, name) => ({ id, name, portrait: null, bioHtml: `<p>${name} bio</p>`, cvHtml: null, press: null });

const room = {
    title: 'Room',
    introHtml: null,
    inquiryEmail: 'gallery@example.com',
    works: [work('w1', 'a1', 'Ann'), work('w2', 'a2', 'Bo')],
    artists: [artist('a1', 'Ann'), artist('a2', 'Bo')],
    viewer: { name: 'Pat' },
    visitId: null,
};

describe('RoomViewer', () => {
    it('“About the artist” shows only that artist, with a way back to the work and to all artists', async () => {
        const wrapper = mount(RoomViewer, { props: { room, token: 'x'.repeat(43), preview: true }, global: { stubs: { teleport: true } } });
        await wrapper.find('[aria-label="Next work"]').trigger('click');
        await wrapper.findAll('button').find((b) => b.text() === 'About the artist').trigger('click');
        let artists = wrapper.findAll('[data-testid="room-artist"]');
        expect(artists).toHaveLength(1);
        expect(artists[0].text()).toContain('Bo bio');

        await wrapper.findAll('button').find((b) => b.text() === 'See all artists').trigger('click');
        expect(wrapper.findAll('[data-testid="room-artist"]')).toHaveLength(2);

        await wrapper.findAll('button').find((b) => b.text() === 'Works (2)').trigger('click');
        await wrapper.findAll('button').find((b) => b.text() === 'About the artist').trigger('click');
        await wrapper.find('[data-testid="back-to-work"]').trigger('click');
        expect(wrapper.find('[data-testid="room-slide"]').text()).toContain('Work w2');
    });
});
