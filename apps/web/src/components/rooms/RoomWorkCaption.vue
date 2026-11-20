<script setup lang="ts">
import type { PublicRoomWork } from '@twelveten/shared';

/**
 * A viewing room work's details: artist, title and date, medium, dimensions, edition, price or status.
 * One per line; `inline` runs them together on wrapping lines separated by dots (the zoom caption).
 */
defineProps<{ work: PublicRoomWork; inline?: boolean }>();
</script>

<template>
    <div class="text-sm leading-snug" :class="{ 'room-caption-inline': inline }">
        <div>{{ work.artistName }}</div>
        <div><span class="italic">{{ work.title || 'Untitled' }}</span><span v-if="work.dateText">, {{ work.dateText }}</span></div>
        <div v-if="work.medium">{{ work.medium }}</div>
        <div v-if="work.dimensions">{{ work.dimensions }}</div>
        <div v-if="work.edition">{{ work.edition }}</div>
        <div v-if="work.price" :class="{ 'mt-1': !inline }" data-testid="room-price">{{ work.price }}</div>
        <div v-if="work.statusLabel" class="font-roboto text-xs font-light uppercase tracking-wider text-slate-500" :class="{ 'mt-1': !inline }" data-testid="room-status">{{ work.statusLabel }}</div>
    </div>
</template>

<style scoped>
.room-caption-inline > div {
    display: inline;
}
.room-caption-inline > div + div::before {
    content: ' · ';
    font-style: normal;
}
</style>
