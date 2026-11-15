<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { formatDate, INVOICE_STATUSES, INVOICES_PAGE_SIZE, invoiceStatus } from '@twelveten/shared';
import { btnOutline, btnPrimary } from '@/admin/ui/buttons';
import { boApi } from './api';
import { money } from './format';
import StatusBadge from './StatusBadge.vue';
import Pagination from './Pagination.vue';
import { useListQuery, usePagedList } from './useListQuery';

/** Every invoice, newest first, filterable by status and searchable by number, collector or work. */
const { q, page, enumParam, setQuery, goToPage, search } = useListQuery();
const status = enumParam('status', invoiceStatus);

const { result, loading, error } = usePagedList(
    [q, status, page],
    () => boApi.invoices({ q: q.value, status: status.value, page: page.value, limit: INVOICES_PAGE_SIZE }),
    goToPage,
);
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
                        <td class="px-3 py-2"><StatusBadge :status="i.status" /></td>
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
