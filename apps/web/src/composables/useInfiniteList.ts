import { onBeforeUnmount, onMounted, reactive, ref, watch, type Ref } from 'vue';
import type { Page } from '@twelveten/shared';

interface ListState<T> {
    items: T[];
    nextCursor: string | null;
    done: boolean;
    loading: boolean;
    error: Error | null;
    /** Scroll position of the page when the list was last left, for restoring on back navigation. */
    scrollY: number;
    started: boolean;
}

/** Lists keep their loaded items for the session, so returning to a page restores them. */
const stores = new Map<string, ListState<unknown>>();

export function resetInfiniteList(key: string) {
    stores.delete(key);
}

export interface InfiniteListOptions<T> {
    key: string;
    fetchPage: (cursor: string | null) => Promise<Page<T>>;
    /** Element at the end of the list; loading starts when it comes into view. */
    sentinel: Ref<HTMLElement | null>;
    rootMargin?: string;
}

/**
 * Infinite loading: fetches the next batch when the sentinel approaches the viewport.
 * Guards against concurrent fetches, stops at the end, and exposes `retry` and `loadMore`
 * (for the visible "Load more" button used by keyboard users).
 */
export function useInfiniteList<T>(opts: InfiniteListOptions<T>) {
    if (!stores.has(opts.key)) {
        stores.set(opts.key, { items: [], nextCursor: null, done: false, loading: false, error: null, scrollY: 0, started: false });
    }
    const state = reactive(stores.get(opts.key)!) as ListState<T>;
    stores.set(opts.key, state as ListState<unknown>);
    const announcement = ref('');
    let observer: IntersectionObserver | null = null;

    async function loadMore() {
        if (state.loading || state.done) return;
        state.loading = true;
        state.error = null;
        try {
            const page = await opts.fetchPage(state.started ? state.nextCursor : null);
            state.started = true;
            state.items.push(...page.items);
            state.nextCursor = page.nextCursor;
            state.done = page.nextCursor === null;
            announcement.value = page.items.length ? `${page.items.length} more loaded` : '';
        } catch (e) {
            state.error = e as Error;
        } finally {
            state.loading = false;
        }
        // If the sentinel is still visible (short page), keep going.
        if (!state.done && !state.error && opts.sentinel.value && isVisible(opts.sentinel.value)) void loadMore();
    }

    function isVisible(el: HTMLElement) {
        const r = el.getBoundingClientRect();
        return r.top < window.innerHeight + 600 && r.bottom > -600;
    }

    function prepend(item: T) {
        state.items.unshift(item);
    }

    function replace(match: (item: T) => boolean, next: T | null) {
        const i = state.items.findIndex(match);
        if (i === -1) return;
        if (next) state.items.splice(i, 1, next);
        else state.items.splice(i, 1);
    }

    onMounted(() => {
        if (state.scrollY) requestAnimationFrame(() => window.scrollTo(0, state.scrollY));
        if (typeof IntersectionObserver !== 'undefined') {
            observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && void loadMore(), {
                rootMargin: opts.rootMargin ?? '600px 0px',
            });
            watch(
                opts.sentinel,
                (el, old) => {
                    if (old) observer?.unobserve(old);
                    if (el) observer?.observe(el);
                },
                { immediate: true },
            );
        }
        if (!state.started) void loadMore();
    });

    onBeforeUnmount(() => {
        state.scrollY = window.scrollY;
        observer?.disconnect();
    });

    watch(
        () => state.done,
        (done) => done && observer?.disconnect(),
    );

    return { state, loadMore, retry: loadMore, prepend, replace, announcement };
}
