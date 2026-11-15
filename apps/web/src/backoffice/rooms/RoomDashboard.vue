<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import type { RoomDashboard } from '@twelveten/shared';
import { ApiError } from '@/api/client';
import { errorMessage } from '@/admin/api';
import { toast } from '@/admin/state';
import { btnOutline } from '@/admin/ui/buttons';
import { boApi } from '../api';
import StatusBadge from '../StatusBadge.vue';
import EngagementDots from './EngagementDots.vue';
import InterestBar from './InterestBar.vue';
import RoomStatusBadge from './RoomStatusBadge.vue';
import StatTile from './StatTile.vue';
import { duration, when } from './time';

/** One room at a glance: who came, how engaged they were, and which works drew the most interest. */
const route = useRoute();
const id = computed(() => String(route.params.id));
const data = ref<RoomDashboard | null>(null);
const notFound = ref(false);

watch(
    id,
    async (rid) => {
        notFound.value = false;
        try {
            data.value = await boApi.roomDashboard(rid);
        } catch (e) {
            if (e instanceof ApiError && e.status === 404) notFound.value = true;
            else toast(errorMessage(e), 'error');
        }
    },
    { immediate: true },
);

const maxInterest = computed(() => Math.max(1, ...(data.value?.works.map((w) => w.interest) ?? [0])));
</script>

<template>
    <div v-if="notFound" class="py-16 text-center text-slate-600">This viewing room doesn’t exist.</div>
    <div v-else-if="!data" class="py-16 text-center text-sm text-slate-500">Loading…</div>
    <div v-else class="space-y-6">
        <RouterLink :to="{ name: 'bo-rooms' }" class="text-sm text-sky-800 hover:underline">← Viewing rooms</RouterLink>
        <div class="flex flex-wrap items-center gap-3">
            <h1 class="text-2xl font-semibold">{{ data.room.title }}</h1>
            <RoomStatusBadge :room="data.room" />
            <span class="flex-1" />
            <RouterLink :to="{ name: 'bo-room', params: { id: data.room.id } }" :class="btnOutline">Edit room</RouterLink>
        </div>

        <div class="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="room-totals">
            <StatTile label="Visitors" :value="data.totals.visitors" />
            <StatTile label="Visits" :value="data.totals.visits" />
            <StatTile label="Time spent" :value="duration(data.totals.activeMs)" hint="Active time, all visitors" />
            <StatTile label="Inquiries" :value="data.totals.inquiries" />
        </div>

        <section aria-labelledby="visitors-h" class="rounded-md border border-slate-200 bg-white p-4">
            <h2 id="visitors-h" class="mb-2 text-sm font-semibold">Visitors, most engaged first</h2>
            <div v-if="data.visitors.length" class="overflow-x-auto">
                <table class="w-full min-w-[44rem] text-left text-sm">
                    <thead class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th scope="col" class="py-1.5 pr-3 font-medium">Visitor</th>
                            <th scope="col" class="py-1.5 pr-3 text-right font-medium">Visits</th>
                            <th scope="col" class="py-1.5 pr-3 text-right font-medium">Time</th>
                            <th scope="col" class="py-1.5 pr-3 text-right font-medium">Works seen</th>
                            <th scope="col" class="py-1.5 pr-3 font-medium">Last visit</th>
                            <th scope="col" class="py-1.5 font-medium">Engagement</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        <tr v-for="v in data.visitors" :key="v.id" data-testid="room-visitor-row">
                            <td class="py-1.5 pr-3">
                                <RouterLink :to="{ name: 'bo-room-visitor', params: { id: data.room.id, visitorId: v.id } }" class="font-medium text-sky-900 hover:underline">{{ v.personName }}</RouterLink>
                                <span v-if="v.inquiries" class="ml-1.5 rounded bg-slate-100 px-1 text-[11px] font-medium text-slate-700">Inquired ×{{ v.inquiries }}</span>
                                <span class="block text-xs text-slate-500">
                                    {{ v.enteredEmail }}
                                    <span v-if="v.match !== 'new'" title="The email typed at the gate matched an existing person; it isn’t verified"> · matched by {{ v.match === 'alias' ? 'other email' : 'email' }} (unverified)</span>
                                    <span v-else> · new from this room</span>
                                </span>
                            </td>
                            <td class="py-1.5 pr-3 text-right tabular-nums">{{ v.visits }}</td>
                            <td class="py-1.5 pr-3 text-right tabular-nums">{{ duration(v.activeMs) }}</td>
                            <td class="py-1.5 pr-3 text-right tabular-nums">{{ v.worksViewed }} / {{ v.worksTotal }}</td>
                            <td class="py-1.5 pr-3 text-slate-600">{{ when(v.lastSeenAt) }}</td>
                            <td class="py-1.5"><EngagementDots :score="v.engagement" /></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p v-else class="text-sm text-slate-500">No one has entered this room yet.</p>
        </section>

        <section aria-labelledby="works-h" class="rounded-md border border-slate-200 bg-white p-4">
            <h2 id="works-h" class="mb-1 text-sm font-semibold">Works by interest</h2>
            <p class="mb-3 text-xs text-slate-500">Interest adds up each visitor’s 0–100 score for the work (time looking, zooms, revisits, inquiries).</p>
            <div class="overflow-x-auto">
                <table class="w-full min-w-[44rem] text-left text-sm">
                    <thead class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th scope="col" class="py-1.5 pr-3 font-medium">Work</th>
                            <th scope="col" class="w-1/3 py-1.5 pr-3 font-medium">Interest</th>
                            <th scope="col" class="py-1.5 pr-3 text-right font-medium">Viewers</th>
                            <th scope="col" class="py-1.5 pr-3 text-right font-medium">Time</th>
                            <th scope="col" class="py-1.5 pr-3 text-right font-medium">Zooms</th>
                            <th scope="col" class="py-1.5 text-right font-medium">Inquiries</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        <tr v-for="w in data.works" :key="w.workId" data-testid="room-work-interest">
                            <td class="py-1.5 pr-3">
                                <RouterLink :to="{ name: 'bo-work', params: { id: w.workId } }" class="flex items-center gap-2 hover:underline">
                                    <span class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-100">
                                        <img v-if="w.image" :src="w.image" alt="" class="h-full w-full object-contain" loading="lazy" />
                                    </span>
                                    <span class="min-w-0">
                                        <span class="block truncate italic text-sky-900">{{ w.title || 'Untitled' }}</span>
                                        <span class="block truncate text-xs text-slate-500">{{ w.artistName }}</span>
                                    </span>
                                </RouterLink>
                            </td>
                            <td class="py-1.5 pr-3">
                                <InterestBar :value="w.interest" :max="maxInterest" :label="w.title || 'Untitled'" :detail="`${w.viewers ?? 0} viewers, ${duration(w.viewMs)} looking`" />
                            </td>
                            <td class="py-1.5 pr-3 text-right tabular-nums">{{ w.viewers ?? 0 }}</td>
                            <td class="py-1.5 pr-3 text-right tabular-nums">{{ duration(w.viewMs) }}</td>
                            <td class="py-1.5 pr-3 text-right tabular-nums">{{ w.zoomCount }}</td>
                            <td class="py-1.5 text-right tabular-nums">
                                {{ w.inquiries }}
                                <StatusBadge v-if="w.status !== 'available'" :status="w.status" class="ml-1" />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>
    </div>
</template>
