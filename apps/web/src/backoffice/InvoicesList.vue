<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter, type LocationQueryRaw } from 'vue-router';
import { formatDate, INVOICE_STATUSES, INVOICES_PAGE_SIZE, invoiceStatus, type InvoiceSummary, type NumberedPage } from '@twelveten/shared';
import { errorMessage } from '@/admin/api';
import { btnOutline, btnPrimary } from '@/admin/ui/buttons';
import { boApi } from './api';
import { money } from './format';
import InvoiceStatusBadge from './InvoiceStatusBadge.vue';
import Pagination from './Pagination.vue';

/** Every invoice, newest first, filterable by status and searchable by number, collector or work. */
const route = useRoute();
const router = useRouter();

const q = computed(() => String(route.query.q ?? ''));
const status = computed(() => {
    const p = invoiceStatus.safeParse(route.query.status);
    return p.success ? p.data : null;
});
const page = computed(() => Math.max(1, Number.parseInt(String(route.query.page ?? '1'), 10) || 1));

function setQuery(patch: Record<string, string | null>) {
    const query: LocationQueryRaw = { ...route.query, page: null, ...patch };
    for (const [k, v] of Object.entries(query)) if (v === null || v === '') delete query[k];
    void router.replace({ query });
}

const search = ref(q.value);
let timer: ReturnType<typeof setTimeout> | undefined;
watch(search, (v) => {
    clearTimeout(timer);
    timer = setTimeout(() => setQuery({ q: v.trim() || null }), 250);
});

const result = ref<NumberedPage<InvoiceSummary> | null>(null);
const loading = ref(false);
const error = ref('');
let seq = 0;
async function load() {
    const mine = ++seq;
    loading.value = true;
    error.value = '';
    try {
        const r = await boApi.invoices({ q: q.value, status: status.value, page: page.value, limit: INVOICES_PAGE_SIZE });
        if (mine !== seq) return;
        result.value = r;
        const last = Math.max(1, Math.ceil(r.total / r.pageSize));
        if (!r.items.length && page.value > last) goToPage(last);
    } catch (e) {
        if (mine === seq) error.value = errorMessage(e);
    } finally {
        if (mine === seq) loading.value = false;
    }
}
watch([q, status, page], load, { immediate: true });

function goToPage(n: number) {
    setQuery({ page: n > 1 ? String(n) : null });
    window.scrollTo({ top: 0 });
}
</script>

<template>
    <div>
        <div class="mb-4 flex flex-wrap items-center gap-3">
            <h1 class="text-xl font-semibold">Invoices</h1>
            <span class="flex-1" />
            <RouterLink :to="{ name: 'bo-invoice-settings' }" :class="btnOutline">Invoice settings</RouterLink>
            <RouterLink :to="{ name: 'bo-invoice-new' }" :class="btnPrimary">+ New invoice</RouterLink>
        </div>

        <div class="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label class="block">
                <span class="block text-xs font-medium text-slate-600">Search</span>
                <input
                    v-model="search"
                    type="search"
                    aria-label="Search invoices"
                    placeholder="Number, collector, work…"
                    class="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-sky-700 focus:outline-none"
                />
            </label>
            <label class="block">
                <span class="block text-xs font-medium text-slate-600">Status</span>
                <select :value="status ?? ''" aria-label="Status" class="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm" @change="setQuery({ status: ($event.target as HTMLSelectElement).value || null })">
                    <option value="">Any status</option>
                    <option v-for="(label, key) in INVOICE_STATUSES" :key="key" :value="key">{{ label }}</option>
                </select>
            </label>
        </div>

        <p v-if="error" class="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-800">{{ error }}</p>
        <div class="overflow-x-auto rounded-md border border-slate-200 bg-white" :aria-busy="loading">
            <table class="w-full min-w-[40rem] text-left text-sm">
                <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                        <th scope="col" class="px-3 py-2 font-medium">Invoice</th>
                        <th scope="col" class="px-3 py-2 font-medium">Date</th>
                        <th scope="col" class="px-3 py-2 font-medium">Collector</th>
                        <th scope="col" class="px-3 py-2 font-medium">Works</th>
                        <th scope="col" class="px-3 py-2 text-right font-medium">Total</th>
                        <th scope="col" class="px-3 py-2 text-right font-medium">Balance</th>
                        <th scope="col" class="px-3 py-2 font-medium">Status</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    <tr v-for="i in result?.items ?? []" :key="i.id" class="relative hover:bg-slate-50">
                        <td class="px-3 py-2">
                            <RouterLink :to="{ name: 'bo-invoice', params: { id: i.id } }" class="font-medium text-sky-900 after:absolute after:inset-0 hover:underline">{{ i.number }}</RouterLink>
                        </td>
                        <td class="whitespace-nowrap px-3 py-2 text-slate-600">{{ formatDate(i.issuedOn) }}</td>
                        <td class="px-3 py-2">{{ i.personName }}</td>
                        <td class="max-w-56 truncate px-3 py-2 italic text-slate-700">{{ i.titles }}</td>
                        <td class="px-3 py-2 text-right tabular-nums">{{ money(i.totalCents, i.currency) }}</td>
                        <td class="px-3 py-2 text-right tabular-nums">{{ i.balanceCents ? money(i.balanceCents, i.currency) : '—' }}</td>
                        <td class="px-3 py-2"><InvoiceStatusBadge :status="i.status" /></td>
                    </tr>
                    <tr v-if="result && !result.items.length">
                        <td colspan="7" class="px-3 py-8 text-center text-slate-500">No invoices match.</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <Pagination v-if="result" :page="page" :page-size="result.pageSize" :total="result.total" label="invoices" @page="goToPage" />
    </div>
</template>
