<script setup lang="ts">
import { ref, watch } from 'vue';
import Dialog from './ui/Dialog.vue';
import { adminApi, errorMessage } from './api';
import { toast } from './state';
import { resetInfiniteList } from '@/composables/useInfiniteList';
import { btnOutline } from './ui/buttons';

/** Recently deleted exhibitions, fairs, news posts and press items, with restore. */
const open = defineModel<boolean>('open', { required: true });
type Item = Awaited<ReturnType<typeof adminApi.deleted>>[number];
const items = ref<Item[]>([]);
const loading = ref(false);

watch(open, async (o) => {
    if (!o) return;
    loading.value = true;
    try {
        items.value = await adminApi.deleted();
    } catch (e) {
        toast(errorMessage(e), 'error');
    } finally {
        loading.value = false;
    }
});

const fmt = (iso: string) => new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

async function restore(item: Item) {
    try {
        await adminApi.restore(item.revisionId);
        items.value = items.value.filter((i) => i !== item);
        resetInfiniteList('news');
        resetInfiniteList('press');
        toast(`Restored “${item.title}”`, 'success');
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}
</script>

<template>
    <Dialog v-model:open="open" title="Recently deleted" description="Restoring brings an item back exactly as it was, including an exhibition’s slides.">
        <p v-if="loading" class="text-sm text-slate-500">Loading…</p>
        <p v-else-if="!items.length" class="text-sm text-slate-500">Nothing has been deleted.</p>
        <ul v-else class="divide-y divide-slate-100 text-sm">
            <li v-for="item in items" :key="item.revisionId" class="flex items-center justify-between gap-3 py-2">
                <span>
                    <span class="font-medium">{{ item.title }}</span>
                    <span class="block text-xs text-slate-500">{{ item.detail }} · deleted {{ fmt(item.deletedAt) }}<template v-if="item.userName"> by {{ item.userName }}</template></span>
                </span>
                <button type="button" :class="btnOutline" @click="restore(item)">Restore</button>
            </li>
        </ul>
    </Dialog>
</template>
