import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, withDirectives } from 'vue';
import { mount } from '@vue/test-utils';
import { useRoomTracker } from '../useRoomTracker';

const W1 = '00000000-0000-4000-8000-000000000001';
const W2 = '00000000-0000-4000-8000-000000000002';

let observed;
let tracker;
let wrapper;

beforeEach(() => {
    vi.useFakeTimers();
    observed = null;
    vi.stubGlobal(
        'IntersectionObserver',
        class {
            constructor(cb) {
                observed = cb;
            }
            observe() {}
            unobserve() {}
            disconnect() {}
        },
    );
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ status: 204 })));
    const Room = defineComponent({
        setup() {
            tracker = useRoomTracker({ token: 'x'.repeat(43), visitId: '00000000-0000-4000-8000-0000000000aa' });
            return () => h('div', [W1, W2].map((id) => withDirectives(h('div', { id }), [[tracker.vTrackWork, id]])));
        },
    });
    wrapper = mount(Room, { attachTo: document.body });
});
afterEach(() => {
    wrapper.unmount();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

/** Both works at least half on screen. */
const bothInView = () => observed([W1, W2].map((id) => ({ target: document.getElementById(id), intersectionRatio: 1 })));
/** Send what was recorded and return the view time per work. */
function sentViewMs() {
    tracker.flush();
    const batch = JSON.parse(fetch.mock.calls.at(-1)[1].body);
    return Object.fromEntries(batch.works.map((w) => [w.workId, w.viewMs]));
}

describe('useRoomTracker view time', () => {
    it('shares each second between the works on screen', () => {
        bothInView();
        vi.advanceTimersByTime(4000);
        expect(sentViewMs()).toEqual({ [W1]: 2000, [W2]: 2000 });
    });

    it('counts nothing while scrolling, and starts again a second after it stops', () => {
        bothInView();
        for (let i = 0; i < 5; i++) {
            window.dispatchEvent(new Event('scroll'));
            vi.advanceTimersByTime(500);
        }
        expect(fetch).not.toHaveBeenCalled();
        tracker.flush();
        // Only active time so far: no work collected anything mid-scroll.
        const batch = JSON.parse(fetch.mock.calls.at(-1)[1].body);
        expect(batch.works).toEqual([]);
        expect(batch.activeMs).toBeGreaterThan(0);

        vi.advanceTimersByTime(3000);
        const ms = sentViewMs();
        expect(ms[W1]).toBeGreaterThanOrEqual(500);
        expect(ms[W1]).toBeLessThanOrEqual(1500);
        expect(ms[W1]).toBe(ms[W2]);
    });
});
