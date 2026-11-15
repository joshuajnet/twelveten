<script setup lang="ts">
import { ref, watch } from 'vue';
import { INQUIRIES_PAGE_SIZE, type InquirySummary } from '@twelveten/shared';
import Dialog from '@/admin/ui/Dialog.vue';
import { errorMessage } from '@/admin/api';
import { toast } from '@/admin/state';
import { btnDanger, btnOutline } from '@/admin/ui/buttons';
import { boApi } from '../api';
import { inquiriesChanged, unseenInquiries } from '../nav';
import Pagination from '../Pagination.vue';
import { useListQuery, usePagedList } from '../useListQuery';
import InquiryRow from './InquiryRow.vue';

/** Every inquiry, newest first; New shows the ones not dismissed yet. */
const { q, page, param, setQuery, goToPage, search } = useListQuery();
const status = param('status');
const { result, loading, error, reload } = usePagedList(
    [q, status, page],
    () => boApi.inquiries({ q: q.value, status: status.value === 'new' ? 'new' : 'all', page: page.value, limit: INQUIRIES_PAGE_SIZE }),
    goToPage,
);
const refreshAlert = () => boApi.unseenInquiries().then((u) => (unseenInquiries.value = u));
watch(inquiriesChanged, () => void reload());

async function dismiss(i: InquirySummary) {
    try {
        await boApi.dismissInquiry(i.id);
        await Promise.all([reload(), refreshAlert()]);
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}
const removing = ref<InquirySummary | null>(null);
async function remove() {
    const i = removing.value;
    removing.value = null;
    if (!i) return;
    try {
        await boApi.deleteInquiry(i.id);
        toast('Inquiry deleted', 'success', 1500);
        await Promise.all([reload(), refreshAlert()]);
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}
</script>

<template>
    <div>
        <div class="mb-4 flex flex-wrap items-center gap-3">
            <h1 class="text-xl font-semibold" tabindex="-1">Inquiries</h1>
        </div>
        <div class="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label class="block">
                <span class="block text-xs font-medium text-slate-600">Search</span>
                <input v-model="search" type="search" aria-label="Search inquiries" placeholder="Person, work, note…" class="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-sky-700 focus:outline-none" />
            </label>
            <label class="block">
                <span class="block text-xs font-medium text-slate-600">Show</span>
                <select :value="status ?? ''" aria-label="Show" class="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm" @change="setQuery({ status: ($event.target as HTMLSelectElement).value || null })">
                    <option value="">All</option>
                    <option value="new">New (not dismissed)</option>
                </select>
            </label>
        </div>
        <p v-if="error" class="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-800">{{ error }}</p>
        <div class="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white px-3" :aria-busy="loading">
            <InquiryRow v-for="i in result?.items ?? []" :key="i.id" :inquiry="i" show-person @dismiss="dismiss(i)" @remove="removing = i" />
            <p v-if="result && !result.items.length" class="py-10 text-center text-sm text-slate-500">{{ q || status ? 'No inquiries match.' : 'No inquiries yet.' }}</p>
        </div>
        <Pagination v-if="result" class="mt-4" :page="result.page" :page-size="result.pageSize" :total="result.total" label="inquiries" @page="goToPage" />

        <Dialog :open="Boolean(removing)" title="Delete this inquiry?" description="Use this for spam or mistakes. It can’t be undone." @update:open="(o) => !o && (removing = null)">
            <template #footer>
                <button type="button" :class="btnOutline" @click="removing = null">Cancel</button>
                <button type="button" :class="btnDanger" class="!bg-red-700 !text-white" @click="remove">Delete</button>
            </template>
        </Dialog>
    </div>
</template>
