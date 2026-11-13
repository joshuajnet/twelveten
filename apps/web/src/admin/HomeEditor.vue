<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { formatDateRange, todayIso, type ExhibitionSummary, type HomePage, type HomePatch } from '@twelveten/shared';
import { api } from '@/api/client';
import Footer from '@/components/Footer.vue';
import InlineText from './InlineText.vue';
import DateRangePicker from './DateRangePicker.vue';
import MediaButton from './MediaButton.vue';
import SocialPreview from './SocialPreview.vue';
import Dialog from './ui/Dialog.vue';
import Field from './ui/Field.vue';
import { adminApi, errorMessage, isConflict } from './api';
import { askConflict, changedKeys, clone, toast, useEditablePage, useUnsavedGuard } from './state';
import { btnOutline, btnPrimary } from './ui/buttons';
import { buildMeta } from '@twelveten/shared';

/** The home splash, edited in place: background, text, colour and where it links. */
const emit = defineEmits<{ saved: [HomePage] }>();

const KEYS = ['bgImage', 'bgImageMobile', 'bgFocalPoint', 'headline', 'subline', 'extraText', 'startsOn', 'endsOn', 'textColor', 'seoTitle', 'seoDescription', 'ogImage'] as const;

const original = ref<HomePage | null>(null);
const draft = ref<HomePage | null>(null);
const linkId = ref<string | null>(null);
const exhibitions = ref<ExhibitionSummary[]>([]);
const settingsOpen = ref(false);
const pickingFocus = ref(false);

function reset(h: HomePage) {
    original.value = h;
    draft.value = clone(h);
    linkId.value = h.link?.id ?? null;
}

async function load() {
    const [home, list] = await Promise.all([api.home(), api.exhibitions()]);
    exhibitions.value = list;
    reset(home);
}
onMounted(load);

const changed = computed(() => (draft.value && original.value ? changedKeys(draft.value, original.value, [...KEYS]) : []));
const dirty = computed(() => changed.value.length > 0 || linkId.value !== (original.value?.link?.id ?? null));

const linked = computed(() => exhibitions.value.find((e) => e.id === linkId.value) ?? null);
const dates = computed(() => {
    const d = draft.value;
    if (!d) return '';
    const s = linked.value?.startsOn ?? d.startsOn;
    const e = linked.value?.endsOn ?? d.endsOn;
    return s && e ? formatDateRange(s, e) : '';
});
const groups = computed(() => {
    const today = todayIso();
    const upcoming = exhibitions.value.filter((e) => e.endsOn >= today);
    const past = exhibitions.value.filter((e) => e.endsOn < today);
    return { upcoming, past };
});
const meta = computed(() =>
    draft.value
        ? buildMeta(
              { kind: 'home', home: { ...draft.value, link: linked.value ? { id: linked.value.id, slug: linked.value.slug, kind: linked.value.kind, startsOn: linked.value.startsOn, endsOn: linked.value.endsOn } : null } },
              { siteUrl: window.location.origin },
          )
        : null,
);

async function save(overwrite = false): Promise<void> {
    if (!draft.value || !original.value) return;
    try {
        const base = overwrite ? await api.home() : original.value;
        const patch: Record<string, unknown> = { updatedAt: base.updatedAt };
        for (const k of changed.value) patch[k] = draft.value[k];
        if (linkId.value !== (original.value.link?.id ?? null)) patch.linkExhibitionId = linkId.value;
        const saved = await adminApi.patchHome(patch as HomePatch);
        reset(saved);
        emit('saved', saved);
        toast('Saved', 'success', 1500);
    } catch (e) {
        if (isConflict(e)) {
            if ((await askConflict()) === 'overwrite') return save(true);
            await load();
        } else toast(errorMessage(e), 'error');
    }
}

useUnsavedGuard(dirty);
useEditablePage({
    label: 'Home page',
    dirty,
    save: () => save(),
    discard: () => original.value && reset(original.value),
    history: { entity: 'home_page', id: null },
    onRestored: load,
    openSettings: () => (settingsOpen.value = true),
});

function setFocus(e: MouseEvent) {
    if (!pickingFocus.value || !draft.value) return;
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 100);
    const y = Math.round(((e.clientY - r.top) / r.height) * 100);
    draft.value.bgFocalPoint = `${x}% ${y}%`;
    pickingFocus.value = false;
}

const textClass = computed(() => (draft.value?.textColor === 'white' ? 'text-white' : 'text-black'));
</script>

<template>
    <div v-if="draft" class="flex grow">
        <div class="fixed top-0 left-0 w-full h-full flex grow bg-cover bg-center" :class="{ 'cursor-crosshair': pickingFocus }">
            <div class="absolute top-[-4px] right-[-4px] left-[-4px] bottom-[-4px] bg-sky-900" @click="setFocus">
                <img :src="draft.bgImage" alt="" :style="{ objectPosition: draft.bgFocalPoint }" class="md:block hidden object-cover w-full h-full" />
                <img :src="draft.bgImageMobile ?? draft.bgImage" alt="" :style="{ objectPosition: draft.bgFocalPoint }" class="md:hidden object-cover w-full h-full" />
                <span
                    class="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ring-2 ring-sky-900"
                    :style="{ left: draft.bgFocalPoint.split(' ')[0], top: draft.bgFocalPoint.split(' ')[1] }"
                    aria-hidden="true"
                />
            </div>
            <div class="admin-ui absolute right-3 top-14 z-20 w-72 space-y-2 rounded-md bg-white/95 p-3 text-sm shadow-lg">
                <div class="flex flex-wrap gap-1">
                    <MediaButton label="Background" @uploaded="(url) => (draft!.bgImage = url)" />
                    <MediaButton label="Mobile background" @uploaded="(url) => (draft!.bgImageMobile = url)" />
                    <button v-if="draft.bgImageMobile" type="button" :class="btnOutline" @click="draft.bgImageMobile = null">Same on mobile</button>
                </div>
                <button type="button" :class="btnOutline" class="w-full justify-center" @click.stop="pickingFocus = !pickingFocus">
                    {{ pickingFocus ? 'Click the image to set the focus…' : `Focus point: ${draft.bgFocalPoint}` }}
                </button>
                <label class="block">
                    <span class="block text-xs font-medium text-slate-600">Text colour</span>
                    <select v-model="draft.textColor" class="mt-1 w-full rounded border border-slate-300 px-2 py-1">
                        <option value="black">Black</option>
                        <option value="white">White</option>
                    </select>
                </label>
                <label class="block">
                    <span class="block text-xs font-medium text-slate-600">Clicking the image opens</span>
                    <select v-model="linkId" class="mt-1 w-full rounded border border-slate-300 px-2 py-1">
                        <option :value="null">Nothing (no link)</option>
                        <optgroup label="Current & upcoming">
                            <option v-for="e in groups.upcoming" :key="e.id" :value="e.id">{{ e.kind === 'fair' ? 'Fair: ' : '' }}{{ e.title }}{{ e.published ? '' : ' (draft)' }}</option>
                        </optgroup>
                        <optgroup label="Past">
                            <option v-for="e in groups.past" :key="e.id" :value="e.id">{{ e.kind === 'fair' ? 'Fair: ' : '' }}{{ e.title }}</option>
                        </optgroup>
                    </select>
                </label>
                <p v-if="linked" class="text-xs text-slate-500">Dates come from “{{ linked.title }}”.</p>
                <div v-else class="text-xs">
                    <span class="block font-medium text-slate-600">Dates (optional)</span>
                    <DateRangePicker v-if="draft.startsOn && draft.endsOn" v-model:start="draft.startsOn" v-model:end="draft.endsOn" />
                    <button v-if="draft.startsOn" type="button" class="ml-2 text-sky-800 underline" @click="(draft.startsOn = null), (draft.endsOn = null)">Remove dates</button>
                    <button v-else type="button" class="text-sky-800 underline" @click="(draft.startsOn = todayIso()), (draft.endsOn = todayIso())">+ Add dates</button>
                </div>
            </div>
            <div class="relative z-10 container mx-auto text-sm py-8 mb-4 px-3 flex flex-col grow pointer-events-none">
                <div class="pointer-events-auto mt-auto flex w-full md:flex-row flex-col md:gap-6 md:justify-between" :class="textClass">
                    <div class="text-left text-lg">
                        <strong class="text-xl"><InlineText v-model="draft.headline" placeholder="Headline" /></strong><br />
                        <InlineText v-model="draft.subline" placeholder="Subline" /><br />
                        <InlineText v-model="draft.extraText" placeholder="Extra line (optional)" />
                    </div>
                    <div v-if="dates" class="md:block hidden md:text-right md:mt-auto text-lg">{{ dates }}</div>
                </div>
                <Footer class="relative z-10 grow-0! shrink!" />
            </div>
        </div>

        <Dialog v-if="meta" v-model:open="settingsOpen" title="Home page: search & sharing">
            <Field v-model="draft.seoTitle" label="Title override" :placeholder="meta.title" />
            <Field v-model="draft.seoDescription" label="Description override" :placeholder="meta.description" multiline />
            <div class="flex items-center gap-2 py-1.5">
                <span class="text-xs font-medium text-slate-600">Share image</span>
                <MediaButton :label="draft.ogImage ? 'Replace' : 'Upload'" @uploaded="(url) => (draft!.ogImage = url)" />
            </div>
            <SocialPreview :tags="meta" />
            <template #footer>
                <button type="button" :class="btnPrimary" @click="settingsOpen = false">Done</button>
            </template>
        </Dialog>
    </div>
</template>
