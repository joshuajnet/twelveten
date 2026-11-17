<script setup lang="ts">
import { computed } from 'vue';
import type { ImageCrop } from '@twelveten/shared';
import { fallBackTo, previewUrl } from './crop';

/** An image shown in a frame of `aspect`: the `crop` area of it, or centred and filling the frame. */
const props = withDefaults(defineProps<{ url: string; crop?: ImageCrop | null; aspect: number; width?: 480 | 960 | 1600 }>(), { crop: null, width: 480 });

const style = computed(() => {
    const c = props.crop;
    if (!c) return { inset: '0', width: '100%', height: '100%', objectFit: 'cover' as const };
    return { width: `${100 / c.w}%`, height: `${100 / c.h}%`, left: `${(-c.x / c.w) * 100}%`, top: `${(-c.y / c.h) * 100}%`, maxWidth: 'none' };
});
</script>

<template>
    <span class="relative block overflow-hidden bg-slate-100" :style="{ aspectRatio: String(aspect) }">
        <img :src="previewUrl(url, width)" alt="" class="absolute" :style="style" draggable="false" @error="fallBackTo(url)($event)" />
    </span>
</template>
