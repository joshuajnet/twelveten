<script setup lang="ts">
import { computed, ref } from 'vue';
import { artistList, formatDateRange, formatEvent, type Exhibition, type InquiryItem } from '@twelveten/shared';
import InquiryDialog from '@/components/InquiryDialog.vue';

const props = defineProps<{ exhibition: Exhibition }>();

const artists = computed(() => artistList(props.exhibition.artists));
const dates = computed(() => formatDateRange(props.exhibition.startsOn, props.exhibition.endsOn));
const events = computed(() => props.exhibition.events.map((e) => formatEvent(e, props.exhibition.timezone)));
const venueLines = computed(() => (props.exhibition.venueText ?? '').split('\n').filter(Boolean));
const inquiring = ref(false);
const inquiryItem = computed<InquiryItem>(() => ({
    title: props.exhibition.title,
    artist: artists.value.join(', ') || null,
    date: dates.value,
    image: props.exhibition.thumbnail ?? props.exhibition.heroImage,
}));
const isInternal = (url: string) => url.startsWith('/') && !url.startsWith('/media/');
</script>

<template>
    <div class="grid md:grid-cols-2 grid-cols-1 gap-3 mb-6 mx-auto">
        <div class="flex justify-between">
            <div class="text-lg">
                <template v-if="exhibition.titleFirst">
                    <strong>{{ exhibition.title }}</strong><br />
                    <template v-for="a in artists" :key="a">{{ a }}<br /></template>
                </template>
                <template v-else>
                    <template v-for="a in artists" :key="a"><strong>{{ a }}</strong><br /></template>
                    <em>{{ exhibition.title }}</em>
                </template>
                <template v-if="exhibition.subtitle"><br />{{ exhibition.subtitle }}</template>
            </div>
        </div>
        <div class="md:text-right text-left">
            <a v-if="exhibition.pressReleaseUrl" :href="exhibition.pressReleaseUrl" class="block mb-3" target="_blank">PDF</a>
            <template v-for="link in exhibition.headerLinks" :key="link.url">
                <router-link v-if="isInternal(link.url)" :to="link.url" class="block mb-3">{{ link.label }}</router-link>
                <a v-else :href="link.url" class="block mb-3" target="_blank" rel="noopener noreferrer">{{ link.label }}</a>
            </template>
            {{ dates }}<br />
            <template v-for="e in events" :key="e">{{ e }}<br /></template>
            <template v-for="line in venueLines" :key="line">{{ line }}<br /></template>
            <template v-if="exhibition.hoursText">{{ exhibition.hoursText }}<br /></template>
            <button
                v-if="exhibition.showInquire"
                type="button"
                class="py-1 px-3 inline-block cursor-pointer hover:text-sky-600 border hover:shadow-sm mt-3 font-roboto font-light text-sm"
                data-testid="exhibition-inquire"
                @click="inquiring = true"
            >
                Inquire
            </button>
            <InquiryDialog v-if="exhibition.showInquire" v-model:open="inquiring" :item="inquiryItem" :target="{ kind: 'exhibition', exhibitionId: exhibition.id }" />
        </div>
    </div>
</template>
