<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { SHIPPING_LABELS_MAX, WORK_LOCATIONS, WORK_STATUSES, workLocation, workStatus, type PersonSummary, type ShippingLabelSource, type WorkStatus } from '@twelveten/shared';
import MultiSelect from '@/admin/ui/MultiSelect.vue';
import { btnOutline, btnPrimary } from '@/admin/ui/buttons';
import PersonPicker from './PersonPicker.vue';
import InventoryTable from './InventoryTable.vue';
import ShippingLabelDialog from './ShippingLabelDialog.vue';
import { useListQuery } from './useListQuery';

/** Works across artists, filterable by artist, status (Available and On hold unless chosen otherwise) and location. */
const { q, page, param, enumParam, listParam, setQuery, goToPage, search } = useListQuery();
const artist = param('artist');
const artistName = param('artistName');
const DEFAULT_STATUSES: WorkStatus[] = ['available', 'on_hold'];
const statuses = listParam('status', workStatus.options, DEFAULT_STATUSES);
const statusOptions = workStatus.options.map((value) => ({ value, label: WORK_STATUSES[value] }));
const location = enumParam('location', workLocation);

function chooseArtist(p: PersonSummary) {
    setQuery({ artist: p.id, artistName: p.name });
}

// ---- Shipping labels for every work matching the filters ----
const total = ref<number | null>(null);
const labelsOpen = ref(false);
const labelSource = computed<ShippingLabelSource>(() => ({ kind: 'inventory', artist: artist.value, statuses: statuses.value, location: location.value, q: q.value || null }));
const labelsHint = computed(() =>
    !total.value ? 'No works match' : total.value > SHIPPING_LABELS_MAX ? `More than ${SHIPPING_LABELS_MAX} works match; narrow the filters` : `A Letter page for each of the ${total.value} matching works`,
);
</script>

<template>
    <div>
        <div class="mb-4 flex flex-wrap items-center gap-3">
            <h1 class="text-xl font-semibold">Inventory</h1>
            <span class="flex-1" />
            <button type="button" :class="btnOutline" :disabled="!total || total > SHIPPING_LABELS_MAX" :title="labelsHint" data-testid="inventory-shipping-labels" @click="labelsOpen = true">
                <i class="las la-shipping-fast" aria-hidden="true" /> Shipping labels
            </button>
            <RouterLink :to="{ name: 'bo-work', params: { id: 'new' }, query: artist ? { artist } : {} }" :class="btnPrimary">+ New work</RouterLink>
        </div>

        <div class="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label class="block">
                <span class="block text-xs font-medium text-slate-600">Search</span>
                <input v-model="search" type="search" aria-label="Search works" placeholder="Title, inventory no., medium…" class="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-sky-700 focus:outline-none" />
            </label>
            <div v-if="artist" class="text-sm">
                <span class="block text-xs font-medium text-slate-600">Artist</span>
                <span class="mt-1 inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-2 py-1.5">
                    {{ artistName ?? 'Selected artist' }}
                    <button type="button" class="text-slate-500 hover:text-slate-900" aria-label="Clear artist filter" @click="setQuery({ artist: null, artistName: null })">×</button>
                </span>
            </div>
            <PersonPicker v-else label="Artist" profile="artist" strict :allow-create="false" placeholder="Any artist" @select="chooseArtist" />
            <MultiSelect v-model="statuses" label="Status" :options="statusOptions" testid="work-status-filter" />
            <label class="block">
                <span class="block text-xs font-medium text-slate-600">Location</span>
                <select :value="location ?? ''" aria-label="Location" class="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm" @change="setQuery({ location: ($event.target as HTMLSelectElement).value || null })">
                    <option value="">Any location</option>
                    <option v-for="(label, key) in WORK_LOCATIONS" :key="key" :value="key">{{ label }}</option>
                </select>
            </label>
        </div>

        <InventoryTable :q="q" :artist="artist" :statuses="statuses" :location="location" :page="page" @page="goToPage" @total="total = $event" />
        <ShippingLabelDialog v-model:open="labelsOpen" :source="labelSource" :summary="`${total ?? 0} matching ${total === 1 ? 'work' : 'works'} · one page each`" />
    </div>
</template>
