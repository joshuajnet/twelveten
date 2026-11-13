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
});
