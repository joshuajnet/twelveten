<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ImageCrop } from '@twelveten/shared';
import { fallBackTo, fitCrop, moveCrop, previewUrl, resizeCrop, type Corner } from './crop';

/** Choose the part of an image to use: a frame of `aspect` to drag, and corners to resize it. */
const props = defineProps<{ url: string; aspect: number }>();
const crop = defineModel<ImageCrop | null>('crop', { required: true });

const box = ref<HTMLElement | null>(null);
const ratio = ref<number | null>(null);
watch(
    () => props.url,
    () => (ratio.value = null),
);

function onLoad(e: Event) {
    const img = e.target as HTMLImageElement;
    ratio.value = img.naturalWidth / img.naturalHeight;
    crop.value = fitCrop(crop.value, ratio.value, props.aspect);
}

const frame = computed(() => {
    const c = crop.value;
    if (!c || !ratio.value) return null;
    return { left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%` };
});

let drag: { mode: 'move' | Corner; x: number; y: number; start: ImageCrop; w: number; h: number } | null = null;
function start(e: PointerEvent, mode: 'move' | Corner) {
    if (!crop.value || !box.value) return;
    const r = box.value.getBoundingClientRect();
    drag = { mode, x: e.clientX, y: e.clientY, start: crop.value, w: r.width, h: r.height };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
    e.stopPropagation();
}
function onMove(e: PointerEvent) {
    if (!drag || !ratio.value) return;
    const dx = (e.clientX - drag.x) / drag.w;
    const dy = (e.clientY - drag.y) / drag.h;
    crop.value = drag.mode === 'move' ? moveCrop(drag.start, dx, dy) : resizeCrop(drag.start, drag.mode, dx, dy, ratio.value, props.aspect);
}
const end = () => (drag = null);

function onKey(e: KeyboardEvent) {
    if (!crop.value) return;
    const step = e.shiftKey ? 0.05 : 0.01;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    crop.value = moveCrop(crop.value, d[0]!, d[1]!);
}

/** The largest centred frame. */
function reset() {
    if (ratio.value) crop.value = fitCrop(null, ratio.value, props.aspect);
}
defineExpose({ reset });

const corners: Corner[] = ['nw', 'ne', 'sw', 'se'];
const cornerClass: Record<Corner, string> = {
    nw: '-left-1.5 -top-1.5 cursor-nwse-resize',
    ne: '-right-1.5 -top-1.5 cursor-nesw-resize',
    sw: '-bottom-1.5 -left-1.5 cursor-nesw-resize',
    se: '-bottom-1.5 -right-1.5 cursor-nwse-resize',
};
</script>

<template>
    <div class="flex justify-center rounded bg-slate-900 p-2">
        <div ref="box" class="relative inline-block touch-none select-none overflow-hidden" data-testid="image-cropper">
            <img :key="url" :src="previewUrl(url, 1600)" alt="" class="block max-h-[50vh] max-w-full" draggable="false" @load="onLoad" @error="fallBackTo(url)($event)" />
            <div
                v-if="frame"
                class="absolute cursor-move outline outline-2 outline-white focus-visible:outline-sky-400"
                :style="{ ...frame, boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.55)' }"
                tabindex="0"
                role="slider"
                aria-label="Crop area: drag to move, drag a corner to resize, or use the arrow keys"
                :aria-valuetext="crop ? `${Math.round(crop.x * 100)}% from left, ${Math.round(crop.y * 100)}% from top, ${Math.round(crop.w * 100)}% wide` : ''"
                data-testid="crop-frame"
                @pointerdown="start($event, 'move')"
                @pointermove="onMove"
                @pointerup="end"
                @pointercancel="end"
                @keydown="onKey"
            >
                <span
                    v-for="c in corners"
                    :key="c"
                    class="absolute h-3 w-3 rounded-sm border border-slate-700 bg-white"
                    :class="cornerClass[c]"
                    :data-testid="`crop-${c}`"
                    @pointerdown="start($event, c)"
                    @pointermove="onMove"
                    @pointerup="end"
                    @pointercancel="end"
                />
            </div>
        </div>
    </div>
</template>
