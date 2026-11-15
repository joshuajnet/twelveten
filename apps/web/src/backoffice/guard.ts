import { onBeforeUnmount, onMounted, type Ref } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate } from 'vue-router';

const MESSAGE = 'You have unsaved changes. Leave without saving?';

/** Warn before leaving (in-app navigation, reload or closing the tab) while `dirty` is true. */
export function useUnsavedGuard(...dirty: Ref<boolean>[]) {
    const isDirty = () => dirty.some((d) => d.value);
    const confirmLeave = () => !isDirty() || window.confirm(MESSAGE);
    onBeforeRouteLeave(confirmLeave);
    onBeforeRouteUpdate((to, from) => (to.params.id !== from.params.id ? confirmLeave() : true));
    const onUnload = (e: BeforeUnloadEvent) => {
        if (!isDirty()) return;
        e.preventDefault();
        e.returnValue = '';
    };
    onMounted(() => window.addEventListener('beforeunload', onUnload));
    onBeforeUnmount(() => window.removeEventListener('beforeunload', onUnload));
}
