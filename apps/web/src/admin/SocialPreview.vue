<script setup lang="ts">
import { computed } from 'vue';
import type { HeadTags } from '@twelveten/shared';

/** How the page looks when shared (Open Graph card). */
const props = defineProps<{ tags: HeadTags }>();
const host = computed(() => {
    try {
        return new URL(props.tags.canonical).host;
    } catch {
        return '';
    }
});
</script>

<template>
    <figure class="mt-2 overflow-hidden rounded border border-slate-200 text-left">
        <img :src="tags.image" alt="" class="aspect-[1.91/1] w-full bg-slate-100 object-cover" />
        <figcaption class="p-2">
            <div class="truncate text-[11px] uppercase text-slate-500">{{ host }}</div>
            <div class="truncate text-sm font-semibold">{{ tags.title }}</div>
            <div class="line-clamp-2 text-xs text-slate-600">{{ tags.description }}</div>
        </figcaption>
    </figure>
</template>
