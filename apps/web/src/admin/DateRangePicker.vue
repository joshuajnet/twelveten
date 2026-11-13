<script setup lang="ts">
import { computed, ref } from 'vue';
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger, RangeCalendarRoot } from 'reka-ui';
import { parseDate, type DateValue } from '@internationalized/date';
import { formatDateRange } from '@twelveten/shared';
import CalendarGrid from './ui/CalendarGrid.vue';

/** Shows the derived date text in place; clicking it opens a range calendar. */
const start = defineModel<string>('start', { required: true });
const end = defineModel<string>('end', { required: true });
const open = ref(false);

const range = computed({
    get: () => ({ start: parseDate(start.value), end: parseDate(end.value) }),
    set: (v: { start?: DateValue; end?: DateValue }) => {
        if (v.start && v.end) {
            start.value = v.start.toString();
            end.value = v.end.toString();
            open.value = false;
        }
    },
});
</script>

<template>
    <PopoverRoot v-model:open="open">
        <PopoverTrigger as-child>
            <span class="tt-editable tt-clickable" role="button" tabindex="0" title="Change dates">{{ formatDateRange(start, end) }}</span>
        </PopoverTrigger>
        <PopoverPortal>
            <PopoverContent class="admin-ui z-[95] rounded-md border border-slate-200 bg-white p-3 shadow-xl" :side-offset="6">
                <RangeCalendarRoot v-slot="{ grid, weekDays }" v-model="range as any" :number-of-months="2" weekday-format="short" fixed-weeks>
                    <CalendarGrid range :grid="grid" :week-days="weekDays" />
                </RangeCalendarRoot>
                <p class="mt-2 text-xs text-slate-500">Pick the first and last day.</p>
            </PopoverContent>
        </PopoverPortal>
    </PopoverRoot>
</template>
