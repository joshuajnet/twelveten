import { ref } from 'vue';
import type { InquirySummary } from '@twelveten/shared';
import type { LocationQueryRaw } from 'vue-router';

/** The people list's last filter/search, so "Back to people" returns to the same view. */
export const peopleListQuery: { value: LocationQueryRaw } = { value: {} };

/** Number of suggested duplicate pairs (sidebar badge). */
export const duplicateCount = ref(0);

/** Inquiries not dismissed yet: the count (sidebar badge) and the newest few (the alert). */
export const unseenInquiries = ref<{ count: number; items: InquirySummary[] }>({ count: 0, items: [] });
/** Bumped whenever an inquiry is dismissed or deleted, so open pages showing inquiries reload. */
export const inquiriesChanged = ref(0);
