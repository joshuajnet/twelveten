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
        <div class="container max-w-screen-sm mx-auto grid md:grid-cols-1 gap-6 px-3">
            <img
                v-if="true === false"
                src="/images/terror-element/terror-element-nomark.jpg"
                class="max-w-full w-auto h-auto mx-auto"
            />
            <div id="press-release">
                <div class="grid md:grid-cols-2 grid-cols-1 gap-3 mb-6 mx-auto">
                    <div class="flex justify-between">
                        <div class="text-base">
                            Collin Leitch<br />
                            <span class="text-lg">The Darling Maneuver</span>
                        </div>
                    </div>
                    <div class="md:text-right text-left">
                        <a
                            v-if="true === false"
                            href="/docs/terror-element/terror-element-press-release.pdf"
                            class="block mb-3"
                            target="_blank"
                        >
                            PDF
                        </a>
                        January 10th &mdash; February 14th, 2026<br />
                        Opening: January 10th, 6PM &mdash; 9PM<br />
                    </div>
                </div>
                <div class="text-justify max-w-screen-sm mx-auto">
                    <p class="mb-3">
                        Twelve Ten Gallery is pleased to present “The Darling Maneuver," an exhibition by Collin Leitch.
                        Additional details forthcoming.
                    </p>
                    <div class="mt-10">
                        <p class="italic mb-3">
                            <span class="font-bold">Collin Leitch</span> (b. 1993) received a B.A. from Bard College in
                            2016. Recent exhibitions include the two-person show <em>Point Free</em> with Kayla Jones at
                            Ciera (2024, New York), solo exhibitions <em>World Edit</em> at Shoot the Lobster (2022, New
                            York) and <em>Camera Rider</em> at Team Gallery (2019, New York). He has also participated
                            in group exhibitions at R &amp; Company (New York), As It Stands (Los Angeles), Freddy (New
                            York) and King’s Leap (New York), among many others. His films have been screened at
                            <em>Channels Video Art Festival</em>
                            in Melbourne and a variety of New York spaces, including LUBOV, Mery Gates and Microscope
                            Gallery.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
