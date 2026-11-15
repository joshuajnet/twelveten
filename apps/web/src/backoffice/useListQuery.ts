import { computed, ref, shallowRef, watch, type Ref, type WatchSource } from 'vue';
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router';
import type { NumberedPage } from '@twelveten/shared';
import { errorMessage } from '@/admin/api';

/**
 * A list page's filters, search and page number, kept in the URL so they survive reloads and back
 * navigation. The search box is debounced into `?q=` and follows the URL when it changes.
 */
export function useListQuery() {
    const route = useRoute();
    const router = useRouter();

    const q = computed(() => String(route.query.q ?? ''));
    const page = computed(() => Math.max(1, Number.parseInt(String(route.query.page ?? '1'), 10) || 1));

    /** A string query parameter, or null. */
    const param = (key: string) => computed(() => (route.query[key] ? String(route.query[key]) : null));

    /** A query parameter that must be one of the schema's values (null otherwise). */
    const enumParam = <T>(key: string, schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } }) =>
        computed<T | null>(() => {
            const parsed = schema.safeParse(route.query[key]);
            return parsed.success ? parsed.data : null;
        });

    /** Change filters (back to page 1 unless the patch sets the page). */
    function setQuery(patch: Record<string, string | null>) {
        const query: LocationQueryRaw = { ...route.query, page: null, ...patch };
        for (const [k, v] of Object.entries(query)) if (v === null || v === '') delete query[k];
        void router.replace({ query });
    }

    function goToPage(n: number) {
        setQuery({ page: n > 1 ? String(n) : null });
        window.scrollTo({ top: 0 });
    }

    const search = ref(q.value);
    let timer: ReturnType<typeof setTimeout> | undefined;
    watch(search, (v) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            if (v.trim() !== q.value) setQuery({ q: v.trim() || null });
        }, 250);
    });
    watch(q, (v) => {
        if (v !== search.value.trim()) search.value = v;
    });

    return { route, q, page, param, enumParam, setQuery, goToPage, search };
}

/**
 * Load one numbered page whenever `source` changes. Only the latest request counts; a page past the
 * end (e.g. after deletions) asks for the last page instead.
 */
export function usePagedList<T>(source: WatchSource | WatchSource[], fetch: () => Promise<NumberedPage<T>>, toPage: (page: number) => void) {
    const result = shallowRef<NumberedPage<T> | null>(null) as Ref<NumberedPage<T> | null>;
    const loading = ref(false);
    const error = ref('');
    let seq = 0;

    async function load() {
        const mine = ++seq;
        loading.value = true;
        error.value = '';
        try {
            const r = await fetch();
            if (mine !== seq) return;
            result.value = r;
            const last = Math.max(1, Math.ceil(r.total / r.pageSize));
            if (!r.items.length && r.page > last) toPage(last);
        } catch (e) {
            if (mine === seq) error.value = errorMessage(e);
        } finally {
            if (mine === seq) loading.value = false;
        }
    }
    watch(source, load, { immediate: true });

    return { result, loading, error, reload: load };
}
