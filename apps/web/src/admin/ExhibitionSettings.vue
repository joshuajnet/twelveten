<script setup lang="ts">
import { computed } from 'vue';
import { buildMeta, type Exhibition, type HeaderLink } from '@twelveten/shared';
import Dialog from './ui/Dialog.vue';
import Field from './ui/Field.vue';
import Switch from './ui/Switch.vue';
import MediaButton from './MediaButton.vue';
import SocialPreview from './SocialPreview.vue';
import { btnGhost, btnOutline, btnPrimary } from './ui/buttons';

/** Settings that aren't edited on the page itself: URL, type, toggles, links, SEO. */
const open = defineModel<boolean>('open', { required: true });
const draft = defineModel<Exhibition>('draft', { required: true });

const TIMEZONES = ['America/Chicago', 'America/New_York', 'America/Los_Angeles', 'America/Denver', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo'];

const meta = computed(() => buildMeta({ kind: 'exhibition', exhibition: draft.value }, { siteUrl: window.location.origin }));

function setLinks(links: HeaderLink[]) {
    draft.value = { ...draft.value, headerLinks: links };
}
function updateLink(i: number, key: keyof HeaderLink, value: string | null) {
    setLinks(draft.value.headerLinks.map((l, j) => (j === i ? { ...l, [key]: value ?? '' } : l)));
}
</script>

<template>
    <Dialog v-model:open="open" title="Page settings" wide>
        <div class="grid gap-x-6 sm:grid-cols-2">
            <div>
                <h3 class="mb-1 mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Page</h3>
                <label class="block py-1.5">
                    <span class="block text-xs font-medium text-slate-600">Type</span>
                    <select v-model="draft.kind" class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm">
                        <option value="exhibition">Exhibition</option>
                        <option value="fair">Fair</option>
                    </select>
                </label>
                <Field
                    :model-value="draft.slug"
                    label="Web address"
                    :hint="`${draft.kind === 'fair' ? '/fairs/' : '/exhibitions/'}${draft.slug} — changing it breaks old links`"
                    mono
                    @update:model-value="(v) => (draft.slug = (v ?? '').toLowerCase().replace(/[^a-z0-9-]+/g, '-'))"
                />
                <Field v-model="draft.subtitle" label="Subtitle" hint="Shown under the title, e.g. “curated by …” or a booth number" />
                <Field v-model="draft.locationText" label="Location for list cards" hint="e.g. Chicago, IL" />
                <label class="block py-1.5">
                    <span class="block text-xs font-medium text-slate-600">Time zone for event times</span>
                    <select v-model="draft.timezone" class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm">
                        <option v-for="tz in TIMEZONES" :key="tz" :value="tz">{{ tz.replace('_', ' ') }}</option>
                    </select>
                </label>
                <Switch v-model="draft.titleFirst" label="Title above artists" hint="For group shows" />
                <Switch v-model="draft.showInquire" label="Inquire button in header" />

                <h3 class="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Header links</h3>
                <div v-for="(l, i) in draft.headerLinks" :key="i" class="mb-2 flex items-end gap-2">
                    <div class="flex-1"><Field :model-value="l.label" label="Label" @update:model-value="(v) => updateLink(i, 'label', v)" /></div>
                    <div class="flex-[2]"><Field :model-value="l.url" label="Address" @update:model-value="(v) => updateLink(i, 'url', v)" /></div>
                    <button type="button" :class="btnGhost" class="mb-2" aria-label="Remove link" @click="setLinks(draft.headerLinks.filter((_, j) => j !== i))">×</button>
                </div>
                <button type="button" :class="btnOutline" @click="setLinks([...draft.headerLinks, { label: 'Link', url: 'https://' }])">+ Add link</button>
            </div>
            <div>
                <h3 class="mb-1 mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Images</h3>
                <div class="flex items-center gap-3 py-1.5">
                    <img v-if="draft.thumbnail" :src="draft.thumbnail" alt="" class="h-16 w-16 rounded object-cover" />
                    <div>
                        <span class="block text-xs font-medium text-slate-600">List thumbnail</span>
                        <MediaButton :label="draft.thumbnail ? 'Replace' : 'Upload'" @uploaded="(url) => (draft.thumbnail = url)" />
                        <button v-if="draft.thumbnail" type="button" :class="btnGhost" @click="draft.thumbnail = null">Use hero</button>
                    </div>
                </div>
                <Field v-model="draft.heroAlt" label="Hero image description (alt text)" multiline />

                <h3 class="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Search & sharing</h3>
                <Field v-model="draft.seoTitle" label="Title override" :placeholder="meta.title" />
                <Field v-model="draft.seoDescription" label="Description override" :placeholder="meta.description" multiline />
                <div class="flex items-center gap-2 py-1.5">
                    <span class="text-xs font-medium text-slate-600">Share image</span>
                    <MediaButton :label="draft.ogImage ? 'Replace' : 'Upload'" @uploaded="(url) => (draft.ogImage = url)" />
                    <button v-if="draft.ogImage" type="button" :class="btnGhost" @click="draft.ogImage = null">Use hero</button>
                </div>
                <SocialPreview :tags="meta" />
            </div>
        </div>
        <template #footer>
            <button type="button" :class="btnPrimary" @click="open = false">Done</button>
        </template>
    </Dialog>
</template>
