<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import Sortable from 'sortablejs';
import type { Artwork, ArtworkPatch } from '@twelveten/shared';
import { adminApi, errorMessage, isConflict } from './api';
import { pickFiles, uploadFile } from './upload';
import { toast } from './state';
import Dialog from './ui/Dialog.vue';
import Field from './ui/Field.vue';
import Switch from './ui/Switch.vue';
import MediaButton from './MediaButton.vue';
import { btnDanger, btnOutline, btnPrimary } from './ui/buttons';

/**
 * Arrange view of the slideshow while editing: drag to reorder, add/replace/delete slides,
 * edit captions, hide slides, mark works available. Slide changes save immediately.
 */
const props = defineProps<{ exhibitionId: string }>();
const slides = defineModel<Artwork[]>('slides', { required: true });
const visible = defineModel<boolean>('visible', { required: true });
const worksAvailable = defineModel<boolean>('worksAvailable', { required: true });

const grid = ref<HTMLElement | null>(null);
let sortable: Sortable | null = null;

onMounted(() => {
    if (!grid.value) return;
    sortable = Sortable.create(grid.value, {
        animation: 150,
        ghostClass: 'tt-drag-ghost',
        handle: '[data-drag]',
        onEnd: async (evt) => {
            if (evt.oldIndex === undefined || evt.newIndex === undefined || evt.oldIndex === evt.newIndex) return;
            const next = [...slides.value];
            const [moved] = next.splice(evt.oldIndex, 1);
            next.splice(evt.newIndex, 0, moved!);
            // Let Vue re-render from data rather than keep Sortable's DOM move.
            slides.value = [];
            await nextTick();
            slides.value = next;
            try {
                slides.value = await adminApi.orderArtworks(props.exhibitionId, next.map((s) => s.id));
                toast('Slide order saved', 'success', 1500);
            } catch (e) {
                toast(errorMessage(e), 'error');
            }
        },
    });
});
onBeforeUnmount(() => sortable?.destroy());

const uploads = ref<{ name: string; progress: number }[]>([]);
async function addSlides() {
    const files = await pickFiles('media', true);
    for (const file of files) {
        const entry = reactive({ name: file.name, progress: 0 });
        uploads.value.push(entry);
        try {
            const url = await uploadFile(file, (f) => (entry.progress = f));
            const isVideo = file.type.startsWith('video/');
            const created = await adminApi.addArtwork(props.exhibitionId, {
                image: isVideo ? null : url,
                video: isVideo ? url : null,
                alt: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
            });
            slides.value = [...slides.value, created];
        } catch (e) {
            toast(`${file.name}: ${errorMessage(e)}`, 'error');
        } finally {
            uploads.value = uploads.value.filter((u) => u !== entry);
        }
    }
}

async function patch(slide: Artwork, changes: Omit<ArtworkPatch, 'updatedAt'>) {
    try {
        const updated = await adminApi.patchArtwork(slide.id, { ...changes, updatedAt: slide.updatedAt });
        slides.value = slides.value.map((s) => (s.id === slide.id ? updated : s));
        return updated;
    } catch (e) {
        if (isConflict(e)) {
            toast('This slide was changed elsewhere — reloaded', 'error');
            const fresh = await adminApi.exhibition(props.exhibitionId);
            slides.value = fresh.artworks;
        } else toast(errorMessage(e), 'error');
        return null;
    }
}

const confirmDelete = ref<Artwork | null>(null);
async function remove(slide: Artwork) {
    try {
        await adminApi.deleteArtwork(slide.id);
        slides.value = slides.value.filter((s) => s.id !== slide.id).map((s, position) => ({ ...s, position }));
        toast('Slide deleted', 'success', 1500);
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
    confirmDelete.value = null;
}

// Caption editor
const editing = ref<Artwork | null>(null);
const FIELDS = ['author', 'title', 'dateText', 'dimensions', 'media', 'credit', 'alt'] as const;
type CaptionField = (typeof FIELDS)[number];
const form = reactive<Record<CaptionField, string | null>>({ author: null, title: null, dateText: null, dimensions: null, media: null, credit: null, alt: null });
function edit(slide: Artwork) {
    editing.value = slide;
    for (const k of FIELDS) form[k] = (slide[k] as string | null) ?? null;
}
async function saveCaption() {
    if (!editing.value) return;
    const changes: Record<string, string | null> = {};
    for (const k of FIELDS) changes[k] = k === 'alt' ? (form[k] ?? '') : (form[k] ?? null);
    if (await patch(editing.value, changes)) editing.value = null;
}
async function replaceMedia(slide: Artwork, url: string, file: File) {
    const isVideo = file.type.startsWith('video/');
    const updated = await patch(slide, isVideo ? { video: url, image: null } : { image: url, video: null });
    if (updated && editing.value?.id === slide.id) editing.value = updated;
}
</script>

<template>
    <section class="admin-ui container mx-auto mb-6 px-3" aria-label="Slideshow">
        <div class="rounded-md border border-dashed border-sky-800/40 bg-slate-50 p-3">
            <div class="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1">
                <div class="w-56"><Switch v-model="visible" label="Show slideshow" /></div>
                <div class="w-56"><Switch v-model="worksAvailable" label="Works available" hint="Shows Inquire on available works" /></div>
                <span class="text-xs text-slate-500">{{ slides.length }} slides · drag ⠿ to reorder · changes save immediately</span>
                <button type="button" :class="btnPrimary" class="ml-auto" @click="addSlides">+ Add images or videos</button>
            </div>
            <div v-if="uploads.length" class="mb-3 space-y-1 text-xs">
                <div v-for="u in uploads" :key="u.name" class="flex items-center gap-2">
                    <span class="w-48 truncate">{{ u.name }}</span>
                    <span class="h-1.5 flex-1 rounded bg-slate-200"><span class="block h-1.5 rounded bg-sky-800" :style="{ width: `${u.progress * 100}%` }" /></span>
                </div>
            </div>
            <ol ref="grid" class="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                <li
                    v-for="s in slides"
                    :key="s.id"
                    class="group relative overflow-hidden rounded border bg-white"
                    :class="s.hidden ? 'border-slate-200 opacity-50' : 'border-slate-300'"
                >
                    <div class="relative aspect-square bg-slate-100">
                        <img v-if="s.image" :src="s.image" :alt="s.alt" class="h-full w-full object-contain" loading="lazy" />
                        <video v-else-if="s.video" :src="s.video" class="h-full w-full object-contain" muted preload="metadata" />
                        <span data-drag class="absolute left-1 top-1 cursor-grab rounded bg-white/90 px-1 text-sm shadow" title="Drag to reorder">⠿</span>
                        <span v-if="s.video" class="absolute right-1 top-1 rounded bg-black/70 px-1 text-[10px] text-white">video</span>
                    </div>
                    <div class="p-1.5 text-[11px] leading-tight">
                        <div class="truncate font-medium">{{ s.title || s.alt || 'Untitled' }}</div>
                        <div class="truncate text-slate-500">{{ s.author }}</div>
                        <div class="mt-1 flex flex-wrap gap-x-2">
                            <button type="button" class="text-sky-800 hover:underline" @click="edit(s)">Caption</button>
                            <button type="button" class="text-sky-800 hover:underline" @click="patch(s, { hidden: !s.hidden })">{{ s.hidden ? 'Show' : 'Hide' }}</button>
                            <button type="button" class="hover:underline" :class="s.available ? 'text-emerald-700' : 'text-slate-500'" @click="patch(s, { available: !s.available })">
                                {{ s.available ? 'Available ✓' : 'Available' }}
                            </button>
                            <button type="button" class="text-red-700 hover:underline" @click="confirmDelete = s">Delete</button>
                        </div>
                    </div>
                </li>
            </ol>
            <p v-if="!slides.length" class="py-6 text-center text-sm text-slate-500">No slides yet.</p>
        </div>

        <Dialog :open="Boolean(editing)" title="Slide caption" wide @update:open="(o) => !o && (editing = null)">
            <div v-if="editing" class="grid gap-4 sm:grid-cols-[10rem_1fr]">
                <div>
                    <img v-if="editing.image" :src="editing.image" alt="" class="mb-2 w-full rounded" />
                    <video v-else-if="editing.video" :src="editing.video" class="mb-2 w-full rounded" muted controls />
                    <MediaButton kind="media" label="Replace file" @uploaded="(url, file) => replaceMedia(editing!, url, file)" />
                </div>
                <div>
                    <Field v-model="form.author" label="Artist" />
                    <Field v-model="form.title" label="Title" />
                    <Field v-model="form.dateText" label="Date" hint="e.g. 2024 or 2023–2024" />
                    <Field v-model="form.media" label="Materials" />
                    <Field v-model="form.dimensions" label="Dimensions" />
                    <Field v-model="form.credit" label="Credit" />
                    <Field v-model="form.alt" label="Description for screen readers (alt text)" multiline />
                </div>
            </div>
            <template #footer>
                <button type="button" :class="btnOutline" @click="editing = null">Cancel</button>
                <button type="button" :class="btnPrimary" @click="saveCaption">Save caption</button>
            </template>
        </Dialog>

        <Dialog :open="Boolean(confirmDelete)" title="Delete this slide?" description="It can be restored from History." @update:open="(o) => !o && (confirmDelete = null)">
            <template #footer>
                <button type="button" :class="btnOutline" @click="confirmDelete = null">Cancel</button>
                <button type="button" :class="btnDanger" class="!bg-red-700 !text-white" @click="remove(confirmDelete!)">Delete</button>
            </template>
        </Dialog>
    </section>
</template>
