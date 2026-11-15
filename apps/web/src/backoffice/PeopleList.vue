<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import { useRouter } from 'vue-router';
import { PROFILE_TYPES, profileFilter, type ProfileFilter } from '@twelveten/shared';
import Dialog from '@/admin/ui/Dialog.vue';
import Field from '@/admin/ui/Field.vue';
import { errorMessage } from '@/admin/api';
import { toast } from '@/admin/state';
import { btnOutline, btnPrimary } from '@/admin/ui/buttons';
import { boApi, type PersonSort } from './api';
import PeopleTable from './PeopleTable.vue';
import { peopleListQuery } from './nav';
import { useListQuery } from './useListQuery';

/** Everyone the gallery knows, filtered by profile type (artists, …) and searchable. */
const router = useRouter();
const { route, q, page, enumParam, setQuery, goToPage, search } = useListQuery();
watch(
    () => route.query,
    (q) => (peopleListQuery.value = { ...q }),
    { immediate: true },
);

const profile = enumParam('profile', profileFilter);
const sort = computed<PersonSort>(() => (route.query.sort === 'updated' ? 'updated' : 'name'));

const filters = computed(() => [
    { value: null, label: 'All' },
    ...PROFILE_TYPES.map((p) => ({ value: p.key as ProfileFilter, label: p.plural })),
    { value: 'none' as ProfileFilter, label: 'No profile' },
]);
const heading = computed(() => (profile.value && profile.value !== 'none' ? PROFILE_TYPES.find((p) => p.key === profile.value)!.plural : 'People'));

// New person
const creating = reactive({ open: false, name: '' as string | null, email: null as string | null, artist: false, collector: false, busy: false });
function openNew() {
    Object.assign(creating, { open: true, name: '', email: null, artist: profile.value === 'artist', collector: profile.value === 'collector', busy: false });
}
async function create() {
    if (!creating.name?.trim()) return;
    creating.busy = true;
    try {
        const person = await boApi.createPerson({ name: creating.name.trim(), email: creating.email ?? undefined, profiles: [...(creating.artist ? (['artist'] as const) : []), ...(creating.collector ? (['collector'] as const) : [])] });
        creating.open = false;
        await router.push({ name: 'bo-person', params: person.profiles[0] ? { id: person.id, profile: person.profiles[0] } : { id: person.id } });
    } catch (e) {
        toast(errorMessage(e), 'error');
    } finally {
        creating.busy = false;
    }
}
</script>

<template>
    <div>
        <div class="mb-4 flex flex-wrap items-center gap-3">
            <h1 class="text-xl font-semibold">{{ heading }}</h1>
            <span class="flex-1" />
            <button type="button" :class="btnPrimary" @click="openNew">{{ profile === 'artist' ? '+ New artist' : profile === 'collector' ? '+ New collector' : '+ New person' }}</button>
        </div>

        <div class="mb-3 flex flex-wrap items-center gap-2">
            <div class="inline-flex rounded-md border border-slate-300 bg-white p-0.5 text-sm" role="group" aria-label="Profile type">
                <button
                    v-for="f in filters"
                    :key="f.label"
                    type="button"
                    class="rounded px-3 py-1"
                    :class="profile === f.value ? 'bg-sky-800 text-white' : 'text-slate-700 hover:bg-slate-100'"
                    :aria-pressed="profile === f.value"
                    @click="setQuery({ profile: f.value })"
                >
                    {{ f.label }}
                </button>
            </div>
            <input
                v-model="search"
                type="search"
                placeholder="Search name, email, phone, city…"
                aria-label="Search people"
                class="min-w-48 flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-sky-700 focus:outline-none sm:max-w-xs"
            />
            <label class="flex items-center gap-1.5 text-sm text-slate-600">
                Sort
                <select :value="sort" aria-label="Sort" class="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" @change="setQuery({ sort: ($event.target as HTMLSelectElement).value })">
                    <option value="name">Name</option>
                    <option value="updated">Recently updated</option>
                </select>
            </label>
        </div>

        <PeopleTable :profile="profile" :q="q" :sort="sort" :page="page" @page="goToPage" />

        <Dialog v-model:open="creating.open" :title="creating.artist ? 'New artist' : creating.collector ? 'New collector' : 'New person'">
            <form id="new-person" @submit.prevent="create">
                <Field v-model="creating.name" label="Name" />
                <Field v-model="creating.email" label="Email" type="email" />
                <label class="mt-2 flex items-center gap-2 text-sm">
                    <input v-model="creating.artist" type="checkbox" class="h-4 w-4" />
                    Add an artist profile
                </label>
                <label class="mt-2 flex items-center gap-2 text-sm">
                    <input v-model="creating.collector" type="checkbox" class="h-4 w-4" />
                    Add a collector profile
                </label>
            </form>
            <template #footer>
                <button type="button" :class="btnOutline" @click="creating.open = false">Cancel</button>
                <button type="submit" form="new-person" :class="btnPrimary" :disabled="creating.busy || !creating.name?.trim()">Create</button>
            </template>
        </Dialog>
    </div>
</template>
