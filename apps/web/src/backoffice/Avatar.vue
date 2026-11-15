<script setup lang="ts">
import { initials } from './format';
import ArtImage from '@/components/ArtImage.vue';

withDefaults(defineProps<{ name: string; src?: string | null; size?: 'sm' | 'lg' }>(), { size: 'sm' });
</script>

<template>
    <span
        class="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 font-medium text-slate-600"
        :class="size === 'lg' ? 'h-20 w-20 text-xl' : 'h-8 w-8 text-xs'"
        aria-hidden="true"
    >
        <ArtImage sizes="96px" fit="cover" v-if="src" :src="src" alt="" class="h-full w-full object-cover" />
        <template v-else>{{ initials(name) }}</template>
    </span>
</template>
