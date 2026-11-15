<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { errorMessage } from '@/admin/api';
import { toast } from '@/admin/state';
import ArtImage from '@/components/ArtImage.vue';
import { boApi } from '../api';
import { inquiriesChanged, unseenInquiries } from '../nav';
import { ago, inquiryOnProfile } from './link';

/** New inquiries at the top of the back office until someone dismisses them (for every admin). */
const root = ref<HTMLElement>();
const shown = computed(() => unseenInquiries.value.items.slice(0, 3));
const more = computed(() => unseenInquiries.value.count - shown.value.length);

async function refresh() {
    unseenInquiries.value = await boApi.unseenInquiries();
    inquiriesChanged.value++;
}

async function dismiss(id: string, index: number) {
    try {
        await boApi.dismissInquiry(id);
        await refresh();
        await nextTick();
        // Keep focus in the list (the next alert's Dismiss), or on the page heading when it's empty.
        const buttons = root.value?.querySelectorAll<HTMLButtonElement>('[data-dismiss]');
        (buttons?.[Math.min(index, (buttons?.length ?? 1) - 1)] ?? document.querySelector<HTMLElement>('#bo-main h1'))?.focus();
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}
async function dismissAll() {
    try {
        await boApi.dismissAllInquiries();
        await refresh();
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}
</script>

<template>
    <section v-if="shown.length" ref="root" aria-label="New inquiries" class="mb-6 rounded-md border border-sky-200 bg-sky-50 p-3" data-testid="inquiry-alerts">
        <div class="mb-2 flex flex-wrap items-center gap-2">
            <h2 class="text-sm font-semibold text-sky-950">{{ unseenInquiries.count === 1 ? 'New inquiry' : `${unseenInquiries.count} new inquiries` }}</h2>
            <span class="flex-1" />
            <RouterLink :to="{ name: 'bo-inquiries' }" class="text-xs text-sky-900 hover:underline">All inquiries</RouterLink>
            <button v-if="unseenInquiries.count > 1" type="button" class="text-xs text-slate-600 hover:underline" @click="dismissAll">Dismiss all</button>
        </div>
        <ul class="space-y-2" role="status">
            <li v-for="(i, n) in shown" :key="i.id" class="flex items-start gap-3 rounded bg-white p-2 text-sm shadow-sm" data-testid="inquiry-alert">
                <span class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-100">
                    <ArtImage v-if="i.item.image" :src="i.item.image" alt="" sizes="48px" fit="cover" class="h-full w-full object-cover" />
                </span>
                <div class="min-w-0 flex-1">
                    <p>
                        <RouterLink :to="{ name: 'bo-person', params: { id: i.personId, profile: 'collector' } }" class="font-medium text-sky-900 hover:underline">{{ i.personName }}</RouterLink>
                        asked about <span class="italic">{{ i.item.title }}</span><span v-if="i.item.artist" class="text-slate-600"> · {{ i.item.artist }}</span>
                        <span class="text-xs text-slate-500"> · {{ ago(i.createdAt) }}</span>
                    </p>
                    <p v-if="i.note" class="line-clamp-2 whitespace-pre-line text-slate-700">“{{ i.note }}”</p>
                </div>
                <div class="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
                    <RouterLink :to="inquiryOnProfile(i)" class="rounded px-2 py-1 text-xs text-sky-900 hover:bg-sky-50">Open</RouterLink>
                    <button type="button" data-dismiss class="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100" :aria-label="`Dismiss inquiry from ${i.personName}`" @click="dismiss(i.id, n)">
                        Dismiss
                    </button>
                </div>
            </li>
        </ul>
        <p v-if="more > 0" class="mt-2 text-xs">
            <RouterLink :to="{ name: 'bo-inquiries', query: { status: 'new' } }" class="text-sky-900 hover:underline">+{{ more }} more</RouterLink>
        </p>
    </section>
</template>
