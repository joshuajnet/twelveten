<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import { formatDate, PEOPLE_PAGE_SIZE, type PersonBrief, type PersonDuplicate } from '@twelveten/shared';
import { errorMessage } from '@/admin/api';
import { toast } from '@/admin/state';
import { btnGhost, btnOutline } from '@/admin/ui/buttons';
import { boApi } from './api';
import { duplicateCount } from './nav';
import Pagination from './Pagination.vue';
import MergeDialog from './MergeDialog.vue';
import { useListQuery, usePagedList } from './useListQuery';

/** People who may be the same person, best match first: merge them or mark them as different. */
const { page, goToPage } = useListQuery();
const { result, loading, error, reload } = usePagedList([page], () => boApi.duplicates(page.value), goToPage);

const merging = ref<{ open: boolean; a: string | null; b: string | null }>({ open: false, a: null, b: null });

async function dismiss(d: PersonDuplicate) {
    try {
        await boApi.dismissDuplicate(d.a.id, d.b.id);
        duplicateCount.value = Math.max(0, duplicateCount.value - 1);
        toast('Marked as different people', 'success', 1500);
        await reload();
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}

const sub = (p: PersonBrief) => [p.email, p.phone].filter(Boolean).join(' · ') || 'No contact details';
</script>

<template>
    <div>
        <div class="mb-1 flex flex-wrap items-center gap-3">
            <h1 class="text-xl font-semibold">Possible duplicates</h1>
        </div>
        <p class="mb-4 text-sm text-slate-600">
            People who share an email, phone or a similar name. Viewing room sign-ups aren’t verified, so the same collector can appear more than once.
        </p>

        <p v-if="error" class="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-800">{{ error }}</p>
        <p v-if="result && !result.items.length" class="rounded-md border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
            No possible duplicates.
        </p>
        <ul class="space-y-3" :aria-busy="loading">
            <li v-for="d in result?.items ?? []" :key="`${d.a.id}:${d.b.id}`" class="rounded-md border border-slate-200 bg-white p-3" data-testid="duplicate-pair">
                <div class="mb-2 flex flex-wrap items-center gap-1.5">
                    <span v-for="r in d.reasons" :key="r" class="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-inset ring-amber-700/20">{{ r }}</span>
                    <span class="text-xs text-slate-500">Match {{ d.score }}%</span>
                    <span class="flex-1" />
                    <button type="button" :class="btnGhost" @click="dismiss(d)">Not the same</button>
                    <button type="button" :class="btnOutline" @click="merging = { open: true, a: d.a.id, b: d.b.id }">Compare &amp; merge…</button>
                </div>
                <div class="grid gap-3 sm:grid-cols-2">
                    <div v-for="p in [d.a, d.b]" :key="p.id" class="min-w-0 rounded bg-slate-50 px-3 py-2 text-sm">
                        <RouterLink :to="{ name: 'bo-person', params: { id: p.id } }" class="font-medium text-sky-900 hover:underline">{{ p.name }}</RouterLink>
                        <div class="truncate text-slate-600">{{ sub(p) }}</div>
                        <div class="mt-0.5 flex flex-wrap gap-1 text-xs text-slate-500">
                            <span>Added {{ formatDate(p.createdAt.slice(0, 10)) }}</span>
                            <span v-for="k in p.profiles" :key="k" class="rounded bg-sky-50 px-1 text-sky-900">{{ k }}</span>
                            <span v-if="p.source" class="rounded bg-violet-50 px-1 text-violet-900">{{ p.source === 'viewing_room' ? 'from a viewing room' : 'from an inquiry' }}</span>
                        </div>
                    </div>
                </div>
            </li>
        </ul>
        <Pagination v-if="result && result.total > PEOPLE_PAGE_SIZE" class="mt-4" :page="result.page" :page-size="result.pageSize" :total="result.total" label="pairs" @page="goToPage" />

        <MergeDialog v-model:open="merging.open" :first-id="merging.a" :second-id="merging.b" />
    </div>
</template>
