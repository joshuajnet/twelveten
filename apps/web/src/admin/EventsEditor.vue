<script setup lang="ts">
import { reactive } from 'vue';
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import { formatEvent, zonedParts, zonedToIso, type EventInput } from '@twelveten/shared';
import DatePicker from './DatePicker.vue';
import { btnDanger, btnGhost } from './ui/buttons';

/** Events under the dates ("Opening: April 4th, 6PM — 9PM"), edited in place with date and time pickers. */
const props = defineProps<{ timezone: string; defaultDay: string }>();
const events = defineModel<EventInput[]>({ required: true });

const pad = (n: number) => String(n).padStart(2, '0');
function parts(iso: string) {
    const p = zonedParts(iso, props.timezone);
    return { day: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}

/** Editable fields for one event, kept in gallery-local wall-clock time. */
function fields(ev: EventInput) {
    const s = parts(ev.startsAt);
    return reactive({ label: ev.label, day: s.day, start: s.time, end: ev.endsAt ? parts(ev.endsAt).time : '' });
}

function update(i: number, f: { label: string; day: string; start: string; end: string }) {
    const startsAt = zonedToIso(`${f.day} ${f.start}`, props.timezone);
    let endsAt: string | null = null;
    if (f.end) {
        endsAt = zonedToIso(`${f.day} ${f.end}`, props.timezone);
        // An end time earlier than the start means it runs past midnight.
        if (endsAt <= startsAt) endsAt = new Date(new Date(endsAt).getTime() + 86_400_000).toISOString();
    }
    const next = [...events.value];
    next[i] = { label: f.label.trim() || 'Event', startsAt, endsAt };
    events.value = next;
}

function add() {
    events.value = [
        ...events.value,
        { label: events.value.length ? 'Artist Talk' : 'Opening', startsAt: zonedToIso(`${props.defaultDay} 18:00`, props.timezone), endsAt: zonedToIso(`${props.defaultDay} 21:00`, props.timezone) },
    ];
}

function remove(i: number) {
    events.value = events.value.filter((_, j) => j !== i);
}
</script>

<template>
    <template v-for="(ev, i) in events" :key="`${i}-${ev.startsAt}`">
        <PopoverRoot>
            <PopoverTrigger as-child>
                <span class="tt-editable tt-clickable" role="button" tabindex="0" title="Edit event">{{ formatEvent(ev, timezone) }}</span>
            </PopoverTrigger>
            <PopoverPortal>
                <PopoverContent class="admin-ui z-[95] w-72 rounded-md border border-slate-200 bg-white p-3 text-left shadow-xl" :side-offset="6">
                    <template v-for="f in [fields(ev)]" :key="i">
                        <label class="block text-xs font-medium text-slate-600">
                            Label
                            <input v-model="f.label" class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" @change="update(i, f)" />
                        </label>
                        <div class="mt-2 text-xs font-medium text-slate-600">
                            Day
                            <div class="mt-1 text-sm"><DatePicker v-model="f.day" @update:model-value="update(i, f)" /></div>
                        </div>
                        <div class="mt-2 grid grid-cols-2 gap-2">
                            <label class="text-xs font-medium text-slate-600">
                                Starts
                                <input v-model="f.start" type="time" class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" @change="update(i, f)" />
                            </label>
                            <label class="text-xs font-medium text-slate-600">
                                Ends
                                <input v-model="f.end" type="time" class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm" @change="update(i, f)" />
                            </label>
                        </div>
                        <p class="mt-2 text-xs text-slate-500">Times are in {{ timezone.replace('_', ' ') }}.</p>
                        <div class="mt-2 flex justify-end">
                            <button type="button" :class="btnDanger" @click="remove(i)">Remove event</button>
                        </div>
                    </template>
                </PopoverContent>
            </PopoverPortal>
        </PopoverRoot>
        <br />
    </template>
    <button type="button" :class="btnGhost" class="admin-ui !px-1 !py-0 text-xs text-sky-800" @click="add">+ Add event</button><br />
</template>
