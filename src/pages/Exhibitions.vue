<script setup>
import { ref } from 'vue';
</script>

<template>
    <div class="container mx-auto py-4 px-3 flex flex-col grow">
        <div class="grid md:grid-cols-4 grid-cols-2 gap-6 mb-6">
            <div v-if="true === false">
                <h3 class="font-roboto text-xl mb-3">Current</h3>
                <router-link :to="{ name: 'coldbomb' }">
                    <img
                        v-lazy="{ src: '/images/coldbomb/loebs-nomark2.jpg' }"
                        class="lazy-image max-w-full w-auto h-auto mx-auto"
                        style="max-height: calc(100vh - 200px)"
                    />
                </router-link>
            </div>
            <div>
                <h3 class="font-roboto text-xl mb-3">Upcoming</h3>

                <div>
                    <div class="text-xl">The Ryleans</div>
                    <div class="text-sm mb-3">February 15th &mdash; March 29th 2025</div>
                    <div class="mb-1">Noelle Africh</div>
                    <div class="mb-1 leading-4">Ellis &amp; Parker von Sternberg</div>
                    <div class="mb-1">Jonathan Worcester</div>
                    Ziyi Zhang
                </div>
            </div>
        </div>
        <h3 class="font-roboto text-xl mb-3">Past</h3>
        <div class="grid md:grid-cols-4 grid-cols-2 gap-6">
            <router-link :to="{ name: 'coldbomb' }">
                <img
                    v-lazy="{ src: '/images/coldbomb/loebs-nomark2.jpg' }"
                    class="lazy-image max-w-full w-auto h-auto mx-auto"
                    style="max-height: calc(100vh - 200px)"
                />
            </router-link>
            <router-link :to="{ name: 'star-e-eyed' }">
                <img
                    v-lazy="{ src: '/images/star-e-eyed/halpern-nomark-min.jpg' }"
                    class="lazy-image max-w-full w-auto h-auto mx-auto"
                    style="max-height: calc(100vh - 200px)"
                />
            </router-link>
            <router-link :to="{ name: 'brain-worms' }">
                <img
                    v-lazy="{ src: '/images/brain-worms/brain-worms-nomark-min.png' }"
                    class="lazy-image max-w-full w-auto h-auto mx-auto"
                    style="max-height: calc(100vh - 200px)"
                />
            </router-link>
            <router-link :to="{ name: 'the-veil' }">
                <img
                    v-lazy="{ src: '/images/veil/veil-2-nomark-min.png' }"
                    class="lazy-image max-w-full w-auto h-auto mx-auto"
                    style="max-height: calc(100vh - 200px)"
                />
            </router-link>
            <router-link :to="{ name: 'delphic-future' }">
                <img
                    v-lazy="{ src: '/images/delphic-future/delphic-future-nomark-min.png' }"
                    class="lazy-image max-w-full w-auto h-auto mx-auto"
                    style="max-height: calc(100vh - 200px)"
                />
            </router-link>
            <router-link :to="{ name: 'bullet-hell' }">
                <img
                    v-lazy="{ src: '/images/bullethell/bullethell-nomark-min.png' }"
                    class="lazy-image max-w-full w-auto h-auto mx-auto"
                    style="max-height: calc(100vh - 200px)"
                />
            </router-link>
            <router-link :to="{ name: 'speedrunners' }">
                <img
                    v-lazy="{ src: '/images/speedrunners/speedrunners-flier.svg' }"
                    class="lazy-image max-w-full w-auto h-auto mx-auto"
                    style="max-height: calc(100vh - 200px)"
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
