<script setup lang="ts">
import { computed } from 'vue';
import type { InvoiceStatus, WorkStatus } from '@twelveten/shared';
import { invoiceStatusClass, invoiceStatusLabel, statusClass, statusLabel } from './format';

/** A work's sale status or an invoice's status (the two sets of values don't overlap). */
const props = defineProps<{ status: WorkStatus | InvoiceStatus }>();

const badge = computed(() =>
    props.status in statusClass
        ? { label: statusLabel(props.status as WorkStatus), tone: statusClass[props.status as WorkStatus] }
        : { label: invoiceStatusLabel(props.status as InvoiceStatus), tone: invoiceStatusClass[props.status as InvoiceStatus] },
);
</script>

<template>
    <span class="inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset" :class="badge.tone">
        {{ badge.label }}
    </span>
</template>
