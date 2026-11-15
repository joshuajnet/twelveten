<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { Artwork, PersonSummary, WorkSummary } from '@twelveten/shared';
import Dialog from './ui/Dialog.vue';
import { errorMessage } from './api';
import { toast } from './state';
import { btnGhost, btnPrimary } from './ui/buttons';
import PersonPicker from '@/backoffice/PersonPicker.vue';
import { boApi } from '@/backoffice/api';

/**
 * Link a slideshow slide to an artist (looked up from People) and an inventory work: by default a
 * new work made from the slide's caption and image, or one of the artist's existing works.
 */
const props = defineProps<{ slide: Artwork | null; preferIds: string[] }>();
const emit = defineEmits<{ linked: [slide: Artwork] }>();
const open = defineModel<boolean>('open', { required: true });

const person = ref<PersonSummary | null>(null);
const mode = ref<'new' | 'existing'>('new');
const works = ref<WorkSummary[]>([]);
const workId = ref('');
const busy = ref(false);

watch(open, (o) => {
    if (!o) return;
    person.value = null;
    mode.value = 'new';
    works.value = [];
    workId.value = '';
});

async function choose(p: PersonSummary) {
    person.value = p;
    mode.value = 'new';
    workId.value = '';
    works.value = p.profiles.includes('artist') ? (await boApi.works({ artist: p.id, limit: 50 }).catch(() => ({ items: [] }))).items : [];
}

const needsProfile = computed(() => person.value && !person.value.profiles.includes('artist'));
const caption = computed(() => {
    const s = props.slide;
    return s ? [s.title || 'Untitled', s.dateText, s.media, s.dimensions].filter(Boolean).join(', ') : '';
});

async function save() {
    if (!props.slide || !person.value) return;
    if (mode.value === 'existing' && !workId.value) return void toast('Choose one of the artist’s works', 'error');
    busy.value = true;
    try {
        const linked = await boApi.linkArtwork(props.slide.id, { personId: person.value.id, ...(mode.value === 'existing' ? { workId: workId.value } : {}) });
        emit('linked', linked);
        open.value = false;
        toast(`Linked to ${person.value.name}`, 'success', 2000);
    } catch (e) {
        toast(errorMessage(e), 'error');
    } finally {
        busy.value = false;
    }
}
</script>

<template>
    <Dialog v-model:open="open" title="Link to an artist" description="Connects this image to the artist’s profile and inventory. The public page doesn’t change." wide>
        <div v-if="slide" class="grid gap-4 sm:grid-cols-[8rem_1fr]">
            <div>
                <img v-if="slide.image" :src="slide.image" :alt="slide.alt" class="w-full rounded" />
                <video v-else-if="slide.video" :src="slide.video" class="w-full rounded" muted />
                <p class="mt-1 text-[11px] leading-tight text-slate-500">{{ caption }}</p>
            </div>
            <div class="space-y-3">
                <div v-if="!person">
                    <PersonPicker label="Artist" profile="artist" :initial-query="slide.author ?? ''" :prefer-ids="preferIds" placeholder="Search people…" @select="choose" />
                    <p class="mt-1 text-xs text-slate-500">Artists linked to this exhibition are listed first. Not there? Pick “Create new person”.</p>
                </div>
                <div v-else class="text-sm">
                    <span class="block text-xs font-medium text-slate-600">Artist</span>
                    <span class="font-medium">{{ person.name }}</span>
                    <button type="button" class="ml-2 text-xs text-slate-500 hover:underline" @click="person = null">Change</button>
                    <p v-if="needsProfile" class="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">{{ person.name }} has no artist profile yet — one will be added.</p>
                </div>

                <fieldset v-if="person" class="space-y-1.5 text-sm">
                    <legend class="mb-1 text-xs font-medium text-slate-600">Work</legend>
                    <label class="flex items-start gap-2">
                        <input v-model="mode" type="radio" value="new" class="mt-0.5" />
                        <span>Create a new work from this slide <span class="block text-xs text-slate-500">Copies the caption and adds this image to the work.</span></span>
                    </label>
                    <label class="flex items-start gap-2" :class="{ 'opacity-50': !works.length }">
                        <input v-model="mode" type="radio" value="existing" :disabled="!works.length" class="mt-0.5" />
                        <span>One of {{ person.name }}’s existing works<span v-if="!works.length" class="text-xs text-slate-500"> (none yet)</span></span>
                    </label>
                    <select v-if="mode === 'existing'" v-model="workId" aria-label="Existing work" class="ml-6 w-[calc(100%-1.5rem)] rounded border border-slate-300 bg-white px-2 py-1.5 text-sm">
                        <option value="">Choose a work…</option>
                        <option v-for="w in works" :key="w.id" :value="w.id">{{ [w.inventoryNumber, w.title || 'Untitled', w.dateText].filter(Boolean).join(' · ') }}</option>
                    </select>
                </fieldset>
            </div>
        </div>
        <template #footer>
            <button type="button" :class="btnGhost" @click="open = false">Cancel</button>
            <button type="button" :class="btnPrimary" :disabled="!person || busy" @click="save">{{ busy ? 'Linking…' : 'Link' }}</button>
        </template>
    </Dialog>
</template>
