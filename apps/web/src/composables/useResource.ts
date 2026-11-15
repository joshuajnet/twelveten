import { ref, shallowRef, watch, type Ref, type WatchSource } from 'vue';
import { ApiError } from '@/api/client';

/** Loads data when `source` changes; exposes loading / not-found / error state. */
export function useResource<T, S>(source: WatchSource<S>, load: (value: S) => Promise<T>) {
    const data = shallowRef<T | null>(null) as Ref<T | null>;
    const loading = ref(true);
    const notFound = ref(false);
    const error = ref<Error | null>(null);
    let token = 0;

    async function run(value: S) {
        const mine = ++token;
        loading.value = true;
        notFound.value = false;
        error.value = null;
        try {
            const result = await load(value);
            if (mine === token) data.value = result;
        } catch (e) {
            if (mine !== token) return;
            data.value = null;
            if (e instanceof ApiError && e.status === 404) notFound.value = true;
            else error.value = e as Error;
        } finally {
            if (mine === token) loading.value = false;
        }
    }

    watch(source, (v) => void run(v), { immediate: true });
    return { data, loading, notFound, error, reload: () => run(typeof source === 'function' ? (source as () => S)() : (source as Ref<S>).value) };
}
