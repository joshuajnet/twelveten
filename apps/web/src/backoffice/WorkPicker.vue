<script setup lang="ts">
import { ref, watch } from 'vue';
import type { NumberedPage, WorkStatus, WorkSummary } from '@twelveten/shared';
import { errorMessage } from '@/admin/api';
import { toast } from '@/admin/state';
import { boApi } from './api';
import { money } from './format';
import Pagination from './Pagination.vue';
import StatusBadge from './StatusBadge.vue';
import ArtImage from '@/components/ArtImage.vue';

/**
 * Search the whole inventory (any artists) and tick works. `blocked` explains why a work can't be
 * ticked ('' when it can). The parent owns the selection.
 */
const props = withDefaults(
    defineProps<{
        selectedIds: string[];
        blocked?: (w: WorkSummary) => string;
        initialStatus?: WorkStatus | '';
        pageSize?: number;
        testid?: string;
    }>(),
    { blocked: () => '', initialStatus: 'available', pageSize: 12, testid: 'work-picker-results' },
);
const emit = defineEmits<{ toggle: [work: WorkSummary] }>();

const q = ref('');
const status = ref<WorkStatus | ''>(props.initialStatus);
const page = ref(1);
const result = ref<NumberedPage<WorkSummary> | null>(null);
const loading = ref(false);
let seq = 0;
async function load() {
    const mine = ++seq;
    loading.value = true;
    try {
        const r = await boApi.works({ q: q.value.trim(), status: status.value || null, page: page.value, limit: props.pageSize });
        if (mine === seq) result.value = r;
    } catch (e) {
        if (mine === seq) toast(errorMessage(e), 'error');
    } finally {
        if (mine === seq) loading.value = false;
    }
}
let timer: ReturnType<typeof setTimeout> | undefined;
watch(q, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
        page.value = 1;
        void load();
    }, 250);
});
watch(status, () => {
    page.value = 1;
    void load();
});
watch(page, () => void load());
void load();

const isSelected = (w: WorkSummary) => props.selectedIds.includes(w.id);
function toggle(w: WorkSummary) {
    if (isSelected(w) || !props.blocked(w)) emit('toggle', w);
}
</script>

<template>
    <div>
        <div class="mb-3 grid gap-2 sm:grid-cols-[1fr_12rem]">
            <label class="block">
                <span class="block text-xs font-medium text-slate-600">Search</span>
                <input
                    v-model="q"
                    type="search"
                    aria-label="Search works"
                    placeholder="Artist, title, inventory no.…"
                    class="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-sky-700 focus:outline-none"
                />
            </label>
            <label class="block">
                <span class="block text-xs font-medium text-slate-600">Show</span>
                <select v-model="status" aria-label="Show works" class="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm">
                    <option value="available">Available</option>
                    <option value="on_hold">On hold</option>
                    <option value="">All works</option>
                </select>
            </label>
        </div>
        <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" :aria-busy="loading" :data-testid="testid">
            <li v-for="w in result?.items ?? []" :key="w.id">
                <label
                    class="block h-full cursor-pointer overflow-hidden rounded-md border bg-white text-xs leading-snug"
                    :class="[isSelected(w) ? 'border-sky-700 ring-2 ring-sky-700/30' : 'border-slate-200 hover:border-sky-700', blocked(w) && !isSelected(w) ? 'cursor-not-allowed opacity-50' : '']"
                    :title="blocked(w)"
                >
                    <div class="relative flex aspect-square items-center justify-center bg-slate-100">
                        <ArtImage sizes="200px" v-if="w.image" :src="w.image.url" :alt="w.image.alt" class="h-full w-full object-contain" />
                        <span v-else class="text-slate-400">No image</span>
                        <input
                            type="checkbox"
                            class="absolute left-2 top-2 h-4 w-4"
                            :checked="isSelected(w)"
                            :disabled="Boolean(blocked(w)) && !isSelected(w)"
                            :aria-label="`${w.artistName}, ${w.title || 'Untitled'}`"
                            @change="toggle(w)"
                        />
                    </div>
                    <div class="space-y-0.5 p-2">
                        <div class="text-slate-600">{{ w.artistName }}</div>
                        <div class="font-medium italic">{{ w.title || 'Untitled' }}<span v-if="w.dateText" class="not-italic">, {{ w.dateText }}</span></div>
                        <div class="flex items-center justify-between gap-1 pt-0.5">
                            <StatusBadge :status="w.status" />
                            <span class="font-medium tabular-nums">{{ w.priceCents === null ? 'No price' : money(w.priceCents, w.currency) }}</span>
                        </div>
                        <div v-if="blocked(w)" class="text-[11px] text-slate-500">{{ blocked(w) }}</div>
                    </div>
                </label>
            </li>
        </ul>
        <p v-if="result && !result.items.length" class="py-6 text-center text-sm text-slate-500">No works match.</p>
        <Pagination v-if="result" :page="page" :page-size="result.pageSize" :total="result.total" label="works" @page="(n) => (page = n)" />
    </div>
</template>
