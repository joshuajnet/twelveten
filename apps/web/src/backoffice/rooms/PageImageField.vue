<script setup lang="ts">
import { ref } from 'vue';
import { PDF_PAGE_ASPECT } from '@twelveten/shared';
import CroppedImage from './CroppedImage.vue';
import ImagePickerDialog from './ImagePickerDialog.vue';
import type { CroppedChoice, ImageOption } from './crop';

/**
 * A full-page photo for the room PDF: a preview at the page's shape, "Choose…" / "Change…" (pick
 * from `options` or upload, and crop) and, once chosen, "Remove". Without a choice the preview
 * shows `fallback` (what the PDF uses then), and the picker opens on `initial` (default: `fallback`).
 */
withDefaults(defineProps<{ options: ImageOption[]; fallback?: string | null; initial?: string | null; title: string; removeLabel?: string; aspect?: number }>(), {
    fallback: null,
    initial: undefined,
    removeLabel: 'Remove',
    aspect: PDF_PAGE_ASPECT,
});
const value = defineModel<CroppedChoice | null>({ required: true });
const open = ref(false);
</script>

<template>
    <div class="flex items-center gap-2">
        <button v-if="value || fallback" type="button" class="w-16 shrink-0 overflow-hidden rounded border border-slate-200" :aria-label="`${title}: change`" @click="open = true">
            <CroppedImage :url="(value?.url ?? fallback)!" :crop="value?.crop" :aspect="aspect" />
        </button>
        <button type="button" class="text-xs text-sky-800 hover:underline" @click="open = true">{{ value ? 'Change…' : 'Choose…' }}</button>
        <button v-if="value" type="button" class="text-[11px] text-red-700 hover:underline" @click="value = null">{{ removeLabel }}</button>
        <ImagePickerDialog v-model:open="open" :title="title" :options="options" :value="value" :initial="initial === undefined ? fallback : initial" :aspect="aspect" @choose="(c) => (value = c)" />
    </div>
</template>
