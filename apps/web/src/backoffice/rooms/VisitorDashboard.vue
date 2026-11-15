<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import Dialog from '@/admin/ui/Dialog.vue';
import { engagementLabel, pointerFromBase64, unpackPointer, type PointerPoint, type RoomEvent, type VisitorDashboard } from '@twelveten/shared';
import { ApiError } from '@/api/client';
import { errorMessage } from '@/admin/api';
import { toast } from '@/admin/state';
import { btnDanger, btnOutline } from '@/admin/ui/buttons';
import Switch from '@/admin/ui/Switch.vue';
import { boApi } from '../api';
import StatusBadge from '../StatusBadge.vue';
import MergeDialog from '../MergeDialog.vue';
import EngagementDots from './EngagementDots.vue';
import InterestBar from './InterestBar.vue';
import PointerHeatmap from './PointerHeatmap.vue';
import StatTile from './StatTile.vue';
import { duration, when } from './time';

/** Admin-only: how one visitor browsed one room — visits, works ranked by interest with heatmaps, timeline. */
const route = useRoute();
const roomId = computed(() => String(route.params.id));
const visitorId = computed(() => String(route.params.visitorId));
const data = ref<VisitorDashboard | null>(null);
const pointer = ref(new Map<string, PointerPoint[]>());
const notFound = ref(false);
const showHeat = ref(true);

watch(
    [roomId, visitorId],
    async ([rid, vid]) => {
        notFound.value = false;
        try {
            const [d, p] = await Promise.all([boApi.visitorDashboard(rid, vid), boApi.visitorPointer(rid, vid)]);
            data.value = d;
            pointer.value = new Map(p.map((x) => [x.workId, unpackPointer(pointerFromBase64(x.points))]));
            await nextTick();
            if (route.hash) document.querySelector(route.hash)?.scrollIntoView({ block: 'start' });
        } catch (e) {
            if (e instanceof ApiError && e.status === 404) notFound.value = true;
            else toast(errorMessage(e), 'error');
        }
    },
    { immediate: true },
);

const v = computed(() => data.value!.visitor);
const EVENT_LABELS: Record<RoomEvent['type'], string> = {
    enter: 'Entered the room',
    view_mode: 'Switched view',
    focus: 'Looked at',
    zoom: 'Zoomed into',
    click: 'Clicked',
    inquire: 'Inquired about',
    artist_open: 'Opened the artist',
    cv_open: 'Read the CV of',
    cv_pdf: 'Downloaded the CV of',
    press_click: 'Opened press about',
};
function eventText(e: RoomEvent): string {
    const what = e.workTitle ?? e.artistName ?? '';
    if (e.type === 'view_mode') return `Switched to ${String(e.data?.mode ?? '')}`;
    if (e.type === 'zoom') return `Zoomed into ${what}${e.data?.level ? ` (${e.data.level}×)` : ''}`;
    if (e.type === 'inquire' && e.data?.note) return `Inquired about ${what}: “${String(e.data.note)}”`;
    if (e.type === 'press_click') return `Opened press about ${e.artistName ?? ''}${e.data?.title ? `: “${e.data.title}”` : ''}`;
    return what ? `${EVENT_LABELS[e.type]} ${what}` : EVENT_LABELS[e.type];
}
const visitNumber = computed(() => {
    const ids = [...(data.value?.visits ?? [])].reverse().map((x) => x.id);
    return (visitId: string) => ids.indexOf(visitId) + 1;
});

const merge = ref<{ open: boolean; other: string | null }>({ open: false, other: null });

const router = useRouter();
const confirmForget = ref(false);
async function forget() {
    confirmForget.value = false;
    try {
        const personId = v.value.personId;
        await boApi.deleteVisitor(roomId.value, visitorId.value);
        toast('Their activity in this room was deleted', 'success');
        await router.push({ name: 'bo-person', params: { id: personId } });
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}
</script>

<template>
    <div v-if="notFound" class="py-16 text-center text-slate-600">This visitor or room doesn’t exist.</div>
    <div v-else-if="!data" class="py-16 text-center text-sm text-slate-500">Loading…</div>
    <div v-else class="space-y-6">
        <nav class="flex flex-wrap gap-x-4 text-sm" aria-label="Back">
            <RouterLink :to="{ name: 'bo-person', params: { id: v.personId, profile: 'collector' } }" class="text-sky-800 hover:underline">← {{ v.personName }}</RouterLink>
            <RouterLink :to="{ name: 'bo-room-dashboard', params: { id: data.room.id } }" class="text-sky-800 hover:underline">{{ data.room.title }} dashboard</RouterLink>
        </nav>

        <header class="flex flex-wrap items-start gap-4">
            <div class="min-w-0 flex-1">
                <h1 class="text-2xl font-semibold">{{ v.personName }} in “{{ data.room.title }}”</h1>
                <p class="mt-1 text-sm text-slate-600">
                    Entered as <strong>{{ v.enteredName }}</strong> · {{ v.enteredEmail }}
                    <span class="text-slate-500">
                        — {{ v.match === 'new' ? 'a new person from this room' : `matched by ${v.match === 'alias' ? 'another email' : 'email'}` }}; not verified
                    </span>
                </p>
                <p class="mt-1 text-sm text-slate-600">First visit {{ when(v.firstSeenAt) }} · last {{ when(v.lastSeenAt) }}</p>
            </div>
            <div class="rounded-md border border-slate-200 bg-white px-4 py-3 text-center">
                <div class="text-xs font-medium text-slate-500">Engagement</div>
                <div class="text-3xl font-semibold tabular-nums">{{ v.engagement }}</div>
                <EngagementDots :score="v.engagement" :show-label="false" />
                <div class="text-xs text-slate-600">{{ engagementLabel(v.engagement) }}</div>
            </div>
        </header>

        <div v-if="data.possibleMatches.length" class="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm" role="note">
            <p v-for="d in data.possibleMatches.slice(0, 3)" :key="d.a.id + d.b.id" class="flex flex-wrap items-center gap-2 py-0.5">
                <span class="text-amber-900">Possibly the same as</span>
                <RouterLink :to="{ name: 'bo-person', params: { id: (d.a.id === v.personId ? d.b : d.a).id } }" class="font-medium text-sky-900 hover:underline">{{ (d.a.id === v.personId ? d.b : d.a).name }}</RouterLink>
                <span class="text-xs text-amber-800">({{ d.reasons.join(', ').toLowerCase() }})</span>
                <button type="button" class="text-xs font-medium text-sky-900 hover:underline" @click="merge = { open: true, other: (d.a.id === v.personId ? d.b : d.a).id }">Compare &amp; merge</button>
            </p>
        </div>

        <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Visits" :value="v.visits" />
            <StatTile label="Time spent" :value="duration(v.activeMs)" hint="While active on the page" />
            <StatTile label="Works seen" :value="`${v.worksViewed} / ${v.worksTotal}`" hint="Looked at for 3 s or more" />
            <StatTile label="Inquiries" :value="v.inquiries" />
        </div>

        <!-- Works -->
        <section aria-labelledby="vw-h">
            <div class="mb-3 flex flex-wrap items-center gap-3">
                <h2 id="vw-h" class="text-sm font-semibold">Works, most interest first</h2>
                <span class="flex-1" />
                <div class="w-56"><Switch v-model="showHeat" label="Pointer heatmap" /></div>
            </div>
            <p v-if="showHeat" class="mb-3 flex items-center gap-2 text-xs text-slate-500">
                Where the pointer rested (on the page and while zoomed):
                <span class="inline-block h-2 w-24 rounded" style="background: linear-gradient(to right, #b7d3f6, #2a78d6, #0d366b)" aria-hidden="true" />
                less → more
            </p>
            <ul v-if="data.works.length" class="space-y-4">
                <li v-for="w in data.works" :id="`work-${w.workId}`" :key="w.workId" class="scroll-mt-4 rounded-md border border-slate-200 bg-white p-4" data-testid="visitor-work">
                    <div class="grid gap-4 md:grid-cols-[minmax(0,20rem)_1fr]">
                        <div class="flex items-start justify-center rounded bg-slate-50 p-2">
                            <PointerHeatmap v-if="w.image" :src="w.image" :alt="w.title" :points="pointer.get(w.workId) ?? []" :show="showHeat" />
                            <span v-else class="py-10 text-xs text-slate-400">No image</span>
                        </div>
                        <div class="min-w-0 text-sm">
                            <div class="flex flex-wrap items-baseline gap-2">
                                <RouterLink :to="{ name: 'bo-work', params: { id: w.workId } }" class="text-base font-medium italic text-sky-900 hover:underline">{{ w.title || 'Untitled' }}</RouterLink>
                                <span v-if="w.dateText" class="text-slate-600">{{ w.dateText }}</span>
                                <StatusBadge :status="w.status" />
                                <span v-if="w.inquiries" class="rounded bg-slate-100 px-1.5 text-[11px] font-medium text-slate-800">Inquired</span>
                            </div>
                            <div class="mb-3 text-slate-600">{{ w.artistName }}</div>
                            <div class="mb-1 text-xs font-medium text-slate-500">Interest</div>
                            <InterestBar :value="w.interest" :label="`Interest in ${w.title || 'Untitled'}`" class="mb-3 max-w-sm" />
                            <dl class="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
                                <div><dt class="text-xs text-slate-500">Looking</dt><dd class="tabular-nums">{{ duration(w.viewMs) }}</dd></div>
                                <div><dt class="text-xs text-slate-500">Pointer over it</dt><dd class="tabular-nums">{{ duration(w.hoverMs) }}</dd></div>
                                <div><dt class="text-xs text-slate-500">Zoomed</dt><dd class="tabular-nums">{{ w.zoomCount }}× · {{ duration(w.zoomMs) }}</dd></div>
                                <div><dt class="text-xs text-slate-500">Deepest zoom</dt><dd class="tabular-nums">{{ w.maxZoom.toFixed(1) }}×</dd></div>
                                <div><dt class="text-xs text-slate-500">Opened</dt><dd class="tabular-nums">{{ w.focusCount }}</dd></div>
                                <div><dt class="text-xs text-slate-500">Clicks</dt><dd class="tabular-nums">{{ w.clicks }}</dd></div>
                                <div><dt class="text-xs text-slate-500">Seen on</dt><dd class="tabular-nums">{{ w.visitsSeen }} {{ w.visitsSeen === 1 ? 'visit' : 'visits' }}</dd></div>
                                <div><dt class="text-xs text-slate-500">Last seen</dt><dd>{{ when(w.lastSeenAt) }}</dd></div>
                            </dl>
                        </div>
                    </div>
                </li>
            </ul>
            <p v-else class="rounded-md border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">They haven’t looked at any works yet.</p>
        </section>

        <!-- Artists -->
        <section v-if="data.artists.length" aria-labelledby="va-h" class="rounded-md border border-slate-200 bg-white p-4">
            <h2 id="va-h" class="mb-2 text-sm font-semibold">Artists they read about</h2>
            <table class="w-full text-left text-sm">
                <thead class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                        <th scope="col" class="py-1.5 pr-3 font-medium">Artist</th>
                        <th scope="col" class="py-1.5 pr-3 text-right font-medium">Reading</th>
                        <th scope="col" class="py-1.5 pr-3 text-right font-medium">Opened</th>
                        <th scope="col" class="py-1.5 pr-3 text-right font-medium">CV</th>
                        <th scope="col" class="py-1.5 text-right font-medium">Press opened</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    <tr v-for="a in data.artists" :key="a.artistId">
                        <td class="py-1.5 pr-3"><RouterLink :to="{ name: 'bo-person', params: { id: a.artistId, profile: 'artist' } }" class="text-sky-900 hover:underline">{{ a.name }}</RouterLink></td>
                        <td class="py-1.5 pr-3 text-right tabular-nums">{{ duration(a.readMs) }}</td>
                        <td class="py-1.5 pr-3 text-right tabular-nums">{{ a.opens }}</td>
                        <td class="py-1.5 pr-3 text-right tabular-nums">{{ a.cvOpens }}</td>
                        <td class="py-1.5 text-right tabular-nums">{{ a.pressClicks }}</td>
                    </tr>
                </tbody>
            </table>
        </section>

        <div class="grid gap-6 lg:grid-cols-2">
            <!-- Visits -->
            <section aria-labelledby="vv-h" class="rounded-md border border-slate-200 bg-white p-4">
                <h2 id="vv-h" class="mb-2 text-sm font-semibold">Visits ({{ data.visits.length }})</h2>
                <ol class="divide-y divide-slate-100 text-sm">
                    <li v-for="x in data.visits" :key="x.id" class="flex flex-wrap justify-between gap-2 py-1.5">
                        <span>#{{ visitNumber(x.id) }} · {{ when(x.startedAt) }}</span>
                        <span class="tabular-nums text-slate-600">{{ duration(x.activeMs) }} active</span>
                        <span v-if="x.userAgent" class="w-full truncate text-xs text-slate-400" :title="x.userAgent">{{ x.userAgent }}</span>
                    </li>
                </ol>
            </section>

            <!-- Timeline -->
            <section aria-labelledby="vt-h" class="rounded-md border border-slate-200 bg-white p-4">
                <h2 id="vt-h" class="mb-2 text-sm font-semibold">What they did</h2>
                <ol class="max-h-96 divide-y divide-slate-100 overflow-y-auto text-sm" data-testid="visitor-timeline">
                    <li v-for="e in data.events" :key="e.id" class="flex gap-3 py-1.5">
                        <span class="w-36 shrink-0 text-xs tabular-nums text-slate-500">{{ when(e.at) }}</span>
                        <span :class="{ 'font-medium': e.type === 'inquire' }">{{ eventText(e) }}</span>
                    </li>
                </ol>
                <p v-if="!data.events.length" class="text-sm text-slate-500">Nothing recorded yet.</p>
            </section>
        </div>

        <div class="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
            <RouterLink :to="{ name: 'bo-person', params: { id: v.personId } }" :class="btnOutline">Open {{ v.personName }}’s record</RouterLink>
            <span class="flex-1" />
            <button type="button" :class="btnDanger" @click="confirmForget = true">Delete their activity in this room…</button>
        </div>
        <Dialog v-model:open="confirmForget" title="Delete this visitor’s activity?" description="Their visits, interest and pointer data in this room are deleted and their browser has to enter again. The person record stays.">
            <template #footer>
                <button type="button" :class="btnOutline" @click="confirmForget = false">Cancel</button>
                <button type="button" :class="btnDanger" class="!bg-red-700 !text-white" @click="forget">Delete</button>
            </template>
        </Dialog>
        <MergeDialog v-model:open="merge.open" :first-id="v.personId" :second-id="merge.other" />
    </div>
</template>
