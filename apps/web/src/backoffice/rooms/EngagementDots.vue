<script setup lang="ts">
import { computed } from 'vue';
import { engagementDots, engagementLabel } from '@twelveten/shared';

/** Five dots and a label for a 0–100 engagement score. */
const props = withDefaults(defineProps<{ score: number; showLabel?: boolean }>(), { showLabel: true });
const filled = computed(() => engagementDots(props.score));
const label = computed(() => engagementLabel(props.score));
</script>

<template>
    <span class="inline-flex items-center gap-1.5 whitespace-nowrap" :title="`Engagement ${score}/100`" data-testid="engagement">
        <span class="inline-flex gap-0.5" aria-hidden="true">
            <span v-for="i in 5" :key="i" class="h-2 w-2 rounded-full" :class="i <= filled ? 'bg-[#2a78d6]' : 'bg-slate-200'" />
        </span>
        <span v-if="showLabel" class="text-xs text-slate-600">{{ label }}</span>
        <span class="sr-only">Engagement {{ score }} out of 100 ({{ label }})</span>
    </span>
</template>
