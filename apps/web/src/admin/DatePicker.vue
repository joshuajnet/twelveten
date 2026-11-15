<script setup lang="ts">
import { computed, ref } from 'vue';
import { CalendarRoot, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import { parseDate, type DateValue } from '@internationalized/date';
import { formatDate } from '@twelveten/shared';
import CalendarGrid from './ui/CalendarGrid.vue';

/** A single day ('YYYY-MM-DD'), shown as formatted text that opens a calendar. */
const props = defineProps<{ display?: string }>();
const model = defineModel<string>({ required: true });
const open = ref(false);

const value = computed({
    get: () => parseDate(model.value),
    set: (v: DateValue | undefined) => {
        if (v) {
            model.value = v.toString();
            open.value = false;
        }
    },
});
</script>

<template>
    <PopoverRoot v-model:open="open">
        <PopoverTrigger as-child>
            <span class="tt-editable tt-clickable" role="button" tabindex="0" title="Change date">{{ props.display ?? formatDate(model) }}</span>
        </PopoverTrigger>
        <PopoverPortal>
            <PopoverContent class="admin-ui z-[95] rounded-md border border-slate-200 bg-white p-3 shadow-xl" :side-offset="6">
                <CalendarRoot v-slot="{ grid, weekDays }" v-model="value as any" weekday-format="short" fixed-weeks>
                    <CalendarGrid :grid="grid" :week-days="weekDays" />
                </CalendarRoot>
            </PopoverContent>
        </PopoverPortal>
    </PopoverRoot>
</template>
