<script setup lang="ts">
import { computed } from 'vue';
import { ROOM_STATUSES, type RoomStatus } from '@twelveten/shared';

/** Draft / Live / Closed, with "Scheduled" or "Expired" when a live room is outside its window. */
const props = defineProps<{ room: { status: RoomStatus; opensAt: string | null; closesAt: string | null } }>();
const state = computed(() => {
    const now = Date.now();
    const r = props.room;
    if (r.status === 'live' && r.opensAt && Date.parse(r.opensAt) > now) return { label: 'Scheduled', tone: 'bg-amber-50 text-amber-900 ring-amber-700/20' };
    if (r.status === 'live' && r.closesAt && Date.parse(r.closesAt) <= now) return { label: 'Expired', tone: 'bg-slate-100 text-slate-600 ring-slate-500/20' };
    const tone = { draft: 'bg-slate-100 text-slate-700 ring-slate-500/20', live: 'bg-emerald-50 text-emerald-800 ring-emerald-700/20', closed: 'bg-slate-100 text-slate-500 ring-slate-500/20' }[r.status];
    return { label: ROOM_STATUSES[r.status], tone };
});
</script>

<template>
    <span class="inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset" :class="state.tone">{{ state.label }}</span>
</template>
