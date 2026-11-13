<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { exhibitionPath, joinArtists, type EventInput, type Exhibition, type ExhibitionPatch } from '@twelveten/shared';
import InlineText from './InlineText.vue';
import RichEditor from './RichEditor.vue';
import DateRangePicker from './DateRangePicker.vue';
import EventsEditor from './EventsEditor.vue';
import MediaButton from './MediaButton.vue';
import SlideshowEditor from './SlideshowEditor.vue';
import ExhibitionSettings from './ExhibitionSettings.vue';
import { adminApi, errorMessage, isConflict } from './api';
import { askConflict, changedKeys, clone, toast, useEditablePage, useUnsavedGuard } from './state';
import { btnGhost } from './ui/buttons';

/**
 * The exhibition/fair page with every part editable in place. Layout and classes mirror
 * ExhibitionTemplate + ExhibitionHeader so editing looks like the published page.
 */
const props = defineProps<{ exhibitionId: string }>();
const emit = defineEmits<{ saved: [Exhibition] }>();
const router = useRouter();

const PAGE_KEYS = [
    'slug', 'kind', 'artists', 'title', 'subtitle', 'titleFirst', 'startsOn', 'endsOn', 'timezone', 'hoursText', 'venueText',
    'locationText', 'heroImage', 'heroAlt', 'thumbnail', 'pressReleaseUrl', 'headerLinks', 'showInquire', 'slideshowVisible',
    'worksAvailable', 'content', 'seoTitle', 'seoDescription', 'ogImage',
] as const satisfies readonly (keyof Exhibition & keyof ExhibitionPatch)[];

const original = ref<Exhibition | null>(null);
const draft = ref<Exhibition | null>(null);
const events = ref<EventInput[]>([]);
const settingsOpen = ref(false);

const toEvents = (e: Exhibition): EventInput[] => e.events.map((ev) => ({ label: ev.label, startsAt: ev.startsAt, endsAt: ev.endsAt }));

function reset(e: Exhibition) {
    original.value = e;
    draft.value = clone(e);
    events.value = toEvents(e);
}

async function load() {
    reset(await adminApi.exhibition(props.exhibitionId));
}
watch(() => props.exhibitionId, () => void load(), { immediate: true });

const changed = computed(() => (draft.value && original.value ? changedKeys(draft.value, original.value, [...PAGE_KEYS]) : []));
const eventsChanged = computed(() => original.value !== null && JSON.stringify(events.value) !== JSON.stringify(toEvents(original.value)));
const dirty = computed(() => changed.value.length > 0 || eventsChanged.value);
const published = computed(() => original.value?.published ?? null);

async function save(overwrite = false): Promise<void> {
    if (!draft.value || !original.value) return;
    const d = draft.value;
    if (d.endsOn < d.startsOn) return void toast('The end date is before the start date', 'error');
    try {
        let base = original.value;
        if (overwrite) base = await adminApi.exhibition(props.exhibitionId);
        if (eventsChanged.value) base = await adminApi.putEvents(base.id, events.value);
        let saved = base;
        if (changed.value.length) {
            const patch: Record<string, unknown> = { updatedAt: base.updatedAt };
            for (const k of changed.value) patch[k] = d[k];
            saved = await adminApi.patchExhibition(base.id, patch as ExhibitionPatch);
        }
        const moved = exhibitionPath(saved) !== exhibitionPath(original.value);
        reset(saved);
        emit('saved', saved);
        toast('Saved', 'success', 1500);
        if (moved) await router.replace(exhibitionPath(saved));
    } catch (e) {
        if (isConflict(e)) {
            const choice = await askConflict();
            if (choice === 'overwrite') return save(true);
            await load();
            toast('Reloaded the latest version', 'info');
        } else toast(errorMessage(e), 'error');
    }
}

async function setPublished(on: boolean) {
    if (!original.value) return;
    try {
        const saved = await adminApi.patchExhibition(original.value.id, { updatedAt: original.value.updatedAt, published: on });
        original.value = { ...original.value, published: saved.published, updatedAt: saved.updatedAt };
        if (draft.value) draft.value.updatedAt = saved.updatedAt;
        toast(on ? 'Published' : 'Unpublished — only admins can see it', 'success');
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}

useUnsavedGuard(dirty);
useEditablePage({
    label: computed(() => (draft.value ? `${draft.value.kind === 'fair' ? 'Fair' : 'Exhibition'}: ${draft.value.title}` : '')),
    dirty,
    save: () => save(),
    discard: () => original.value && reset(original.value),
    published,
    setPublished,
    history: { entity: 'exhibition', id: props.exhibitionId },
    onRestored: load,
    openSettings: () => (settingsOpen.value = true),
    remove: async () => {
        if (!original.value) return;
        const list = original.value.kind === 'fair' ? '/fairs' : '/exhibitions';
        await adminApi.deleteExhibition(original.value.id);
        toast('Deleted — it can be restored from More ▸ Recently deleted', 'success');
        await router.push(list);
    },
});

const artistsLabel = computed(() => (draft.value?.titleFirst ? 'Artists, one per line' : 'Artist(s), one per line'));
const heroAlt = computed(() => {
    const e = draft.value;
    return e ? (e.heroAlt ?? `${joinArtists(e.artists)}: ${e.title}`) : '';
});
</script>

<template>
    <div v-if="draft" class="flex flex-col grow">
        <SlideshowEditor
            v-model:slides="draft.artworks"
            v-model:visible="draft.slideshowVisible"
            v-model:works-available="draft.worksAvailable"
            :exhibition-id="draft.id"
            @update:slides="(s) => original && (original.artworks = s)"
        />
        <div class="container mx-auto grid gap-6 px-3" :class="draft.heroImage ? 'md:grid-cols-2' : 'max-w-(--breakpoint-sm) md:grid-cols-1'">
            <div v-if="draft.heroImage" class="relative">
                <img :src="draft.heroImage" class="max-w-full w-auto h-auto mx-auto" :alt="heroAlt" />
                <div class="absolute right-2 top-2 flex gap-1">
                    <MediaButton label="Replace image" @uploaded="(url) => (draft!.heroImage = url)" />
                    <button type="button" class="admin-ui rounded bg-white/90 px-2 text-sm shadow" @click="draft.heroImage = null">Remove</button>
                </div>
            </div>
            <div id="press-release">
                <div v-if="!draft.heroImage" class="admin-ui mb-4"><MediaButton label="+ Add hero image" @uploaded="(url) => (draft!.heroImage = url)" /></div>
                <div class="grid md:grid-cols-2 grid-cols-1 gap-3 mb-6 mx-auto">
                    <div class="flex justify-between">
                        <div class="text-lg">
                            <template v-if="draft.titleFirst">
                                <strong><InlineText v-model="draft.title" placeholder="Title" label="Title" /></strong><br />
                                <InlineText v-model="draft.artists" multiline :placeholder="artistsLabel" :label="artistsLabel" tag="div" />
                            </template>
                            <template v-else>
                                <strong><InlineText v-model="draft.artists" multiline :placeholder="artistsLabel" :label="artistsLabel" tag="div" /></strong>
                                <em><InlineText v-model="draft.title" placeholder="Title" label="Title" /></em>
                            </template>
                            <template v-if="draft.subtitle"><br />{{ draft.subtitle }}</template>
                        </div>
                    </div>
                    <div class="md:text-right text-left">
                        <span v-if="draft.pressReleaseUrl" class="block mb-3">
                            <a :href="draft.pressReleaseUrl" target="_blank">PDF</a>
                            <span class="admin-ui ml-2 inline-flex gap-1 align-middle">
                                <MediaButton kind="pdf" label="Replace" @uploaded="(url) => (draft!.pressReleaseUrl = url)" />
                                <button type="button" :class="btnGhost" @click="draft.pressReleaseUrl = null">Remove</button>
                            </span>
                        </span>
                        <span v-else class="admin-ui block mb-3"><MediaButton kind="pdf" label="+ Press release PDF" @uploaded="(url) => (draft!.pressReleaseUrl = url)" /></span>
                        <span v-for="link in draft.headerLinks" :key="link.url" class="block mb-3 text-sky-900 underline">{{ link.label }}</span>
                        <DateRangePicker v-model:start="draft.startsOn" v-model:end="draft.endsOn" /><br />
                        <EventsEditor v-model="events" :timezone="draft.timezone" :default-day="draft.startsOn" />
                        <InlineText v-model="draft.venueText" multiline placeholder="Venue (optional)" label="Venue" tag="div" />
                        <InlineText v-model="draft.hoursText" placeholder="Hours (optional)" label="Hours" /><br />
                        <span
                            v-if="draft.showInquire"
                            class="py-1 px-3 inline-block border mt-3 font-roboto font-light text-sm text-sky-900"
                        >
                            Inquire
                        </span>
                    </div>
                </div>
                <div class="text-justify max-w-(--breakpoint-sm) mx-auto">
                    <RichEditor v-model="draft.content" placeholder="Press release text…" />
                    <div v-if="draft.press.length" class="admin-ui mt-2 text-xs text-slate-500">
                        {{ draft.press.length }} press item(s) are linked to this page and show where a “Press list” block is placed.
                    </div>
                </div>
            </div>
        </div>
        <ExhibitionSettings v-model:open="settingsOpen" v-model:draft="draft" />
    </div>
    <div v-else class="flex grow" aria-busy="true" />
</template>
