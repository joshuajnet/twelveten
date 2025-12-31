<script>
import { ref } from 'vue';
import GallerySlideshow from '../../components/GallerySlideshow.vue';
import slideshowData from '../../json/terror-element-slideshow.json';

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
            <GallerySlideshow :slides="slides" :worksAvailable="false" />
        </div>
        <div class="container mx-auto grid md:grid-cols-1 max-w-xl gap-6 px-3">
            <img
                v-if="true === false"
                v-lazy="{ src: '/images/darling-maneuver/leitch-thumb-01.jpg' }"
                class="max-w-full w-auto h-auto mx-auto"
                alt="Collin Leitch: The Darling Maneuver. January 10th - February 14th, 2026"
            />
            <div id="press-release">
                <div class="grid md:grid-cols-2 grid-cols-1 gap-3 mb-6 mx-auto">
                    <div class="flex justify-between">
                        <div class="text-lg">
                            Micah Schippa-Wildfong<br />
                            <em>LIBERTÉ</em>
                        </div>
                    </div>
                    <div class="md:text-right text-left">
                        <a
                            v-if="true === false"
                            href="/docs/darling-maneuver/leitch-darling-maneuver-press-release.pdf"
                            class="block mb-3"
                            target="_blank"
                        >
                            PDF
                        </a>
                        February 21st &mdash; March 28th, 2026<br />
                        Opening: February 21st, 6PM &mdash; 9PM<br />
                        Hours: Wed - Sat, 1PM — 6PM
                    </div>
                </div>
                <div class="text-justify max-w-screen-sm mx-auto">
                    <p class="mb-3">
                        Twelve Ten Gallery is pleased to present LIBERTÉ, an exhibition by Micah Schippa-Wildfong.
                        Additional details forthcoming.
                    </p>
                    <div class="mt-10">
                        <p class="italic mb-3">
                            <span class="font-bold">Micah Schippa-Wildfong</span> (b. 1988) is an American artist,
                            writer, and musician living and working in Chicago. They studied formally at The School of
                            the Art Institute of Chicago and studied independently in experimental poetics, philosophy,
                            and contemporary theory. They have recently exhibited at Salzburger Kunstverein (Salzburg),
                            The Museum of Contemporary Art (Chicago), romance (Pittsburgh), Mickey (Chicago), and Pech
                            (Vienna). They have an upcoming exhibition with DISPLAY in Parma, Italy later this year.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
