<script setup>
import { ref } from 'vue';
</script>

<template>
    <div class="container mx-auto items-center text-sm py-4 px-3 flex flex-col grow">
        <div class="lg:max-w-full md:max-w-2xl my-auto">
            <router-link :to="{ name: 'brain-worms' }" class="mx-auto !no-underline">
                <img
                    src="/images/brain-worms/installation-direct.jpg"
                    class="max-w-full w-auto h-auto mx-auto mb-10"
                    style="max-height: calc(100vh - 380px)"
                />
            </router-link>
            <div class="flex md:flex-row flex-col gap-6 md:justify-between">
                <div class="text-lg mb-3">
                    <div class="font-bold">
                        Pieter Schoolwerth<br />
                        Keith Tilford
                    </div>
                    <span class="font-creepster text-2xl">Brain Worms</span><br />
                </div>
                <div class="md:text-right">
                    June 8th &mdash; July 27th, 2024<br />
                    Opening June 8th, 6PM &mdash; 9PM<br />
                    Hours: Wed - Sat, 1PM &mdash; 6PM<br />
                </div>
            </div>
        </div>
    </div>
</template>
