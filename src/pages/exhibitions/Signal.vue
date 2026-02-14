<script>
import { ref } from 'vue';
import GallerySlideshow from '../../components/GallerySlideshow.vue';
import slideshowData from '../../json/nada-miami-2025-slideshow.json';

export default {
    components: {
        GallerySlideshow,
    },
    data() {
        return {
            slides: slideshowData,
        };
    },
};
</script>

<template>
    <div class="flex flex-col grow">
        <div v-if="true === false">
            <GallerySlideshow :slides="slides" :worksAvailable="true" />
        </div>
        <div class="container max-w-screen-sm mx-auto grid md:grid-cols-1 gap-6 px-3">
            <div id="press-release">
                <div class="grid md:grid-cols-2 grid-cols-1 gap-3 mb-6 mx-auto">
                    <div class="flex justify-between">
                        <div class="text-lg">
                            <strong>Noelle Africh</strong><br />
                            <em>Signal</em>
                        </div>
                    </div>
                    <div class="md:text-right text-left">
                        <a v-if="true === false"
                            href="/docs/nada-miami-2025/tali-halpern-nada-miami-preview.pdf"
                            class="block mb-3"
                            target="_blank"
                        >
                            Preview PDF
                        </a>
                        April 4th &mdash; May 9th, 2026<br />
                        Opening: April 4th, 6 &mdash; 9PM<br />
                        Hours: Wed - Sat, 1PM — 6PM
                    </div>
                </div>
                <div class="text-justify max-w-screen-sm mx-auto">
                    <p class="mb-3">
                        Twelve Ten Gallery is pleased to present "Signal", a solo exhibition by Noelle Africh. Additional details forthcoming.
                    </p>
                    <div class="mt-10">
                        <p class="italic mb-3">
                            <span class="font-bold">Noelle Africh</span> (b. 1992 Chicago, IL) lives and works in Chicago, IL. They received an MFA in Painting and Drawing from The School of the Art Institute of Chicago and a Bachelor of Science degree in Mathematics from the University of Illinois in Urbana-Champaign. Solo exhibitions include "Signal", Twelve Ten (Chicago, IL), "Superstition", Slow Dance (Chicago, IL) and "Loomer", SHED Projects (Cleveland, OH). They have also participated in many group exhibitions including at Galerie Gisela Clement (Bonn, Germany), RUSCHWOMAN (Chicago, IL), Hyde Park Art Center (Chicago, IL), The Plan (Chicago, IL), The Green Gallery - West (Milwaukee, WI), and Patient Info (Chicago, IL), among others. They have a forthcoming two-person at No31 (Duns, Scotland) in 2026.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
