<script setup lang="ts">
import { computed } from 'vue';

/**
 * A thin horizontal bar (one series, sequential blue) for a 0–`max` value, with the value at the
 * tip in text ink. The tooltip and accessible label carry the detail.
 */
const props = withDefaults(defineProps<{ value: number; max?: number; label: string; detail?: string }>(), { max: 100 });
const pct = computed(() => (props.max > 0 ? Math.max(0, Math.min(100, (props.value / props.max) * 100)) : 0));
</script>

<template>
    <div class="group relative flex items-center" role="img" :aria-label="`${label}: ${value}${detail ? `. ${detail}` : ''}`" :title="detail ? `${label}: ${value} — ${detail}` : `${label}: ${value}`">
        <!-- The track leaves room for the value, which sits at the bar's tip. -->
        <div class="flex flex-1 items-center pr-8">
            <div class="h-2 shrink-0 rounded-r bg-[#2a78d6] transition-[width] group-hover:bg-[#256abf]" :style="{ width: `${pct}%`, minWidth: value > 0 ? '2px' : '0' }" />
            <span class="ml-1.5 shrink-0 text-xs tabular-nums text-slate-700">{{ value }}</span>
        </div>
    </div>
</template>
