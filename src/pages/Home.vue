<script setup>
import { ref } from 'vue';
import Footer from '../components/Footer.vue';
</script>

<template>
    <router-link :to="{ name: 'brain-worms' }" class="flex flex-grow !no-underline">
    <div class="fixed top-0 left-0 w-full h-full flex flex-grow bg-cover bg-center"
        style="background-image: url('/images/brain-worms/installation-direct.jpg');"
        >
        <div class="absolute w-full h-full overlay" />
        <div class="relative z-10 container mx-auto items-center text-sm pt-8 px-3 flex flex-col grow">           
            <div class="mt-auto flex w-full md:flex-row flex-col md:gap-6 md:justify-between text-white hover:text-sky-200 shadow-text transition-all">
                <div class="text-lg md:mb-0 mb-3">
                    <div class="font-bold">
                        Pieter Schoolwerth<br />
                        Keith Tilford
                    </div>
                    <span class="font-creepster text-2xl">Brain Worms</span><br />
                </div>
                <div class="md:text-right md:mt-auto font-bold">
                    June 8th &mdash; July 27th, 2024<br />
                    Opening June 8th, 6PM &mdash; 9PM<br />
                    Hours: Wed - Sat, 1PM &mdash; 6PM<br />
                </div>
            </div>
            <Footer class="relative z-10 text-white !flex-grow-0 !flex-shrink" />
        </div>
    </div>
    </router-link>
</template>
<style scoped>
.overlay {
    background: rgba(255,255,255,0.7);
    background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.1) 70%, rgba(0,0,0,.3) 80%, rgba(0,0,0,.5) 100%);
}
.shadow-text {
    text-shadow: 2px 2px 6px rgba(0,0,0,.1),-2px -2px 6px rgba(0,0,0,.1), 2px -2px 6px rgba(0,0,0,.2), -2px 2px 6px rgba(0,0,0,.1);
}
</style>
