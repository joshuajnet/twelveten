<script setup lang="ts">
/** One headline number with its label (KPI row). */
defineProps<{ label: string; value: string | number; hint?: string }>();
</script>

<template>
    <div class="rounded-md border border-slate-200 bg-white px-4 py-3">
        <div class="text-xs font-medium text-slate-500">{{ label }}</div>
        <div class="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{{ value }}</div>
        <div v-if="hint" class="mt-0.5 text-xs text-slate-500">{{ hint }}</div>
    </div>
</template>
