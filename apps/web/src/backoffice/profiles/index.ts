import { defineAsyncComponent, type Component } from 'vue';
import type { ProfileType } from '@twelveten/shared';

/**
 * Management panel per profile type (see PROFILE_TYPES in @twelveten/shared). Each panel receives
 * `person` and emits `update` with the refreshed person; `v-model:dirty` reports unsaved edits.
 */
export const PROFILE_PANELS: Record<ProfileType, Component> = {
    artist: defineAsyncComponent(() => import('./ArtistProfilePanel.vue')),
    collector: defineAsyncComponent(() => import('./CollectorProfilePanel.vue')),
};
