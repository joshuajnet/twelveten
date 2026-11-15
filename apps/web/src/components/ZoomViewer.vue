<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';

/**
 * Full-screen image inspector: wheel / pinch zoom around the pointer, drag to pan, double-click or
 * double-tap to toggle, keyboard (+ − 0, arrows, Esc). Zoom stops where one image pixel would cover
 * more than two screen pixels. Emits what the viewer looks at (for viewing-room tracking).
 */
export interface ZoomImage {
    url: string;
    alt?: string;
}

const props = defineProps<{ images: ZoomImage[] }>();
const open = defineModel<boolean>('open', { default: false });
const index = defineModel<number>('index', { default: 0 });
const emit = defineEmits<{
    /** A zoom gesture ended at this level (1 = fitted). */
    zoom: [level: number];
    /** Pointer position over the image (0–1 across, 0–1 down) at the current zoom. */
    pointer: [p: { x: number; y: number; zoom: number }];
    close: [];
}>();

const stage = ref<HTMLDivElement>();
const root = ref<HTMLDivElement>();
const closeBtn = ref<HTMLButtonElement>();
const natural = reactive({ w: 0, h: 0 });
const box = reactive({ w: 0, h: 0 });
const view = reactive({ scale: 1, tx: 0, ty: 0 });
const loaded = ref(false);
const animate = ref(false);
let returnFocus: HTMLElement | null = null;

const current = computed(() => props.images[index.value]);
const multiple = computed(() => props.images.length > 1);

/** Image size on screen at scale 1 (fitted inside the stage, never enlarged). */
const fit = computed(() => {
    if (!natural.w || !box.w) return { w: 0, h: 0, ratio: 1 };
    const ratio = Math.min(box.w / natural.w, box.h / natural.h, 1);
    return { w: natural.w * ratio, h: natural.h * ratio, ratio };
});
const maxScale = computed(() => Math.max(2, 2 / (fit.value.ratio || 1)));
const percent = computed(() => Math.round(view.scale * fit.value.ratio * 100));

function measure() {
    const r = stage.value?.getBoundingClientRect();
    if (r) {
        box.w = r.width;
        box.h = r.height;
    }
}

function clampPan() {
    const mx = Math.max(0, (fit.value.w * view.scale - box.w) / 2);
    const my = Math.max(0, (fit.value.h * view.scale - box.h) / 2);
    view.tx = Math.min(mx, Math.max(-mx, view.tx));
    view.ty = Math.min(my, Math.max(-my, view.ty));
}

/** Zoom to `scale`, keeping the stage point (px, py from the stage centre) still. */
function zoomTo(scale: number, px = 0, py = 0, smooth = false) {
    const s = Math.min(maxScale.value, Math.max(1, scale));
    const k = s / view.scale;
    view.tx = px - (px - view.tx) * k;
    view.ty = py - (py - view.ty) * k;
    view.scale = s;
    animate.value = smooth;
    clampPan();
}

let zoomEndTimer: ReturnType<typeof setTimeout> | undefined;
function zoomed() {
    clearTimeout(zoomEndTimer);
    zoomEndTimer = setTimeout(() => emit('zoom', Math.round(view.scale * 10) / 10), 400);
}

function reset(smooth = true) {
    animate.value = smooth;
    view.scale = 1;
    view.tx = 0;
    view.ty = 0;
}

function centreOffset(e: { clientX: number; clientY: number }) {
    const r = stage.value!.getBoundingClientRect();
    return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
}

function onWheel(e: WheelEvent) {
    e.preventDefault();
    const p = centreOffset(e);
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomTo(view.scale * Math.exp(-delta * 0.002), p.x, p.y);
    zoomed();
}

// ---- Pointer: drag to pan, two fingers to pinch, double tap ----
const pointers = new Map<number, { x: number; y: number }>();
let pinch: { dist: number; scale: number } | null = null;
let lastTap = 0;
let lastSample = 0;

function onPointerDown(e: PointerEvent) {
    stage.value!.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    animate.value = false;
    if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { dist: Math.hypot(a!.x - b!.x, a!.y - b!.y), scale: view.scale };
    }
    if (e.pointerType !== 'mouse' && pointers.size === 1) {
        const now = Date.now();
        if (now - lastTap < 300) toggleAt(e);
        lastTap = now;
    }
}

function onPointerMove(e: PointerEvent) {
    samplePointer(e);
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const mid = centreOffset({ clientX: (a!.x + b!.x) / 2, clientY: (a!.y + b!.y) / 2 });
        zoomTo((pinch.scale * Math.hypot(a!.x - b!.x, a!.y - b!.y)) / pinch.dist, mid.x, mid.y);
        zoomed();
    } else if (pointers.size === 1 && view.scale > 1) {
        view.tx += e.clientX - prev.x;
        view.ty += e.clientY - prev.y;
        clampPan();
    }
}

function onPointerUp(e: PointerEvent) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
}

function toggleAt(e: { clientX: number; clientY: number }) {
    const p = centreOffset(e);
    if (view.scale > 1.05) reset();
    else zoomTo(Math.min(3, maxScale.value), p.x, p.y, true);
    zoomed();
}

/** Where on the image the pointer is (at most four samples a second). */
function samplePointer(e: PointerEvent) {
    const now = performance.now();
    if (now - lastSample < 250 || !fit.value.w) return;
    const p = centreOffset(e);
    const x = (p.x - view.tx) / (fit.value.w * view.scale) + 0.5;
    const y = (p.y - view.ty) / (fit.value.h * view.scale) + 0.5;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    lastSample = now;
    emit('pointer', { x, y, zoom: view.scale });
}

// ---- Navigation and keyboard ----
function go(step: number) {
    if (!multiple.value) return;
    index.value = (index.value + step + props.images.length) % props.images.length;
}

function close() {
    open.value = false;
}

function onKey(e: KeyboardEvent) {
    const pan = 80;
    switch (e.key) {
        case 'Escape':
            close();
            break;
        case '+':
        case '=':
            zoomTo(view.scale * 1.5, 0, 0, true);
            zoomed();
            break;
        case '-':
        case '_':
            zoomTo(view.scale / 1.5, 0, 0, true);
            zoomed();
            break;
        case '0':
            reset();
            break;
        case 'ArrowLeft':
            if (view.scale > 1) (view.tx += pan), clampPan();
            else go(-1);
            break;
        case 'ArrowRight':
            if (view.scale > 1) (view.tx -= pan), clampPan();
            else go(1);
            break;
        case 'ArrowUp':
            view.ty += pan;
            clampPan();
            break;
        case 'ArrowDown':
            view.ty -= pan;
            clampPan();
            break;
        case 'Tab': {
            // Keep focus inside the viewer.
            const els = [...(root.value?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]') ?? [])];
            if (!els.length) break;
            const i = els.indexOf(document.activeElement as HTMLElement);
            const next = e.shiftKey ? (i <= 0 ? els.length - 1 : i - 1) : i === els.length - 1 ? 0 : i + 1;
            els[next]!.focus();
            break;
        }
        default:
            return;
    }
    e.preventDefault();
}

function onLoad(e: Event) {
    const img = e.target as HTMLImageElement;
    natural.w = img.naturalWidth;
    natural.h = img.naturalHeight;
    measure();
    loaded.value = true;
}

watch(index, () => {
    loaded.value = false;
    reset(false);
});

watch(
    open,
    async (o, was) => {
        if (o) {
            returnFocus = document.activeElement as HTMLElement | null;
            document.documentElement.style.overflow = 'hidden';
            reset(false);
            window.addEventListener('resize', onResize);
            await nextTick();
            measure();
            closeBtn.value?.focus();
        } else if (was) {
            document.documentElement.style.overflow = '';
            window.removeEventListener('resize', onResize);
            pointers.clear();
            returnFocus?.focus?.();
            emit('close');
        }
    },
    { immediate: true },
);

function onResize() {
    measure();
    clampPan();
}

onBeforeUnmount(() => {
    document.documentElement.style.overflow = '';
    window.removeEventListener('resize', onResize);
    clearTimeout(zoomEndTimer);
});

defineExpose({ zoomTo, reset, view });
</script>

<template>
    <Teleport to="body">
        <div
            v-if="open && current"
            ref="root"
            class="zoom-viewer fixed inset-0 z-[70] flex flex-col bg-white text-slate-700"
            role="dialog"
            aria-modal="true"
            :aria-label="current.alt ? `Zoom: ${current.alt}` : 'Zoom'"
            data-testid="zoom-viewer"
            @keydown="onKey"
        >
            <div class="flex items-center gap-1 border-b border-slate-100 px-3 py-2 font-roboto text-sm font-light">
                <span v-if="multiple" class="mr-2 tabular-nums text-slate-500">{{ index + 1 }} / {{ images.length }}</span>
                <button type="button" class="zv-btn" aria-label="Zoom out" :disabled="view.scale <= 1" @click="zoomTo(view.scale / 1.5, 0, 0, true), zoomed()">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg>
                </button>
                <span class="w-12 text-center tabular-nums" aria-live="polite" data-testid="zoom-level">{{ percent }}%</span>
                <button type="button" class="zv-btn" aria-label="Zoom in" :disabled="view.scale >= maxScale" @click="zoomTo(view.scale * 1.5, 0, 0, true), zoomed()">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                </button>
                <button type="button" class="zv-btn" aria-label="Fit to screen" :disabled="view.scale === 1" @click="reset()">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
                </button>
                <span class="flex-1" />
                <slot name="actions" :index="index" />
                <button ref="closeBtn" type="button" class="zv-btn" aria-label="Close" @click="close">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
            </div>

            <div
                ref="stage"
                class="relative flex-1 touch-none select-none overflow-hidden"
                :class="view.scale > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'"
                @wheel="onWheel"
                @pointerdown="onPointerDown"
                @pointermove="onPointerMove"
                @pointerup="onPointerUp"
                @pointercancel="onPointerUp"
                @dblclick="toggleAt"
            >
                <div v-if="!loaded" class="zv-loader" aria-hidden="true" />
                <img
                    :key="current.url"
                    :src="current.url"
                    :alt="current.alt ?? ''"
                    draggable="false"
                    class="absolute left-1/2 top-1/2 max-w-none"
                    :class="{ 'transition-transform duration-200 ease-out': animate, 'opacity-0': !loaded }"
                    :style="{
                        width: `${fit.w}px`,
                        height: `${fit.h}px`,
                        transform: `translate(-50%, -50%) translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
                    }"
                    @load="onLoad"
                />
                <template v-if="multiple && view.scale === 1">
                    <button type="button" class="zv-nav left-2" aria-label="Previous" @click.stop="go(-1)" @pointerdown.stop @dblclick.stop>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
                    </button>
                    <button type="button" class="zv-nav right-2" aria-label="Next" @click.stop="go(1)" @pointerdown.stop @dblclick.stop>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
                    </button>
                </template>
            </div>

            <div v-if="$slots.caption" class="border-t border-slate-100 px-3 py-2 text-center text-xs">
                <slot name="caption" :index="index" />
            </div>
            <p class="sr-only">Scroll or pinch to zoom, drag to move around, double-click to zoom in or out. Press Escape to close.</p>
        </div>
    </Teleport>
</template>

<style scoped>
@reference "@/style.css";
.zv-btn {
    @apply inline-flex h-9 w-9 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-sky-900 disabled:opacity-30 disabled:hover:bg-transparent;
}
.zv-btn svg,
.zv-nav svg {
    @apply h-5 w-5;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
}
.zv-nav {
    @apply absolute top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-slate-500 shadow-sm hover:text-sky-900;
}
.zv-loader {
    @apply absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 animate-spin rounded-full border-2 border-slate-200 border-t-sky-900;
}
</style>
