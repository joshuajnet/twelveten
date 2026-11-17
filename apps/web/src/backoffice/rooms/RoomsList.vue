<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { PDF_PAGE_ASPECT, ROOM_STATUSES, ROOMS_PAGE_SIZE, roomStatus, type RoomStatus, type RoomSummary } from '@twelveten/shared';
import { errorMessage } from '@/admin/api';
import { toast } from '@/admin/state';
import { btnGhost, btnPrimary } from '@/admin/ui/buttons';
import { boApi, roomUrl } from '../api';
import Pagination from '../Pagination.vue';
import { useListQuery, usePagedList } from '../useListQuery';
import RoomStatusBadge from './RoomStatusBadge.vue';
import { when } from './time';
import CroppedImage from './CroppedImage.vue';
import MultiSelect from '@/admin/ui/MultiSelect.vue';

/** Viewing rooms, newest first, with search and a status filter (Draft and Live unless the admin picks others). */
const { q, page, param, setQuery, goToPage, search } = useListQuery();
const router = useRouter();

const ALL_STATUSES = roomStatus.options;
const DEFAULT_STATUSES: RoomStatus[] = ['draft', 'live'];
const statusParam = param('status');
/** `?status=draft,live,closed`; absent (or nothing valid) means the default. */
const statuses = computed<RoomStatus[]>({
    get: () => {
        const picked = new Set((statusParam.value ?? '').split(',').filter((s): s is RoomStatus => roomStatus.safeParse(s).success));
        return picked.size ? ALL_STATUSES.filter((s) => picked.has(s)) : DEFAULT_STATUSES;
    },
    set: (next) => setQuery({ status: next.join() === DEFAULT_STATUSES.join() ? null : next.join(',') }),
});
const isDefaultStatuses = computed(() => statuses.value.join() === DEFAULT_STATUSES.join());
const statusOptions = ALL_STATUSES.map((value) => ({ value, label: ROOM_STATUSES[value] }));

const { result, loading, error } = usePagedList(
    [q, statuses, page],
    () => boApi.rooms({ q: q.value, statuses: statuses.value.length === ALL_STATUSES.length ? [] : statuses.value, page: page.value, limit: ROOMS_PAGE_SIZE }),
    goToPage,
);

/** A room that has gone live opens on its dashboard; a draft opens in the editor. The other view is a button. */
function view(r: RoomSummary) {
    const edit = { name: 'bo-room', params: { id: r.id } };
    const dashboard = { name: 'bo-room-dashboard', params: { id: r.id } };
    return r.status === 'draft' ? { main: edit, other: { to: dashboard, label: 'Dashboard' } } : { main: dashboard, other: { to: edit, label: 'Edit' } };
}

async function duplicate(r: RoomSummary) {
    try {
        const copy = await boApi.duplicateRoom(r.id);
        toast('Room duplicated', 'success');
        await router.push({ name: 'bo-room', params: { id: copy.id } });
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}

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
            <MultiSelect v-model="statuses" label="Status" :options="statusOptions" testid="room-status-filter" />
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
                            <RouterLink :to="view(r).main" class="flex items-center gap-3 font-medium text-sky-900 hover:underline">
                                <span class="w-14 shrink-0 overflow-hidden rounded bg-slate-100">
                                    <CroppedImage v-if="r.cover" :url="r.cover" :crop="r.coverCrop" :aspect="PDF_PAGE_ASPECT" />
                                    <span v-else class="block" :style="{ aspectRatio: String(PDF_PAGE_ASPECT) }" />
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
                            <button type="button" :class="btnGhost" :data-testid="`duplicate-${r.id}`" @click="duplicate(r)">Duplicate</button>
                            <RouterLink :to="view(r).other.to" :class="btnGhost">{{ view(r).other.label }}</RouterLink>
                        </td>
                    </tr>
                </tbody>
            </table>
            <p v-if="result && !result.items.length" class="py-10 text-center text-sm text-slate-500">
                <template v-if="q || !isDefaultStatuses">No rooms match.</template>
                <template v-else>No draft or live rooms. Closed rooms are hidden — tick Closed to see them, or create a new room.</template>
            </p>
        </div>
        <Pagination v-if="result" class="mt-4" :page="result.page" :page-size="result.pageSize" :total="result.total" label="rooms" @page="goToPage" />
    </div>
</template>
