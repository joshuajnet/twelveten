<script setup lang="ts">
import { computed } from 'vue';
import type { PressItem } from '@twelveten/shared';
import PressEntry from '@/components/news/PressEntry.vue';

/** Renders API-provided HTML; `<div data-press-list></div>` is replaced with the linked press items. */
const props = defineProps<{ html: string; press?: PressItem[] }>();

const parts = computed(() => props.html.split(/<div data-press-list(?:="")?><\/div>/));
</script>

<template>
    <template v-for="(part, i) in parts" :key="i">
        <div v-if="part" class="rich-content" v-html="part" />
        <div v-if="i < parts.length - 1 && press?.length" class="mb-6">
            <h3 class="text-lg font-bold mb-3">Press</h3>
            <PressEntry v-for="p in press" :key="p.id" :item="p" />
        </div>
    </template>
</template>
