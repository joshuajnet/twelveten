<script setup lang="ts">
import type { InvoiceStatus } from '@twelveten/shared';
import { invoiceStatusClass, invoiceStatusLabel } from './format';

defineProps<{ status: InvoiceStatus }>();
</script>

<template>
    <span class="inline-flex items-center whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset" :class="invoiceStatusClass[status]">
        {{ invoiceStatusLabel(status) }}
    </span>
</template>
