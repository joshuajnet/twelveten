<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { DISPLAY_WIDTHS, derivedUrl, imageSrcset, isDerivable, placeholderUrl, zoomUrl } from '@twelveten/shared';

/**
 * An image served from its derivatives, sharpening quietly as needed. The browser first picks a WebP
 * width from `srcset`/`sizes` (a tiny copy shows until it loads). Once it is on screen, if it is drawn
 * larger than that copy (high-density screens, `object-fit: cover`, a box larger than `sizes` said),
 * the next larger copy is fetched in the background and swapped in, step by step up to the zoom copy
 * and finally the original. Missing derivatives are skipped; with none at all it shows the original.
 * Other images (SVG, GIF, outside /media) render as given.
 */
const props = withDefaults(
    defineProps<{
        src: string;
        alt?: string;
        /** Rendered width hint for the first pick, e.g. '(min-width: 768px) 50vw, 100vw'. */
        sizes?: string;
        /** Load straight away (above the fold) instead of lazily. */
        eager?: boolean;
        /** How the image fills its box (the placeholder and the size needed follow it). */
        fit?: 'contain' | 'cover';
        /**
         * Main images (full-screen, the work on show): after the first copy appears, keep going up to
         * the high-quality zoom copy in the background, whatever the screen needs.
         */
        sharpest?: boolean;
    }>(),
    { alt: '', sizes: '100vw', eager: false, fit: 'contain', sharpest: false },
);
const emit = defineEmits<{ load: [e: Event] }>();

const img = ref<HTMLImageElement>();
const failed = ref(false);
const loaded = ref(false);
/**
 * A larger copy swapped in after the first load. It keeps a one-entry srcset with its true width,
 * so the image keeps the same layout size as with the first pick (no jump when it swaps).
 */
const upgraded = ref<{ url: string; width: number } | null>(null);
let probe: HTMLImageElement | null = null;

const derivable = computed(() => !failed.value && isDerivable(props.src));
const middle = DISPLAY_WIDTHS[Math.floor(DISPLAY_WIDTHS.length / 2)]!;
const attrs = computed(() => {
    if (upgraded.value) return { src: upgraded.value.url, srcset: `${upgraded.value.url} ${upgraded.value.width}w`, sizes: props.sizes };
    if (derivable.value) return { src: derivedUrl(props.src, `w${middle}.webp`), srcset: imageSrcset(props.src), sizes: props.sizes };
    return { src: props.src };
});
const placeholder = computed(() => (derivable.value && !loaded.value ? placeholderUrl(props.src) : null));

/** Larger copies to step through, smallest first: display widths, the zoom copy, the original. */
const ladder = computed(() =>
    isDerivable(props.src)
        ? [...DISPLAY_WIDTHS.map((w) => ({ url: derivedUrl(props.src, `w${w}.webp`), width: w as number })), { url: zoomUrl(props.src)!, width: Infinity }, { url: props.src, width: Infinity }]
        : [],
);

function reset() {
    failed.value = false;
    loaded.value = false;
    upgraded.value = null;
    probe = null;
}
watch(() => props.src, reset);
// A slideshow slide becoming the one on show: sharpen it now.
watch(
    () => props.sharpest,
    (v) => v && loaded.value && maybeUpgrade(),
);

/** Device pixels the image is drawn across (its width), given how it fits its box. */
function neededWidth(el: HTMLImageElement): number {
    const r = el.getBoundingClientRect();
    if (!r.width || !el.naturalWidth) return 0;
    const aspect = el.naturalWidth / el.naturalHeight;
    const drawn = props.fit === 'cover' ? Math.max(r.width, r.height * aspect) : Math.min(r.width, r.height ? r.height * aspect : r.width);
    return drawn * (window.devicePixelRatio || 1);
}

/**
 * Real pixels across the copy on screen. (With srcset, `naturalWidth` is in layout pixels, so it can't
 * be used: display copies are known by name, upgrades by what was measured when they loaded.)
 */
function haveWidth(el: HTMLImageElement): { at: number; width: number } {
    if (upgraded.value) return { at: ladder.value.findIndex((s) => s.url === upgraded.value!.url), width: upgraded.value.width };
    const current = el.currentSrc || el.src;
    const at = ladder.value.findIndex((s) => Number.isFinite(s.width) && current.endsWith(s.url));
    return at >= 0 ? { at, width: ladder.value[at]!.width } : { at: ladder.value.length - 1, width: el.naturalWidth };
}

/** If the copy on screen is too small for how it's drawn (or `sharpest`), fetch the next one up and swap it in. */
function maybeUpgrade() {
    const el = img.value;
    if (!el || failed.value || !ladder.value.length || probe) return;
    const { at, width } = haveWidth(el);
    const zoomAt = ladder.value.length - 2;
    if (props.sharpest) {
        // Up to the zoom copy (the original only if the zoom copy is missing).
        if (at >= zoomAt) return;
    } else if (width >= neededWidth(el) * 0.9) {
        // A little softness is invisible; don't chase the last few percent.
        return;
    }
    const next = ladder.value.findIndex((s, i) => i > at && s.width > width);
    if (next < 0) return;
    // Sharpest: skip straight to the zoom copy once the screen's need is met.
    tryStep(props.sharpest && width >= neededWidth(el) ? zoomAt : next, width);
}

function tryStep(i: number, have: number) {
    const step = ladder.value[i];
    if (!step) return;
    const p = new Image();
    probe = p;
    p.decoding = 'async';
    p.onload = async () => {
        if (probe !== p) return;
        await p.decode().catch(() => {});
        probe = null;
        // Only swap for something actually sharper (a missing width falls through to the next).
        if (p.naturalWidth > have) upgraded.value = { url: step.url, width: p.naturalWidth };
        else if (i + 1 < ladder.value.length) tryStep(i + 1, have);
    };
    p.onerror = () => {
        if (probe !== p) return;
        probe = null;
        if (i + 1 < ladder.value.length) tryStep(i + 1, have);
    };
    p.src = step.url;
}

function onError() {
    // The first pick is missing (derivatives not made yet): show the original instead.
    if (!upgraded.value && derivable.value) failed.value = true;
}
function onLoad(e: Event) {
    loaded.value = true;
    emit('load', e);
    maybeUpgrade();
}

// Boxes grow (window resized, layout settles): check again, a moment after it stops changing.
let observer: ResizeObserver | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
onMounted(() => {
    if (typeof ResizeObserver === 'undefined' || !img.value) return;
    observer = new ResizeObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => loaded.value && maybeUpgrade(), 300);
    });
    observer.observe(img.value);
});
onBeforeUnmount(() => {
    observer?.disconnect();
    clearTimeout(timer);
    probe = null;
});
</script>

<template>
    <img
        ref="img"
        v-bind="attrs"
        :alt="alt"
        :loading="eager ? 'eager' : 'lazy'"
        decoding="async"
        :style="
            placeholder
                ? { backgroundImage: `url(${placeholder})`, backgroundSize: fit, backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }
                : undefined
        "
        @load="onLoad"
        @error="onError"
    />
</template>
