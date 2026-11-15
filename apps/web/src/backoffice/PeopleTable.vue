<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import type { PersonSummary, ProfileFilter } from '@twelveten/shared';
import { PEOPLE_PAGE_SIZE, PROFILE_TYPES } from '@twelveten/shared';
import { boApi, type PersonSort } from './api';
import Avatar from './Avatar.vue';
import Pagination from './Pagination.vue';
import { usePagedList } from './useListQuery';

/** One page of people for the current filter, search and sort. */
const props = defineProps<{ profile: ProfileFilter | null; q: string; sort: PersonSort; page: number }>();
const emit = defineEmits<{ page: [page: number] }>();

const { result, loading, error, reload } = usePagedList(
    () => [props.profile, props.q, props.sort, props.page],
    () => boApi.persons({ profile: props.profile, q: props.q, sort: props.sort, page: props.page, limit: PEOPLE_PAGE_SIZE }),
    (page) => emit('page', page),
);

const artistsOnly = computed(() => props.profile === 'artist');
const collectorsOnly = computed(() => props.profile === 'collector');
const profileLabel = (key: string) => PROFILE_TYPES.find((p) => p.key === key)?.label ?? key;

/** Where a row leads: the filtered profile, else the person's first profile, else their details. */
const linkFor = (p: PersonSummary) => {
    const profile = props.profile && props.profile !== 'none' ? props.profile : p.profiles[0];
    return { name: 'bo-person', params: profile ? { id: p.id, profile } : { id: p.id } };
};
</script>

<template>
    <div>
        <div class="overflow-x-auto rounded-md border border-slate-200 bg-white" :aria-busy="loading">
            <table class="w-full min-w-[36rem] text-left text-sm">
                <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                        <th scope="col" class="px-3 py-2 font-medium">Name</th>
                        <th scope="col" class="px-3 py-2 font-medium">Email</th>
                        <th scope="col" class="hidden px-3 py-2 font-medium lg:table-cell">Phone</th>
                        <th scope="col" class="px-3 py-2 font-medium">City</th>
                        <template v-if="artistsOnly">
                            <th scope="col" class="px-3 py-2 text-right font-medium">Works</th>
                            <th scope="col" class="px-3 py-2 text-right font-medium">Available</th>
                            <th scope="col" class="hidden px-3 py-2 font-medium xl:table-cell">Last exhibition</th>
                        </template>
                        <template v-else-if="collectorsOnly">
                            <th scope="col" class="px-3 py-2 text-right font-medium">Works</th>
                            <th scope="col" class="px-3 py-2 text-right font-medium">Artists</th>
                            <th scope="col" class="px-3 py-2 text-right font-medium">Open invoices</th>
                        </template>
                        <th v-else scope="col" class="px-3 py-2 font-medium">Profiles</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100" :class="{ 'opacity-60': loading && result }">
                    <tr v-for="p in result?.items ?? []" :key="p.id" class="relative hover:bg-sky-50/60 focus-within:bg-sky-50/60">
                        <td class="px-3 py-2">
                            <div class="flex items-center gap-2">
                                <Avatar :name="p.name" :src="p.portrait" />
                                <!-- The link covers the whole row (::after), so any cell opens the person. -->
                                <RouterLink
                                    :to="linkFor(p)"
                                    class="font-medium text-slate-900 after:absolute after:inset-0 after:content-[''] focus:outline-none focus-visible:after:outline-2 focus-visible:after:outline-sky-700"
                                >
                                    {{ p.name }}
                                </RouterLink>
                            </div>
                        </td>
                        <td class="max-w-48 truncate px-3 py-2 text-slate-600">{{ p.email }}</td>
                        <td class="hidden px-3 py-2 text-slate-600 lg:table-cell">{{ p.phone }}</td>
                        <td class="px-3 py-2 text-slate-600">{{ p.city }}</td>
                        <template v-if="artistsOnly">
                            <td class="px-3 py-2 text-right tabular-nums">{{ p.artist?.works ?? 0 }}</td>
                            <td class="px-3 py-2 text-right tabular-nums">{{ p.artist?.available ?? 0 }}</td>
                            <td class="hidden max-w-56 truncate px-3 py-2 text-slate-600 xl:table-cell">{{ p.artist?.lastExhibition }}</td>
                        </template>
                        <template v-else-if="collectorsOnly">
                            <td class="px-3 py-2 text-right tabular-nums">{{ p.collector?.works ?? 0 }}</td>
                            <td class="px-3 py-2 text-right tabular-nums">{{ p.collector?.artists ?? 0 }}</td>
                            <td class="px-3 py-2 text-right tabular-nums">{{ p.collector?.openInvoices || '' }}</td>
                        </template>
                        <td v-else class="px-3 py-2">
                            <span v-for="key in p.profiles" :key="key" class="mr-1 rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-900 ring-1 ring-inset ring-sky-700/20">
                                {{ profileLabel(key) }}
                            </span>
                        </td>
                    </tr>
                </tbody>
            </table>
            <p v-if="!result && loading" class="px-3 py-8 text-center text-sm text-slate-500">Loading…</p>
            <p v-else-if="error" class="px-3 py-8 text-center text-sm text-red-700" role="alert">
                Couldn’t load people: {{ error }} <button type="button" class="text-sky-800 underline" @click="reload">Retry</button>
            </p>
            <p v-else-if="result && !result.total" class="px-3 py-8 text-center text-sm text-slate-500">No people match.</p>
        </div>
        <Pagination v-if="result && result.total" :page="result.page" :page-size="result.pageSize" :total="result.total" label="people" @page="(n) => emit('page', n)" />
    </div>
</template>
