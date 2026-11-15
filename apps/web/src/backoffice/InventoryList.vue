<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter, type LocationQueryRaw } from 'vue-router';
import { WORK_LOCATIONS, WORK_STATUSES, workLocation, workStatus, type PersonSummary } from '@twelveten/shared';
import { btnPrimary } from '@/admin/ui/buttons';
import PersonPicker from './PersonPicker.vue';
import InventoryTable from './InventoryTable.vue';

/** Every work across artists, filterable by artist, status and location. */
const route = useRoute();
const router = useRouter();

const q = computed(() => String(route.query.q ?? ''));
const artist = computed(() => (route.query.artist ? String(route.query.artist) : null));
const artistName = computed(() => (route.query.artistName ? String(route.query.artistName) : null));
const status = computed(() => {
    const p = workStatus.safeParse(route.query.status);
    return p.success ? p.data : null;
});
const location = computed(() => {
    const p = workLocation.safeParse(route.query.location);
    return p.success ? p.data : null;
});

const page = computed(() => Math.max(1, Number.parseInt(String(route.query.page ?? '1'), 10) || 1));

/** Change filters (back to page 1 unless the patch sets the page). */
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

function goToPage(n: number) {
    setQuery({ page: n > 1 ? String(n) : null });
    window.scrollTo({ top: 0 });
}

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
