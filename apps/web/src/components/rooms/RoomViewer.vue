<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { InquiryItem, PublicRoom, PublicRoomWork } from '@twelveten/shared';
import ZoomViewer from '@/components/ZoomViewer.vue';
import ArtImage from '@/components/ArtImage.vue';
import { api } from '@/api/client';
import InquiryDialog, { type InquiryTarget } from '@/components/InquiryDialog.vue';
import { useRoomTracker } from '@/composables/useRoomTracker';
import RoomArtists from './RoomArtists.vue';
import RoomWorkActions from './RoomWorkActions.vue';
import RoomWorkCaption from './RoomWorkCaption.vue';

/** The works of a viewing room as a grid that opens zoom, the artists and Inquire. */
const props = defineProps<{ room: PublicRoom; token: string; preview: boolean }>();

const tracker = useRoomTracker({ token: props.token, visitId: props.room.visitId });
const { vTrackWork } = tracker;

const tab = ref<'works' | 'artists'>('works');
const focusArtist = ref<string | null>(null);
const filterArtist = ref<string | null>(null);

const works = computed(() => (filterArtist.value ? props.room.works.filter((w) => w.artistId === filterArtist.value) : props.room.works));
const filterName = computed(() => props.room.artists.find((a) => a.id === filterArtist.value)?.name ?? props.room.works.find((w) => w.artistId === filterArtist.value)?.artistName);
const artistIds = computed(() => new Set(props.room.artists.map((a) => a.id)));
/** "About the artist" on a work only when the room has several artists (otherwise the Artist tab is the same thing). */
const hasAbout = (w: PublicRoomWork) => props.room.artists.length > 1 && artistIds.value.has(w.artistId);
const hasArtists = computed(() => props.room.artists.some((a) => a.bioHtml || a.cvHtml || a.press?.length));

/** A grid image opens zoom on that work; closing it returns to the grid. */
function openFromGrid(w: PublicRoomWork) {
    tracker.count(w.id, 'clicks');
    openZoom(w);
}

function caption(w: PublicRoomWork) {
    return [w.artistName, [w.title || 'Untitled', w.dateText].filter(Boolean).join(', ')].join(', ');
}

// ---- Zoom: every image of the works on show ----
const zoomOpen = ref(false);
const zoomIndex = ref(0);
const zoomList = computed(() => works.value.flatMap((w) => w.images.map((img, n) => ({ url: img.url, alt: img.alt || caption(w), workId: w.id, n }))));
/** The zoom caption on phones: one line, or every detail once tapped (kept while moving between works). */
const captionOpen = ref(false);
const zoomWork = computed(() => works.value.find((w) => w.id === zoomList.value[zoomIndex.value]?.workId));
/** Each work shown in zoom counts as opened (a deliberate look). */
watch(
    () => (zoomOpen.value ? zoomWork.value?.id : undefined),
    (id) => {
        if (!id) return;
        tracker.count(id, 'focus');
        tracker.event('focus', { workId: id });
    },
);

function openZoom(w: PublicRoomWork, n = 0) {
    const i = zoomList.value.findIndex((z) => z.workId === w.id && z.n === n);
    if (i < 0) return;
    zoomIndex.value = i;
    zoomOpen.value = true;
    tracker.count(w.id, 'zooms');
}
watch([zoomOpen, zoomIndex], ([open]) => {
    const id = open ? (zoomList.value[zoomIndex.value]?.workId ?? null) : null;
    tracker.zooming(id);
});
function onZoomLevel(level: number) {
    const id = zoomList.value[zoomIndex.value]?.workId;
    if (!id) return;
    tracker.zooming(id, level);
    tracker.event('zoom', { workId: id, data: { level } });
}
function onZoomPointer(p: { x: number; y: number; zoom: number }) {
    const id = zoomList.value[zoomIndex.value]?.workId;
    if (id) tracker.pointer(id, p.x, p.y, p.zoom);
}

// ---- Inquire (a form; the API records it and counts it toward engagement) ----
const inquiry = ref<{ open: boolean; item: InquiryItem | null; target: InquiryTarget | null }>({ open: false, item: null, target: null });
function inquire(w: PublicRoomWork) {
    inquiry.value = {
        open: true,
        item: { title: w.title || 'Untitled', artist: w.artistName, date: w.dateText, medium: w.medium, dimensions: w.dimensions, image: w.images[0]?.url ?? null, price: w.price },
        target: { kind: 'room', token: props.token, workId: w.id, viewerName: props.room.viewer?.name ?? null },
    };
    zoomOpen.value = false;
}

// ---- Artists ----
function aboutArtist(w: PublicRoomWork) {
    zoomOpen.value = false;
    focusArtist.value = w.artistId;
    tab.value = 'artists';
    tracker.countArtist(w.artistId, 'opens');
    tracker.event('artist_open', { artistId: w.artistId, workId: w.id });
}
/** The Artists tab lists every artist (also leaves a single artist opened from a work). */
function openArtistsTab() {
    if (tab.value === 'artists' && !focusArtist.value) return;
    focusArtist.value = null;
    tab.value = 'artists';
    tracker.event('view_mode', { data: { mode: 'artists' } });
}
/** "About the artist" shows that artist only. */
const shownArtists = computed(() => (focusArtist.value ? props.room.artists.filter((a) => a.id === focusArtist.value) : props.room.artists));
function backToWork() {
    focusArtist.value = null;
    tab.value = 'works';
}
function showWorksBy(artistId: string) {
    filterArtist.value = artistId;
    tab.value = 'works';
}
function clearFilter() {
    filterArtist.value = null;
}

</script>

<template>
    <div class="w-full">
        <section class="container mx-auto px-3 pb-4 pt-8">
            <h1 class="mb-2 text-3xl md:text-4xl">{{ room.title }}</h1>
            <p v-if="room.subtitle" class="mb-2 text-xl text-slate-600" data-testid="room-subtitle">{{ room.subtitle }}</p>
            <p class="font-roboto text-sm font-light text-slate-500">
                <template v-if="room.viewer">Welcome, {{ room.viewer.name }}.</template>
                <!-- In admin preview the download is not recorded. -->
                <a v-if="room.hasPdf" :href="api.roomPdfUrl(token, preview)" download class="text-sky-900 underline-offset-2 hover:underline" :class="{ 'ml-2': room.viewer }" data-testid="room-pdf">Download PDF</a>
            </p>
            <div v-if="room.introHtml" class="room-rich mt-4 max-w-2xl" v-html="room.introHtml" />
        </section>

        <!-- Toolbar -->
        <div id="room-works" class="container mx-auto flex flex-wrap items-center justify-between gap-3 px-3 py-3 font-roboto text-sm font-light text-slate-500">
            <div role="tablist" class="flex gap-4">
                <button type="button" role="tab" :aria-selected="tab === 'works'" class="room-tab" :class="{ 'room-tab-on': tab === 'works' }" @click="tab = 'works'">
                    Works <span class="tabular-nums">({{ room.works.length }})</span>
                </button>
                <button v-if="hasArtists" type="button" role="tab" :aria-selected="tab === 'artists'" class="room-tab" :class="{ 'room-tab-on': tab === 'artists' }" @click="openArtistsTab">
                    {{ room.artists.length === 1 ? 'Artist' : 'Artists' }}
                </button>
            </div>
        </div>
        <div v-if="filterArtist && tab === 'works'" class="container mx-auto px-3 pb-2 font-roboto text-sm font-light text-slate-600">
            Works by {{ filterName }} ·
            <button type="button" class="text-sky-900 underline hover:text-slate-900" @click="clearFilter">Show all works</button>
        </div>

        <!-- Works: grid -->
        <section v-if="tab === 'works' && works.length" class="container mx-auto px-3 pb-10">
            <ul class="grid grid-cols-1 gap-x-4 gap-y-10 sm:grid-cols-2 md:grid-cols-3">
                <li v-for="w in works" :key="w.id" v-track-work="w.id" class="flex flex-col" data-testid="room-tile">
                    <!-- Images up to half the screen height: on phones at their own shape, from two columns in equal boxes. -->
                    <button type="button" class="group flex items-center justify-center enabled:cursor-zoom-in sm:h-[50vh]" :disabled="!w.images.length" :aria-label="`Zoom ${caption(w)}`" @click="openFromGrid(w)">
                        <ArtImage v-if="w.images[0]" :src="w.images[0].url" :alt="w.images[0].alt || caption(w)" sizes="(min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw" class="max-h-[50vh] max-w-full object-contain transition-opacity group-hover:opacity-80 sm:max-h-full" />
                        <span v-else class="flex h-40 items-center font-roboto text-xs font-light text-slate-400">No image</span>
                    </button>
                    <div class="mt-3">
                        <RoomWorkCaption :work="w" />
                        <RoomWorkActions :work="w" :about="hasAbout(w)" class="mt-3" @zoom="openZoom(w)" @inquire="inquire(w)" @about="aboutArtist(w)" />
                    </div>
                </li>
            </ul>
        </section>

        <p v-else-if="tab === 'works'" class="container mx-auto px-3 py-16 text-center text-slate-500">There are no works in this room yet.</p>

        <div v-if="tab === 'artists' && focusArtist" class="container mx-auto flex flex-wrap gap-x-4 px-3 pt-2 font-roboto text-sm font-light">
            <button type="button" class="text-sky-900 underline hover:text-slate-900" data-testid="back-to-work" @click="backToWork">← Back to the works</button>
            <button v-if="room.artists.length > 1" type="button" class="text-sky-900 underline hover:text-slate-900" @click="openArtistsTab">See all artists</button>
        </div>
        <RoomArtists v-if="tab === 'artists'" :artists="shownArtists" :token="token" :tracker="tracker" :focus="focusArtist" @show-works="showWorksBy" />

        <InquiryDialog v-model:open="inquiry.open" :item="inquiry.item" :target="inquiry.target" :preview="preview" />
        <ZoomViewer
            v-model:open="zoomOpen"
            v-model:index="zoomIndex"
            :images="zoomList"
            @zoom="onZoomLevel"
            @pointer="onZoomPointer"
        >
            <template #caption>
                <template v-if="zoomWork">
                    <!-- On phones one line until tapped, then every detail; larger screens always show everything. -->
                    <button
                        type="button"
                        class="flex w-full items-start justify-center gap-1 text-left sm:pointer-events-none sm:text-center"
                        :aria-expanded="captionOpen"
                        data-testid="zoom-details"
                        @click="captionOpen = !captionOpen"
                    >
                        <RoomWorkCaption :work="zoomWork" inline class="min-w-0 sm:line-clamp-none" :class="{ 'line-clamp-1': !captionOpen }" />
                        <i class="las la-angle-up mt-0.5 shrink-0 text-slate-400 transition-transform sm:hidden" :class="{ 'rotate-180': captionOpen }" aria-hidden="true"></i>
                        <span class="sr-only sm:hidden">{{ captionOpen ? 'Fewer details' : 'More details' }}</span>
                    </button>
                    <div v-if="hasAbout(zoomWork)" class="mt-1 font-roboto text-xs font-light" :class="{ 'hidden sm:block': !captionOpen }">
                        <button type="button" class="text-sky-900 underline-offset-2 hover:underline" @click="aboutArtist(zoomWork)">About the artist</button>
                    </div>
                </template>
            </template>
            <template #actions>
                <RoomWorkActions v-if="zoomWork" :work="zoomWork" :zoom="false" :about="false" class="mr-2" @inquire="inquire(zoomWork)" />
            </template>
        </ZoomViewer>
    </div>
</template>

<style scoped>
@reference "@/style.css";
.room-tab {
    @apply border-b border-transparent pb-0.5 hover:text-sky-900;
}
.room-tab-on {
    @apply border-sky-900 text-sky-900;
}
.room-rich :deep(p) {
    @apply mb-3;
}
.room-rich :deep(a) {
    @apply text-sky-900 underline;
}
</style>
