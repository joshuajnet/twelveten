<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { derivedUrl, isDerivable, type PointerPoint } from '@twelveten/shared';

/**
 * A work's image with where the visitor's pointer rested drawn over it: a density map in one
 * sequential hue (light → dark blue = more time), transparent where there was nothing.
 */
const props = withDefaults(defineProps<{ src: string; alt?: string; points: PointerPoint[]; show?: boolean }>(), { alt: '', show: true });

const img = ref<HTMLImageElement>();
/** A display copy (the heatmap only needs ~960px), falling back to the original. */
const failed = ref(false);
const shown = computed(() => (!failed.value && isDerivable(props.src) ? derivedUrl(props.src, 'w960.webp') : props.src));
const canvas = ref<HTMLCanvasElement>();
let observer: ResizeObserver | null = null;

// Sequential blue ramp, steps 150 → 700.
const RAMP = ['#b7d3f6', '#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281', '#0d366b'].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
function color(v: number): [number, number, number] {
    const x = Math.min(1, Math.max(0, v)) * (RAMP.length - 1);
    const i = Math.floor(x);
    const t = x - i;
    const a = RAMP[i]!;
    const b = RAMP[Math.min(RAMP.length - 1, i + 1)]!;
    return [0, 1, 2].map((k) => Math.round(a[k]! + (b[k]! - a[k]!) * t)) as [number, number, number];
}

function draw() {
    const el = img.value;
    const c = canvas.value;
    if (!el || !c || !el.complete || !el.clientWidth) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    if (!props.points.length) return;

    // Accumulate on a coarse grid with a gaussian kernel, then colour and scale up smoothly.
    const gw = 120;
    const gh = Math.max(1, Math.round((gw * h) / w));
    const grid = new Float32Array(gw * gh);
    const r = Math.max(2, Math.round(gw * 0.035));
    const kernel: number[] = [];
    for (let dy = -r * 2; dy <= r * 2; dy++) for (let dx = -r * 2; dx <= r * 2; dx++) kernel.push(Math.exp(-(dx * dx + dy * dy) / (2 * r * r)));
    for (const p of props.points) {
        const cx = Math.round(p.x * (gw - 1));
        const cy = Math.round(p.y * (gh - 1));
        let k = 0;
        for (let dy = -r * 2; dy <= r * 2; dy++) {
            for (let dx = -r * 2; dx <= r * 2; dx++, k++) {
                const x = cx + dx;
                const y = cy + dy;
                if (x >= 0 && y >= 0 && x < gw && y < gh) grid[y * gw + x]! += kernel[k]!;
            }
        }
    }
    let max = 0;
    for (const v of grid) if (v > max) max = v;
    if (!max) return;
    const small = new ImageData(gw, gh);
    for (let i = 0; i < grid.length; i++) {
        const v = grid[i]! / max;
        if (v < 0.04) continue;
        const [R, G, B] = color(v);
        small.data[i * 4] = R;
        small.data[i * 4 + 1] = G;
        small.data[i * 4 + 2] = B;
        small.data[i * 4 + 3] = Math.round(255 * (0.25 + 0.5 * v));
    }
    const off = document.createElement('canvas');
    off.width = gw;
    off.height = gh;
    off.getContext('2d')!.putImageData(small, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(off, 0, 0, c.width, c.height);
}

watch(() => [props.points, props.show], draw);
onMounted(() => {
    if (typeof ResizeObserver !== 'undefined' && img.value) {
        observer = new ResizeObserver(draw);
        observer.observe(img.value);
    }
});
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
    <div class="relative inline-block max-w-full">
        <img ref="img" :src="shown" :alt="alt" class="block max-h-80 max-w-full" loading="lazy" @load="draw" @error="failed = true" />
        <canvas v-show="show && points.length" ref="canvas" class="pointer-events-none absolute left-0 top-0" aria-hidden="true" />
    </div>
</template>
