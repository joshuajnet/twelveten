<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { INQUIRY_SOURCES, type InquirySummary } from '@twelveten/shared';
import ArtImage from '@/components/ArtImage.vue';
import { ago, itemLink } from './link';

/** One inquiry: the item they asked about, their note, where and when, and its state. */
const props = defineProps<{ inquiry: InquirySummary; showPerson?: boolean }>();
defineEmits<{ dismiss: []; remove: [] }>();
const link = computed(() => itemLink(props.inquiry));
const from = computed(() => {
    const i = props.inquiry;
    if (i.room) return `Viewing room “${i.room.title}”`;
    if (i.exhibition) return `${INQUIRY_SOURCES[i.source]} · ${i.exhibition.title}`;
    return INQUIRY_SOURCES[i.source];
});
</script>

<template>
    <div :id="`inquiry-${inquiry.id}`" class="flex scroll-mt-20 gap-3 py-3 text-sm" :class="{ 'bg-sky-50/60': !inquiry.seenAt }" data-testid="inquiry-row">
        <span class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-100">
            <ArtImage v-if="inquiry.item.image" :src="inquiry.item.image" alt="" sizes="56px" fit="cover" class="h-full w-full object-cover" />
        </span>
        <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-baseline gap-x-2">
                <RouterLink v-if="showPerson" :to="{ name: 'bo-person', params: { id: inquiry.personId, profile: 'collector' } }" class="font-medium text-sky-900 hover:underline">{{ inquiry.personName }}</RouterLink>
                <template v-if="link">
                    <RouterLink v-if="'to' in link" :to="link.to" class="italic text-sky-900 hover:underline">{{ inquiry.item.title }}</RouterLink>
                    <a v-else :href="link.href" target="_blank" rel="noopener" class="italic text-sky-900 hover:underline">{{ inquiry.item.title }}</a>
                </template>
                <span v-else class="italic">{{ inquiry.item.title }}</span>
                <span v-if="inquiry.item.artist" class="text-slate-600">{{ inquiry.item.artist }}</span>
                <span v-if="inquiry.item.price" class="text-slate-600">· {{ inquiry.item.price }}</span>
                <span v-if="!inquiry.seenAt" class="rounded bg-sky-100 px-1 text-[11px] font-medium text-sky-900">New</span>
            </div>
            <p v-if="inquiry.note" class="mt-1 whitespace-pre-line break-words text-slate-800">{{ inquiry.note }}</p>
            <p v-else class="mt-1 text-slate-400">No note</p>
            <p class="mt-1 text-xs text-slate-500">
                {{ ago(inquiry.createdAt) }} · {{ from }}
                <template v-if="inquiry.enteredEmail"> · typed {{ inquiry.enteredName }} &lt;{{ inquiry.enteredEmail }}&gt;{{ inquiry.match === 'new' ? ' (new person)' : ' (matched, unverified)' }}</template>
                <template v-else> · known browser</template>
                <template v-if="inquiry.seenAt"> · dismissed{{ inquiry.seenBy ? ` by ${inquiry.seenBy}` : '' }}</template>
            </p>
        </div>
        <div class="flex shrink-0 flex-col items-end gap-1">
            <button v-if="!inquiry.seenAt" type="button" class="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100" @click="$emit('dismiss')">Dismiss</button>
            <button type="button" class="rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50" @click="$emit('remove')">Delete</button>
        </div>
    </div>
</template>
