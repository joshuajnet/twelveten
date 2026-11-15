import { ref } from 'vue';
import type { LocationQueryRaw } from 'vue-router';

/** The people list's last filter/search, so "Back to people" returns to the same view. */
export const peopleListQuery: { value: LocationQueryRaw } = { value: {} };

/** Number of suggested duplicate pairs (sidebar badge). */
export const duplicateCount = ref(0);
