<script setup lang="ts">
import type { PublicRoomWork } from '@twelveten/shared';

/** A viewing room work's buttons, the same under a grid tile and in zoom: Zoom (not inside zoom), Inquire (available works), About the artist. */
withDefaults(defineProps<{ work: PublicRoomWork; about: boolean; zoom?: boolean }>(), { zoom: true });
defineEmits<{ zoom: []; inquire: []; about: [] }>();
</script>

<template>
    <div class="flex flex-wrap gap-2 font-roboto text-xs font-light">
        <button v-if="zoom && work.images.length" type="button" class="room-action" @click="$emit('zoom')">
            <i class="las la-search-plus mr-1" aria-hidden="true"></i>Zoom
        </button>
        <button v-if="work.available" type="button" class="room-action" data-testid="room-inquire" @click="$emit('inquire')">
            <i class="las la-envelope mr-1" aria-hidden="true"></i>Inquire
        </button>
        <button v-if="about" type="button" class="room-action" @click="$emit('about')">About the artist</button>
    </div>
</template>

<style scoped>
@reference "@/style.css";
.room-action {
    @apply inline-flex cursor-pointer items-center border px-3 py-1 text-slate-600 no-underline hover:text-sky-600 hover:shadow-sm;
}
</style>
