<script>
import { ref } from 'vue';
import GallerySlideshow from '../../components/GallerySlideshow.vue';
import slideshowData from '../../json/star-e-eyed-slideshow.json';

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
        <div class="container mx-auto grid md:grid-cols-1 gap-6 px-3">
            <img
                src="/images/star-e-eyed/halpern-nomark-min.jpg"
                class="max-w-full w-auto h-auto mx-auto"
                v-if="true === false"
            />
            <div id="press-release">
                <div class="grid md:grid-cols-2 grid-cols-1 gap-3 mb-6 max-w-screen-sm mx-auto">
                    <div class="flex justify-between">
                        <div class="text-lg font-bold">
                            Trey Rozell<br />
                            <span class="text-base">As above, so below</span>
                        </div>
                    </div>
                    <div class="md:text-right text-left">
                        <a
                            v-if="true === false"
                            href="/docs/star-e-eyed/halpern-star-e-eyed-press-release.pdf"
                            class="block mb-3"
                            target="_blank"
                        >
                            PDF
                        </a>
                        April 12th &mdash; May 24th, 2025<br />
                        Opening: April 12th, 6PM &mdash; 9PM<br />
                        Artist Talk: April 25th, 6PM &mdash; 8PM<br />
                        Hours: Wed - Sat, 1PM &mdash; 6PM<br />
                    </div>
                </div>
                <div class="text-justify max-w-screen-sm mx-auto">
                    <p class="mb-3">
                        Twelve Ten Gallery is pleased to present a new painting installation by Trey Rozell. Additional
                        details forthcoming.
                    </p>
                    <div class="mt-10">
                        <p class="italic">
                            <span class="font-bold">Trey Rozell</span> (b. 1996) is an artist from the American South
                            who is currently living and working out of Chicago, IL. His practice is firmly rooted in
                            painting, but extends into sculpture, performance, installation, and animation. His work is
                            made considering the perpetuated structures embedded within the history of painting, Trey
                            utilizes absurdity, repetition, and gamesmanship as a means of inquiry into these age-old
                            subjects with the hope to observe how the rhetoric of painting continues to survive and
                            evolve today. Trey has had work exhibited at The Atlanta Contemporary Art Center (Atlanta,
                            GA), The End Project Space (Atlanta, GA), Ruschman (Chicago, IL), The Ionian Center for the
                            Arts and Culture (Kefalonia, GD) and recently received his MFA in painting from the School
                            of the Art Institute of Chicago.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
