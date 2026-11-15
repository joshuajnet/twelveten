<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import { formatDate, type PublicRoomArtist } from '@twelveten/shared';
import { api } from '@/api/client';
import type { RoomTracker } from '@/composables/useRoomTracker';
import ArtImage from '@/components/ArtImage.vue';

/** The room's artists: bio, CV (expandable, with a PDF) and press, as the gallery chose to show them. */
const props = defineProps<{ artists: PublicRoomArtist[]; token: string; tracker: RoomTracker; focus: string | null }>();
const emit = defineEmits<{ 'show-works': [artistId: string] }>();
const { vTrackArtist } = props.tracker;

const cvOpen = ref(new Set<string>());

function toggleCv(id: string) {
    const s = new Set(cvOpen.value);
    if (s.has(id)) s.delete(id);
    else {
        s.add(id);
        props.tracker.countArtist(id, 'cvOpens');
        props.tracker.event('cv_open', { artistId: id });
    }
    cvOpen.value = s;
}

function pressClicked(artistId: string, title: string) {
    props.tracker.countArtist(artistId, 'pressClicks');
    props.tracker.event('press_click', { artistId, data: { title: title.slice(0, 200) } });
}

async function scrollToFocus() {
    if (!props.focus) return;
    await nextTick();
    document.getElementById(`artist-${props.focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
onMounted(scrollToFocus);
watch(() => props.focus, scrollToFocus);
</script>

<template>
    <div class="container mx-auto px-3 pb-12">
        <article
            v-for="a in artists"
            :id="`artist-${a.id}`"
            :key="a.id"
            v-track-artist="a.id"
            class="scroll-mt-6 border-t border-zinc-100 py-8 first:border-t-0"
            data-testid="room-artist"
        >
            <div class="mb-4 flex items-center gap-4">
                <ArtImage sizes="64px" fit="cover" v-if="a.portrait" :src="a.portrait" alt="" class="h-16 w-16 rounded-full object-cover" />
                <div>
                    <h2 class="text-2xl">{{ a.name }}</h2>
                    <button type="button" class="font-roboto text-sm font-light text-sky-900 underline hover:text-slate-900" @click="emit('show-works', a.id)">
                        View their works in this room
                    </button>
                </div>
            </div>

            <div class="grid gap-8 md:grid-cols-3">
                <div class="md:col-span-2">
                    <div v-if="a.bioHtml" class="room-rich max-w-2xl" v-html="a.bioHtml" />
                    <div v-if="a.cvHtml" class="mt-4">
                        <div class="flex flex-wrap items-center gap-3 font-roboto text-sm font-light">
                            <button type="button" class="border px-3 py-1 text-slate-600 hover:text-sky-600" :aria-expanded="cvOpen.has(a.id)" @click="toggleCv(a.id)">
                                {{ cvOpen.has(a.id) ? 'Hide CV' : 'Read CV' }}
                            </button>
                            <a :href="api.roomCvUrl(token, a.id)" class="text-sky-900 underline hover:text-slate-900" download>Download CV (PDF)</a>
                        </div>
                        <div v-if="cvOpen.has(a.id)" class="room-rich mt-4 max-w-2xl text-sm" data-testid="room-cv" v-html="a.cvHtml" />
                    </div>
                </div>
                <aside v-if="a.press?.length" aria-label="Press">
                    <h3 class="mb-3 font-roboto text-xs font-light uppercase tracking-widest text-slate-500">Press</h3>
                    <ul class="space-y-4">
                        <li v-for="p in a.press" :key="p.id" data-testid="room-press">
                            <div class="italic">{{ p.outlet }}</div>
                            <a :href="p.url" target="_blank" rel="noopener noreferrer" class="font-medium text-sky-900 no-underline hover:underline" @click="pressClicked(a.id, p.title)">{{ p.title }}</a>
                            <div class="text-sm italic text-slate-600">{{ p.issueLabel ?? formatDate(p.publishedOn) }}</div>
                            <div v-if="p.byline" class="text-sm text-slate-600">{{ p.byline }}</div>
                        </li>
                    </ul>
                </aside>
            </div>
        </article>
    </div>
</template>

<style scoped>
@reference "@/style.css";
.room-rich :deep(p) {
    @apply mb-3;
}
.room-rich :deep(a) {
    @apply text-sky-900 underline;
}
.room-rich :deep(ul) {
    @apply mb-3 list-disc pl-5;
}
.room-rich :deep(ol) {
    @apply mb-3 list-decimal pl-5;
}
</style>
