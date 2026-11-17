<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ImageCrop } from '@twelveten/shared';
import Dialog from '@/admin/ui/Dialog.vue';
import MediaButton from '@/admin/MediaButton.vue';
import { btnGhost, btnOutline, btnPrimary } from '@/admin/ui/buttons';
import CroppedImage from './CroppedImage.vue';
import ImageCropper from './ImageCropper.vue';
import type { CroppedChoice, ImageOption } from './crop';

/**
 * Pick an image (from `options`, or a new upload) and the part of it to use, framed at `aspect`.
 * Opens on `value`, else on `initial`, else the first option.
 */
const props = defineProps<{ title: string; options: ImageOption[]; value: CroppedChoice | null; initial?: string | null; aspect: number }>();
const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{ choose: [choice: CroppedChoice] }>();

const uploads = ref<ImageOption[]>([]);
const all = computed(() => {
    const seen = new Set<string>();
    return [...uploads.value, ...props.options].filter((o) => !seen.has(o.url) && seen.add(o.url));
});
const url = ref<string | null>(null);
const crop = ref<ImageCrop | null>(null);
const cropper = ref<InstanceType<typeof ImageCropper> | null>(null);

watch(open, (o) => {
    if (!o) return;
    uploads.value = props.value && !props.options.some((x) => x.url === props.value!.url) ? [{ url: props.value.url, label: 'Current image' }] : [];
    url.value = props.value?.url ?? props.initial ?? props.options[0]?.url ?? null;
    crop.value = props.value?.crop ?? null;
});

function pick(u: string) {
    if (u === url.value) return;
    url.value = u;
    crop.value = null;
}
function uploaded(u: string, file: File) {
    uploads.value = [{ url: u, label: file.name }, ...uploads.value];
    pick(u);
}
function use() {
    if (!url.value) return;
    emit('choose', { url: url.value, crop: crop.value });
    open.value = false;
}
</script>

<template>
    <Dialog v-model:open="open" :title="title" description="Choose an image, then drag the frame to the part to show. Drag a corner to resize." wide>
        <div class="grid gap-4 sm:grid-cols-[9rem_1fr]">
            <div class="flex max-h-[50vh] flex-row gap-2 overflow-auto sm:flex-col" data-testid="image-options">
                <MediaButton kind="image" label="Upload new…" class="!text-xs !shadow-none shrink-0" @uploaded="uploaded" />
                <button
                    v-for="o in all"
                    :key="o.url"
                    type="button"
                    class="w-28 shrink-0 rounded border-2 text-left sm:w-auto"
                    :class="o.url === url ? 'border-sky-700' : 'border-transparent hover:border-slate-300'"
                    :aria-pressed="o.url === url"
                    :aria-label="o.label"
                    @click="pick(o.url)"
                >
                    <CroppedImage :url="o.url" :aspect="4 / 3" />
                    <span class="block truncate px-1 py-0.5 text-[11px] text-slate-600">{{ o.label }}</span>
                </button>
            </div>
            <ImageCropper v-if="url" ref="cropper" v-model:crop="crop" :url="url" :aspect="aspect" />
            <p v-else class="self-center text-center text-sm text-slate-500">Add works to the room or upload an image.</p>
        </div>
        <template #footer>
            <button v-if="url" type="button" :class="btnGhost" class="mr-auto" @click="cropper?.reset()">Reset frame</button>
            <button type="button" :class="btnOutline" @click="open = false">Cancel</button>
            <button type="button" :class="btnPrimary" :disabled="!url || !crop" data-testid="use-image" @click="use">Use this image</button>
        </template>
    </Dialog>
</template>
