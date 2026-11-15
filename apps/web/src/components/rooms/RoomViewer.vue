<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { inquiryMailto, type PublicRoom, type PublicRoomWork } from '@twelveten/shared';
import ZoomViewer from '@/components/ZoomViewer.vue';
import { useRoomTracker } from '@/composables/useRoomTracker';
import RoomArtists from './RoomArtists.vue';

/** The works of a viewing room as a slideshow or grid, the artists, zoom and Inquire. */
const props = defineProps<{ room: PublicRoom; token: string; preview: boolean }>();

const tracker = useRoomTracker({ token: props.token, visitId: props.room.visitId });
const { vTrackWork } = tracker;

type Mode = 'slideshow' | 'grid';
const MODE_KEY = 'twelveten.room.mode';
const readMode = (): Mode => {
    try {
        return localStorage.getItem(MODE_KEY) === 'grid' ? 'grid' : 'slideshow';
    } catch {
        return 'slideshow';
    }
};
const mode = ref<Mode>(readMode());
const tab = ref<'works' | 'artists'>('works');
const focusArtist = ref<string | null>(null);
const filterArtist = ref<string | null>(null);
const index = ref(0);
const imageIndex = ref(0);

const works = computed(() => (filterArtist.value ? props.room.works.filter((w) => w.artistId === filterArtist.value) : props.room.works));
const current = computed<PublicRoomWork | undefined>(() => works.value[index.value]);
const filterName = computed(() => props.room.artists.find((a) => a.id === filterArtist.value)?.name ?? props.room.works.find((w) => w.artistId === filterArtist.value)?.artistName);
const artistIds = computed(() => new Set(props.room.artists.map((a) => a.id)));
const hasArtists = computed(() => props.room.artists.some((a) => a.bioHtml || a.cvHtml || a.press?.length));

function setMode(m: Mode) {
    if (mode.value === m) return;
    mode.value = m;
    try {
        localStorage.setItem(MODE_KEY, m);
    } catch {
        /* private mode */
    }
    tracker.event('view_mode', { data: { mode: m } });
}

/** Show work `i` in the slideshow (a deliberate look: counted as a focus). */
function show(i: number) {
    const n = works.value.length;
    if (!n) return;
    index.value = (i + n) % n;
    imageIndex.value = 0;
    const w = works.value[index.value]!;
    tracker.count(w.id, 'focus');
    tracker.event('focus', { workId: w.id });
}

function openInSlideshow(i: number) {
    setMode('slideshow');
    show(i);
    tracker.count(works.value[index.value]!.id, 'clicks');
    void nextTick(() => document.getElementById('room-works')?.scrollIntoView({ block: 'start' }));
}

function caption(w: PublicRoomWork) {
    return [w.artistName, [w.title || 'Untitled', w.dateText].filter(Boolean).join(', ')].join(', ');
}

// ---- Zoom: every image of the works on show ----
const zoomOpen = ref(false);
const zoomIndex = ref(0);
const zoomList = computed(() => works.value.flatMap((w) => w.images.map((img, n) => ({ url: img.url, alt: img.alt || caption(w), workId: w.id, n }))));
const zoomWork = computed(() => works.value.find((w) => w.id === zoomList.value[zoomIndex.value]?.workId));

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
function zoomClosed() {
    const z = zoomList.value[zoomIndex.value];
    const i = works.value.findIndex((w) => w.id === z?.workId);
    if (i >= 0 && mode.value === 'slideshow') {
        index.value = i;
        imageIndex.value = z!.n;
    }
}
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

// ---- Inquire ----
const roomUrl = `${location.origin}/rooms/${props.token}`;
const mailto = (w: PublicRoomWork) =>
    inquiryMailto(w, { to: props.room.inquiryEmail, viewerName: props.room.viewer?.name, roomTitle: props.room.title, roomUrl });
function inquired(w: PublicRoomWork) {
    tracker.count(w.id, 'inquiries');
    tracker.event('inquire', { workId: w.id });
}

// ---- Artists ----
function aboutArtist(w: PublicRoomWork) {
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
    index.value = 0;
}
function clearFilter() {
    filterArtist.value = null;
    index.value = 0;
}

// ---- Keyboard ----
function onKey(e: KeyboardEvent) {
    if (zoomOpen.value || tab.value !== 'works' || mode.value !== 'slideshow') return;
    const t = e.target as HTMLElement | null;
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    if (e.key === 'ArrowRight') show(index.value + 1);
    else if (e.key === 'ArrowLeft') show(index.value - 1);
    else return;
    e.preventDefault();
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
    <div class="w-full">
        <section class="container mx-auto px-3 pb-4 pt-8">
            <h1 class="mb-2 text-3xl md:text-4xl">{{ room.title }}</h1>
            <p v-if="room.viewer" class="font-roboto text-sm font-light text-slate-500">Welcome, {{ room.viewer.name }}.</p>
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
            <div v-if="tab === 'works' && works.length" class="flex items-center gap-1" role="group" aria-label="View">
                <button type="button" class="room-mode" :class="{ 'room-mode-on': mode === 'slideshow' }" :aria-pressed="mode === 'slideshow'" title="Slideshow" @click="setMode('slideshow')">
                    <i class="las la-expand text-lg" aria-hidden="true"></i><span class="sr-only">Slideshow</span>
                </button>
                <button type="button" class="room-mode" :class="{ 'room-mode-on': mode === 'grid' }" :aria-pressed="mode === 'grid'" title="Grid" @click="setMode('grid')">
                    <i class="las la-th text-lg" aria-hidden="true"></i><span class="sr-only">Grid</span>
                </button>
            </div>
        </div>
        <div v-if="filterArtist && tab === 'works'" class="container mx-auto px-3 pb-2 font-roboto text-sm font-light text-slate-600">
            Works by {{ filterName }} ·
            <button type="button" class="text-sky-900 underline hover:text-slate-900" @click="clearFilter">Show all works</button>
        </div>

        <!-- Works: slideshow -->
        <section v-if="tab === 'works' && mode === 'slideshow' && current" class="border-y border-zinc-100 px-3 py-6 shadow-inner" aria-roledescription="slideshow" :aria-label="room.title">
            <div v-track-work="current.id" class="relative mx-auto flex flex-col items-center" data-testid="room-slide">
                <div class="relative flex w-full justify-center">
                    <button
                        v-if="works.length > 1"
                        type="button"
                        class="room-half left-0"
                        aria-label="Previous work"
                        @click="show(index - 1)"
                    >
                        <i class="las la-angle-left text-2xl" aria-hidden="true"></i>
                    </button>
                    <button v-if="works.length > 1" type="button" class="room-half right-0 justify-end" aria-label="Next work" @click="show(index + 1)">
                        <i class="las la-angle-right text-2xl" aria-hidden="true"></i>
                    </button>
                    <img
                        v-if="current.images[imageIndex]"
                        :key="current.images[imageIndex]!.url"
                        :src="current.images[imageIndex]!.url"
                        :alt="current.images[imageIndex]!.alt || caption(current)"
                        class="room-image relative z-20 mx-auto max-w-[calc(100%-4rem)] cursor-zoom-in"
                        @click="openZoom(current, imageIndex)"
                    />
                    <div v-else class="flex h-64 w-full max-w-md items-center justify-center bg-slate-50 font-roboto text-sm font-light text-slate-400">No image</div>
                </div>
                <div v-if="current.images.length > 1" class="relative z-20 mt-3 flex flex-wrap justify-center gap-2" role="group" aria-label="Views of this work">
                    <button
                        v-for="(img, n) in current.images"
                        :key="img.url"
                        type="button"
                        class="h-14 w-14 overflow-hidden border bg-slate-50"
                        :class="n === imageIndex ? 'border-sky-900' : 'border-transparent opacity-70 hover:opacity-100'"
                        :aria-label="`View ${n + 1}`"
                        :aria-current="n === imageIndex"
                        @click="(imageIndex = n), tracker.count(current.id, 'clicks')"
                    >
                        <img :src="img.url" alt="" class="h-full w-full object-cover" loading="lazy" />
                    </button>
                </div>
                <div class="relative z-20 mx-auto mt-4 max-w-md text-center text-sm" aria-live="polite">
                    <div>{{ current.artistName }}</div>
                    <div><span class="italic">{{ current.title || 'Untitled' }}</span><span v-if="current.dateText">, {{ current.dateText }}</span></div>
                    <div v-if="current.medium">{{ current.medium }}</div>
                    <div v-if="current.dimensions">{{ current.dimensions }}</div>
                    <div v-if="current.edition">{{ current.edition }}</div>
                    <div v-if="current.price" class="mt-1" data-testid="room-price">{{ current.price }}</div>
                    <div v-if="current.statusLabel" class="mt-1 font-roboto text-xs font-light uppercase tracking-wider text-slate-500" data-testid="room-status">{{ current.statusLabel }}</div>
                    <div class="mt-3 flex flex-wrap justify-center gap-2 font-roboto text-xs font-light">
                        <button v-if="current.images.length" type="button" class="room-action" @click="openZoom(current, imageIndex)">
                            <i class="las la-search-plus mr-1" aria-hidden="true"></i>Zoom
                        </button>
                        <a v-if="current.available && room.inquiryEmail" :href="mailto(current)" class="room-action" data-testid="room-inquire" @click="inquired(current)">
                            <i class="las la-envelope mr-1" aria-hidden="true"></i>Inquire
                        </a>
                        <button v-if="artistIds.has(current.artistId)" type="button" class="room-action" @click="aboutArtist(current)">About the artist</button>
                    </div>
                    <div v-if="works.length > 1" class="mt-3 font-roboto text-xs font-light tabular-nums text-slate-400">{{ index + 1 }} / {{ works.length }}</div>
                </div>
            </div>
        </section>

        <!-- Works: grid -->
        <section v-else-if="tab === 'works' && mode === 'grid'" class="container mx-auto px-3 pb-10">
            <ul class="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
                <li v-for="(w, i) in works" :key="w.id" v-track-work="w.id" class="flex flex-col" data-testid="room-tile">
                    <button type="button" class="group flex h-[28vh] items-center justify-center bg-slate-50 p-2" :aria-label="`Open ${caption(w)}`" @click="openInSlideshow(i)">
                        <img v-if="w.images[0]" :src="w.images[0].url" :alt="w.images[0].alt || caption(w)" class="max-h-full max-w-full object-contain transition-opacity group-hover:opacity-80" loading="lazy" />
                        <span v-else class="font-roboto text-xs font-light text-slate-400">No image</span>
                    </button>
                    <div class="mt-2 text-sm leading-snug">
                        <div>{{ w.artistName }}</div>
                        <div><span class="italic">{{ w.title || 'Untitled' }}</span><span v-if="w.dateText">, {{ w.dateText }}</span></div>
                        <div v-if="w.price" class="text-slate-700">{{ w.price }}</div>
                        <div v-if="w.statusLabel" class="font-roboto text-xs font-light uppercase tracking-wider text-slate-500">{{ w.statusLabel }}</div>
                        <div class="mt-1 flex flex-wrap gap-x-3 font-roboto text-xs font-light">
                            <button v-if="w.images.length" type="button" class="text-slate-500 hover:text-sky-900" @click="openZoom(w)">
                                <i class="las la-search-plus" aria-hidden="true"></i> Zoom
                            </button>
                            <a v-if="w.available && room.inquiryEmail" :href="mailto(w)" class="text-slate-500 no-underline hover:text-sky-900" @click="inquired(w)">
                                <i class="las la-envelope" aria-hidden="true"></i> Inquire
                            </a>
                        </div>
                    </div>
                </li>
            </ul>
        </section>

        <p v-else-if="tab === 'works'" class="container mx-auto px-3 py-16 text-center text-slate-500">There are no works in this room yet.</p>

        <div v-if="tab === 'artists' && focusArtist" class="container mx-auto flex flex-wrap gap-x-4 px-3 pt-2 font-roboto text-sm font-light">
            <button type="button" class="text-sky-900 underline hover:text-slate-900" data-testid="back-to-work" @click="backToWork">← Back to the work</button>
            <button v-if="room.artists.length > 1" type="button" class="text-sky-900 underline hover:text-slate-900" @click="openArtistsTab">See all artists</button>
        </div>
        <RoomArtists v-if="tab === 'artists'" :artists="shownArtists" :token="token" :tracker="tracker" :focus="focusArtist" @show-works="showWorksBy" />

        <ZoomViewer
            v-model:open="zoomOpen"
            v-model:index="zoomIndex"
            :images="zoomList"
            @close="zoomClosed"
            @zoom="onZoomLevel"
            @pointer="onZoomPointer"
        >
            <template #caption>
                <template v-if="zoomWork">
                    <span>{{ zoomWork.artistName }}, </span><span class="italic">{{ zoomWork.title || 'Untitled' }}</span><span v-if="zoomWork.dateText">, {{ zoomWork.dateText }}</span>
                    <span v-if="zoomWork.price"> · {{ zoomWork.price }}</span>
                    <span v-if="zoomWork.statusLabel"> · {{ zoomWork.statusLabel }}</span>
                </template>
            </template>
            <template #actions>
                <a
                    v-if="zoomWork?.available && room.inquiryEmail"
                    :href="mailto(zoomWork)"
                    class="mr-2 border px-3 py-1 font-roboto text-xs font-light text-slate-600 no-underline hover:text-sky-600"
                    @click="inquired(zoomWork)"
                >
                    <i class="las la-envelope mr-1" aria-hidden="true"></i>Inquire
                </a>
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
.room-mode {
    @apply inline-flex h-8 w-8 items-center justify-center rounded text-slate-400 hover:text-sky-900;
}
.room-mode-on {
    @apply bg-slate-100 text-sky-900;
}
.room-half {
    @apply absolute top-0 z-10 flex h-full w-1/2 items-center text-slate-400 hover:text-sky-900;
}
.room-image {
    max-height: calc(100vh - 220px);
    width: auto;
}
.room-action {
    @apply inline-flex cursor-pointer items-center border px-3 py-1 text-slate-600 no-underline hover:text-sky-600 hover:shadow-sm;
}
.room-rich :deep(p) {
    @apply mb-3;
}
.room-rich :deep(a) {
    @apply text-sky-900 underline;
}
</style>
