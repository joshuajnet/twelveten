<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { WORK_LOCATIONS, WORK_STATUSES, workLocation, workStatus, type PersonSummary } from '@twelveten/shared';
import { btnPrimary } from '@/admin/ui/buttons';
import PersonPicker from './PersonPicker.vue';
import InventoryTable from './InventoryTable.vue';
import { useListQuery } from './useListQuery';

/** Every work across artists, filterable by artist, status and location. */
const { q, page, param, enumParam, setQuery, goToPage, search } = useListQuery();
const artist = param('artist');
const artistName = param('artistName');
const status = enumParam('status', workStatus);
const location = enumParam('location', workLocation);

function chooseArtist(p: PersonSummary) {
    setQuery({ artist: p.id, artistName: p.name });
}
</script>

<template>
    <div>
        <div class="mb-4 flex flex-wrap items-center gap-3">
            <h1 class="text-xl font-semibold">Inventory</h1>
            <span class="flex-1" />
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
            <label class="block">
                <span class="block text-xs font-medium text-slate-600">Status</span>
                <select :value="status ?? ''" aria-label="Status" class="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm" @change="setQuery({ status: ($event.target as HTMLSelectElement).value || null })">
                    <option value="">Any status</option>
                    <option v-for="(label, key) in WORK_STATUSES" :key="key" :value="key">{{ label }}</option>
                </select>
            </label>
            <label class="block">
                <span class="block text-xs font-medium text-slate-600">Location</span>
                <select :value="location ?? ''" aria-label="Location" class="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm" @change="setQuery({ location: ($event.target as HTMLSelectElement).value || null })">
                    <option value="">Any location</option>
                    <option v-for="(label, key) in WORK_LOCATIONS" :key="key" :value="key">{{ label }}</option>
                </select>
            </label>
        </div>

        <InventoryTable :q="q" :artist="artist" :status="status" :location="location" :page="page" @page="goToPage" />
    </div>
</template>
