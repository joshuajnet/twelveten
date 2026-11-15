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
            global: {},
        });
        expect(wrapper.vm.visibleSlides.map((s) => s.title)).toEqual(['one', 'three']);
    });

    it('wraps around when advancing past the last slide', () => {
        vi.useFakeTimers();
        const wrapper = mount(GallerySlideshow, {
            props: { slides: [slide('one'), slide('two')] },
            global: {},
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
            global: { stubs: { teleport: true } },
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

    it('leaves Scroll View with Escape or the close button, and only zooms from the Zoom button', async () => {
        vi.useFakeTimers();
        const wrapper = mount(GallerySlideshow, {
            props: { slides: [slide('one'), slide('two')] },
            global: { stubs: { teleport: true } },
            attachTo: document.body,
        });
        await wrapper.vm.toggleScrollView();
        await wrapper.vm.$nextTick();
        expect(wrapper.vm.scrollView).toBe(true);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(wrapper.vm.scrollView).toBe(false);

        wrapper.vm.toggleScrollView();
        await wrapper.vm.$nextTick();
        // Clicking a picture doesn't open zoom (people click to get out).
        await wrapper.findAll('.fixed img')[0].trigger('click');
        expect(wrapper.vm.zoomOpen).toBe(false);
        await wrapper.findAll('[data-testid="scroll-zoom"]')[1].trigger('click');
        expect(wrapper.vm.zoomOpen).toBe(true);
        // Escape while zoomed closes the zoom (in the viewer), not Scroll View.
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(wrapper.vm.scrollView).toBe(true);
        wrapper.vm.zoomOpen = false;
        await wrapper.vm.$nextTick();
        await wrapper.find('[data-testid="scroll-close"]').trigger('click');
        expect(wrapper.vm.scrollView).toBe(false);
        wrapper.unmount();
    });
});
