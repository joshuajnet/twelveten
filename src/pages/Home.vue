<script setup>
import { ref } from 'vue';
</script>

<template>
    <router-link :to="{ name: 'brain-worms' }" class="flex flex-grow !no-underline">
    <div class="flex flex-grow bg-cover bg-center shadow-inner"
        style="background-image: url('/images/brain-worms/installation-direct.jpg');"
        >
        <div class="container mx-auto items-center text-sm py-8 px-3 flex flex-col grow">           
            <div class="mt-auto flex w-full md:flex-row flex-col gap-6 md:justify-between text-white">
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
        </div>
    </div>
    </router-link>
</template>
