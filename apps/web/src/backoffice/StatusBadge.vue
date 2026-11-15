<script setup lang="ts">
import type { WorkStatus } from '@twelveten/shared';
import { statusClass, statusLabel } from './format';

defineProps<{ status: WorkStatus }>();
</script>

<template>
    <span class="inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset" :class="statusClass[status]">
        {{ statusLabel(status) }}
    </span>
</template>
