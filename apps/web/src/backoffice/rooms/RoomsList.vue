<script setup lang="ts">
import { RouterLink } from 'vue-router';
import { ROOM_STATUSES, ROOMS_PAGE_SIZE, roomStatus, type RoomSummary } from '@twelveten/shared';
import { toast } from '@/admin/state';
import { btnGhost, btnPrimary } from '@/admin/ui/buttons';
import { boApi, roomUrl } from '../api';
import Pagination from '../Pagination.vue';
import { useListQuery, usePagedList } from '../useListQuery';
import RoomStatusBadge from './RoomStatusBadge.vue';
import { when } from './time';
import ArtImage from '@/components/ArtImage.vue';

/** Every viewing room, newest first, with search and a status filter. */
const { q, page, enumParam, setQuery, goToPage, search } = useListQuery();
const status = enumParam('status', roomStatus);
const { result, loading, error } = usePagedList(
    [q, status, page],
    () => boApi.rooms({ q: q.value, status: status.value, page: page.value, limit: ROOMS_PAGE_SIZE }),
    goToPage,
);

async function copy(r: RoomSummary) {
    try {
        await navigator.clipboard.writeText(roomUrl(r.token));
        toast('Link copied', 'success', 1500);
    } catch {
        toast(roomUrl(r.token), 'info');
    }
}
</script>

<template>
    <div>
        <div class="mb-4 flex flex-wrap items-center gap-3">
            <h1 class="text-xl font-semibold">Viewing rooms</h1>
            <span class="flex-1" />
            <RouterLink :to="{ name: 'bo-room', params: { id: 'new' } }" :class="btnPrimary">+ New room</RouterLink>
        </div>

        <div class="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label class="block">
                <span class="block text-xs font-medium text-slate-600">Search</span>
                <input v-model="search" type="search" aria-label="Search rooms" placeholder="Title…" class="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-sky-700 focus:outline-none" />
            </label>
            <label class="block">
                <span class="block text-xs font-medium text-slate-600">Status</span>
                <select :value="status ?? ''" aria-label="Status" class="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm" @change="setQuery({ status: ($event.target as HTMLSelectElement).value || null })">
                    <option value="">Any status</option>
                    <option v-for="(label, key) in ROOM_STATUSES" :key="key" :value="key">{{ label }}</option>
                </select>
            </label>
        </div>

        <p v-if="error" class="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-800">{{ error }}</p>
        <div class="overflow-x-auto rounded-md border border-slate-200 bg-white" :aria-busy="loading">
            <table class="w-full min-w-[44rem] text-left text-sm">
                <thead class="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                        <th scope="col" class="px-3 py-2 font-medium">Room</th>
                        <th scope="col" class="px-3 py-2 font-medium">Status</th>
                        <th scope="col" class="px-3 py-2 text-right font-medium">Works</th>
                        <th scope="col" class="px-3 py-2 text-right font-medium">Visitors</th>
                        <th scope="col" class="px-3 py-2 font-medium">Last visit</th>
                        <th scope="col" class="px-3 py-2"><span class="sr-only">Actions</span></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    <tr v-for="r in result?.items ?? []" :key="r.id" class="hover:bg-slate-50" data-testid="room-row">
                        <td class="px-3 py-2">
                            <RouterLink :to="{ name: 'bo-room', params: { id: r.id } }" class="flex items-center gap-3 font-medium text-sky-900 hover:underline">
                                <span class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-100">
                                    <ArtImage sizes="48px" fit="cover" v-if="r.cover" :src="r.cover" alt="" class="h-full w-full object-cover" />
                                </span>
                                <span>
                                    {{ r.title }}
                                    <span v-if="r.subtitle" class="block text-xs font-normal text-slate-500">{{ r.subtitle }}</span>
                                </span>
                            </RouterLink>
                        </td>
                        <td class="px-3 py-2"><RoomStatusBadge :room="r" /></td>
                        <td class="px-3 py-2 text-right tabular-nums">{{ r.works }}</td>
                        <td class="px-3 py-2 text-right tabular-nums">{{ r.visitors }}</td>
                        <td class="px-3 py-2 text-slate-600">{{ when(r.lastVisitAt) }}</td>
                        <td class="whitespace-nowrap px-3 py-2 text-right">
                            <button type="button" :class="btnGhost" @click="copy(r)">Copy link</button>
                            <RouterLink :to="{ name: 'bo-room-dashboard', params: { id: r.id } }" :class="btnGhost">Dashboard</RouterLink>
                        </td>
                    </tr>
                </tbody>
            </table>
            <p v-if="result && !result.items.length" class="py-10 text-center text-sm text-slate-500">
                {{ q || status ? 'No rooms match.' : 'No viewing rooms yet. Create one to share a private selection of works.' }}
            </p>
        </div>
        <Pagination v-if="result" class="mt-4" :page="result.page" :page-size="result.pageSize" :total="result.total" label="rooms" @page="goToPage" />
    </div>
</template>
