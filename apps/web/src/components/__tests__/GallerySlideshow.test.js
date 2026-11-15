import { describe, it, expect, afterEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import GallerySlideshow from '../GallerySlideshow.vue';

const slide = (title, extra = {}) => ({
    image: `/images/test/${title}.jpg`,
    author: 'Artist',
    title,
    date: null,
    dimensions: null,
    media: null,
    credit: null,
    hidden: false,
    available: false,
    ...extra,
});

describe('GallerySlideshow', () => {
    afterEach(() => vi.useRealTimers());

    it('only shows slides that are not hidden', () => {
        vi.useFakeTimers();
        const wrapper = mount(GallerySlideshow, {
            props: { slides: [slide('one'), slide('two', { hidden: true }), slide('three')] },
            global: { directives: { lazy: {} } },
        });
        expect(wrapper.vm.visibleSlides.map((s) => s.title)).toEqual(['one', 'three']);
    });

    it('wraps around when advancing past the last slide', () => {
        vi.useFakeTimers();
        const wrapper = mount(GallerySlideshow, {
            props: { slides: [slide('one'), slide('two')] },
            global: { directives: { lazy: {} } },
        });
        wrapper.vm.next();
        expect(wrapper.vm.indexVisible).toBe(1);
        wrapper.vm.next();
        expect(wrapper.vm.indexVisible).toBe(0);
    });

    it('opens the zoom viewer on the current image slide and returns to the last one viewed', async () => {
        vi.useFakeTimers();
        const wrapper = mount(GallerySlideshow, {
            props: { slides: [slide('one'), slide('video', { image: null, video: '/v.mp4' }), slide('three')] },
            global: { directives: { lazy: {} }, stubs: { teleport: true } },
        });
        wrapper.vm.next();
        await wrapper.vm.$nextTick();
        // A video slide has nothing to zoom.
        expect(wrapper.find('[data-testid="slideshow-zoom"]').exists()).toBe(false);
        wrapper.vm.next();
        await wrapper.vm.$nextTick();
        await wrapper.find('[data-testid="slideshow-zoom"]').trigger('click');
        expect(wrapper.vm.zoomOpen).toBe(true);
        expect(wrapper.vm.zoomImages[wrapper.vm.zoomIndex].url).toBe('/images/test/three.jpg');
        expect(wrapper.vm.paused).toBe(true);
        wrapper.vm.zoomIndex = 0;
        wrapper.vm.zoomOpen = false;
        await wrapper.vm.$nextTick();
        expect(wrapper.vm.indexVisible).toBe(0);
    });
});
