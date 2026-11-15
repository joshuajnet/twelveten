<script setup lang="ts">
import { computed } from 'vue';
import { formatDateRange, joinArtists, type Exhibition } from '@twelveten/shared';
import GallerySlideshow from '@/components/GallerySlideshow.vue';
import RichContent from '@/components/RichContent.vue';
import ArtImage from '@/components/ArtImage.vue';
import ExhibitionHeader from './ExhibitionHeader.vue';

/** The single layout shared by every exhibition and fair page. */
const props = defineProps<{ exhibition: Exhibition }>();

/** GallerySlideshow's slide shape. */
const slides = computed(() =>
    props.exhibition.artworks.map((a) => ({
        id: a.id,
        image: a.image,
        alt: a.alt,
        video: a.video,
        author: a.author,
        title: a.title,
        date: a.dateText,
        dimensions: a.dimensions,
        media: a.media,
        credit: a.credit,
        hidden: a.hidden,
        available: a.available,
    })),
);
const showSlideshow = computed(() => props.exhibition.slideshowVisible && slides.value.length > 0);
const heroAlt = computed(() => {
    const e = props.exhibition;
    if (e.heroAlt) return e.heroAlt;
    const who = joinArtists(e.artists);
    return `${who ? `${who}: ` : ''}${e.title}. ${formatDateRange(e.startsOn, e.endsOn)}`;
});
</script>

<template>
    <div class="flex flex-col grow">
        <div v-if="showSlideshow">
            <GallerySlideshow :key="exhibition.id" :slides="slides" :worksAvailable="exhibition.worksAvailable" />
        </div>
        <div
            class="container mx-auto grid gap-6 px-3"
            :class="exhibition.heroImage ? 'md:grid-cols-2' : 'max-w-(--breakpoint-sm) md:grid-cols-1'"
        >
            <ArtImage
                v-if="exhibition.heroImage"
                :src="exhibition.heroImage"
                :alt="heroAlt"
                eager
                sharpest
                sizes="(min-width: 768px) 50vw, 100vw"
                class="max-w-full w-auto h-auto mx-auto"
            />
            <div id="press-release">
                <ExhibitionHeader :exhibition="exhibition" />
                <div class="text-justify max-w-(--breakpoint-sm) mx-auto">
                    <RichContent :html="exhibition.contentHtml" :press="exhibition.press" />
                </div>
            </div>
        </div>
    </div>
</template>
