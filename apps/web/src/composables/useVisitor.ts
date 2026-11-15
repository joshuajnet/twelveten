import { ref } from 'vue';
import { api } from '@/api/client';

/** Who this browser is across the public site (loaded once per page load, shared). */
const name = ref<string | null>(null);
let loading: Promise<void> | null = null;

export function useVisitor() {
    function load(force = false) {
        if (!loading || force)
            loading = api.visitor().then(
                (v) => void (name.value = v?.name ?? null),
                () => void (name.value = null),
            );
        return loading;
    }
    async function forget() {
        await api.forgetVisitor().catch(() => {});
        name.value = null;
    }
    const set = (n: string | null) => (name.value = n);
    return { name, load, forget, set };
}
