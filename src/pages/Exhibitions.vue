<script setup>
import { ref } from 'vue';
</script>

<template>
    <div class="container mx-auto py-4 px-3 flex flex-col grow">
        <div class="grid md:grid-cols-4 grid-cols-2 gap-6 mb-6">
            <div v-if="true === false">
                <h3 class="font-roboto text-xl mb-3">Current</h3>
                <router-link :to="{ name: 'as-above-so-below' }" class="no-underline text-2xl">
                    <img
                        v-lazy="{ src: '/images/as-above-so-below/trey-flier-nomark.jpg' }"
                        class="lazy-image max-w-full w-auto h-auto mx-auto"
                        style="max-height: calc(100vh - 200px)"
                        alt="Trey Rozell: As above, so below. April 12th — May 24th, 2025"
                    />
                </router-link>
            </div>
            <div>
                <h3 class="font-roboto text-xl mb-3">Upcoming</h3>
                <router-link :to="{ name: 'terror-element' }" class="no-underline text-2xl">
                    <img
                        v-lazy="{ src: '/images/terror-element/terror-element-nomark.jpg' }"
                        class="lazy-image max-w-full w-auto h-auto mx-auto"
                        style="max-height: calc(100vh - 200px)"
                        alt="Anna Engelhardt, Mark Cinkevich: Terror Element. June 7th - July 19th, 2025"
                    />
                </router-link>
            </div>
        </div>
        <h3 class="font-roboto text-xl mb-3">Past</h3>
        <div class="grid md:grid-cols-4 grid-cols-2 gap-6">
            <router-link :to="{ name: 'as-above-so-below' }" class="no-underline text-2xl">
                <img
                    v-lazy="{ src: '/images/as-above-so-below/trey-flier-nomark.jpg' }"
                    class="lazy-image max-w-full w-auto h-auto mx-auto"
                    style="max-height: calc(100vh - 200px)"
                    alt="Trey Rozell: As above, so below. April 12th — May 24th, 2025"
                />
            </router-link>
            <router-link :to="{ name: 'ryleans' }">
                <img
                    v-lazy="{ src: '/images/ryleans/ryleans-flier-nomark.jpg' }"
                    class="lazy-image max-w-full w-auto h-auto mx-auto"
                    style="max-height: calc(100vh - 200px)"
                    alt="The Ryleans. February 15th — March 29th, 2025"
                />
            </router-link>
            <router-link :to="{ name: 'coldbomb' }">
                <img
                    v-lazy="{ src: '/images/coldbomb/loebs-nomark2.jpg' }"
                    class="lazy-image max-w-full w-auto h-auto mx-auto"
                    style="max-height: calc(100vh - 200px)"
                    alt="Jason Loebs: Coldbomb. November 9th — December 21st, 2024"
                />
            </router-link>
            <router-link :to="{ name: 'star-e-eyed' }">
                <img
                    v-lazy="{ src: '/images/star-e-eyed/halpern-nomark-min.jpg' }"
                    class="lazy-image max-w-full w-auto h-auto mx-auto"
                    style="max-height: calc(100vh - 200px)"
                    alt="Tali Halpern: Star(e) Eyed. September 28th — November 2nd, 2024"
                />
            </router-link>
            <router-link :to="{ name: 'brain-worms' }">
                <img
                    v-lazy="{ src: '/images/brain-worms/brain-worms-nomark-min.png' }"
                    class="lazy-image max-w-full w-auto h-auto mx-auto"
                    style="max-height: calc(100vh - 200px)"
                    alt="Pieter Schoolwerth, Keith Tilford: Brain Worms. June 8th — July 27th, 2024"
                />
            </router-link>
            <router-link :to="{ name: 'the-veil' }">
                <img
                    v-lazy="{ src: '/images/veil/veil-2-nomark-min.png' }"
                    class="lazy-image max-w-full w-auto h-auto mx-auto"
                    style="max-height: calc(100vh - 200px)"
                    alt="The Veil. April 5th — May 25th, 2024"
                />
            </router-link>
            <router-link :to="{ name: 'delphic-future' }">
                <img
                    v-lazy="{ src: '/images/delphic-future/delphic-future-nomark-min.png' }"
                    class="lazy-image max-w-full w-auto h-auto mx-auto"
                    style="max-height: calc(100vh - 200px)"
                    alt="Amanda Beech: Delphic Future. February 4th — March 23rd, 2024"
                />
            </router-link>
            <router-link :to="{ name: 'bullet-hell' }">
                <img
                    v-lazy="{ src: '/images/bullethell/bullethell-nomark-min.png' }"
                    class="lazy-image max-w-full w-auto h-auto mx-auto"
                    style="max-height: calc(100vh - 200px)"
                    alt="Bullet Hell: November 17th — January 12th, 2024"
                />
            </router-link>
            <router-link :to="{ name: 'speedrunners' }">
                <img
                    v-lazy="{ src: '/images/speedrunners/speedrunners-flier.svg' }"
                    class="lazy-image max-w-full w-auto h-auto mx-auto"
                    style="max-height: calc(100vh - 200px)"
                    alt="Speedrunners: September 29th — November 11th, 2023"
                />
            </router-link>
        </div>
    </div>
</template>

<style scoped="postcss">
.lazy-image {
    transition: opacity 0.5s ease-in-out;
}
img[lazy='loading'] {
    opacity: 0;
}
img[lazy='loaded'] {
    opacity: 1;
}
</style>
