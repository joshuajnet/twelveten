<script setup lang="ts">
/** Month grid shared by the single-date and range calendars (rendered inside a Reka calendar root's slot). */
import {
    CalendarCell,
    CalendarCellTrigger,
    CalendarGrid,
    CalendarGridBody,
    CalendarGridHead,
    CalendarGridRow,
    CalendarHeadCell,
    CalendarHeader,
    CalendarHeading,
    CalendarNext,
    CalendarPrev,
    RangeCalendarCell,
    RangeCalendarCellTrigger,
    RangeCalendarGrid,
    RangeCalendarGridBody,
    RangeCalendarGridHead,
    RangeCalendarGridRow,
    RangeCalendarHeadCell,
    RangeCalendarHeader,
    RangeCalendarHeading,
    RangeCalendarNext,
    RangeCalendarPrev,
} from 'reka-ui';
import type { DateValue } from '@internationalized/date';

defineProps<{ range?: boolean; grid: { value: DateValue; rows: DateValue[][] }[]; weekDays: string[] }>();
</script>

<template>
    <component :is="range ? RangeCalendarHeader : CalendarHeader" class="mb-2 flex items-center justify-between">
        <component :is="range ? RangeCalendarPrev : CalendarPrev" class="rounded px-2 py-0.5 hover:bg-slate-100" aria-label="Previous month">‹</component>
        <component :is="range ? RangeCalendarHeading : CalendarHeading" class="text-sm font-medium" />
        <component :is="range ? RangeCalendarNext : CalendarNext" class="rounded px-2 py-0.5 hover:bg-slate-100" aria-label="Next month">›</component>
    </component>
    <div class="flex gap-4">
        <component :is="range ? RangeCalendarGrid : CalendarGrid" v-for="month in grid" :key="month.value.toString()" class="border-collapse select-none">
            <component :is="range ? RangeCalendarGridHead : CalendarGridHead">
                <component :is="range ? RangeCalendarGridRow : CalendarGridRow">
                    <component :is="range ? RangeCalendarHeadCell : CalendarHeadCell" v-for="d in weekDays" :key="d" class="w-8 text-center text-[11px] font-normal text-slate-500">{{ d }}</component>
                </component>
            </component>
            <component :is="range ? RangeCalendarGridBody : CalendarGridBody">
                <component :is="range ? RangeCalendarGridRow : CalendarGridRow" v-for="(week, i) in month.rows" :key="i">
                    <component :is="range ? RangeCalendarCell : CalendarCell" v-for="day in week" :key="day.toString()" :date="day" class="p-0 text-center">
                        <component
                            :is="range ? RangeCalendarCellTrigger : CalendarCellTrigger"
                            :day="day"
                            :month="month.value"
                            class="flex h-8 w-8 items-center justify-center text-sm hover:bg-slate-100 data-[outside-view]:text-slate-300 data-[today]:font-bold data-[selected]:bg-sky-800 data-[selected]:text-white data-[highlighted]:bg-sky-100 data-[selection-start]:bg-sky-800 data-[selection-end]:bg-sky-800"
                        />
                    </component>
                </component>
            </component>
        </component>
    </div>
</template>
