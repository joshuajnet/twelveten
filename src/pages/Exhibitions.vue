<script setup>
import { ref } from 'vue';
</script>

<template>
    <div class="container mx-auto py-4 px-3 flex flex-col grow">
        <div class="grid md:grid-cols-4 grid-cols-2 gap-6 mb-6">
            <div v-if="true == false">
                <h3 class="text-xl font-bold mb-3">Current</h3>
                <router-link :to="{ name: 'brain-worms' }">
                    <img
                        src="/images/brain-worms/brain-worms-nomark-min.png"
                        class="max-w-full w-auto h-auto mx-auto"
                        style="max-height: calc(100vh - 200px)"
                    />
                </router-link>
            </div>
            <div>
                <h3 class="text-xl font-bold mb-3">Upcoming</h3>
                <router-link :to="{ name: 'star-e-eyed' }">
                    <img
                        src="/images/star-e-eyed/halpern-nomark-min.jpg"
                        class="max-w-full w-auto h-auto mx-auto"
                        style="max-height: calc(100vh - 200px)"
                    />
                </router-link>
            </div>
        </div>
        <h3 class="text-xl font-bold mb-3">Past</h3>
        <div class="grid md:grid-cols-4 grid-cols-2 gap-6">
            <router-link :to="{ name: 'brain-worms' }">
                <img
                    src="/images/brain-worms/brain-worms-nomark-min.png"
                    class="max-w-full w-auto h-auto mx-auto"
                    style="max-height: calc(100vh - 200px)"
                />
            </router-link>
            <router-link :to="{ name: 'the-veil' }">
                <img
                    src="/images/veil/veil-2-nomark-min.png"
                    class="max-w-full w-auto h-auto mx-auto"
                    style="max-height: calc(100vh - 200px)"
                />
            </router-link>
            <router-link :to="{ name: 'delphic-future' }">
                <img
                    src="/images/delphic-future/delphic-future-nomark-min.png"
                    class="max-w-full w-auto h-auto mx-auto"
                    style="max-height: calc(100vh - 200px)"
                />
            </router-link>
            <router-link :to="{ name: 'bullet-hell' }">
                <img
                    src="/images/bullethell/bullethell-nomark-min.png"
                    class="max-w-full w-auto h-auto mx-auto"
                    style="max-height: calc(100vh - 200px)"
                />
            </router-link>
            <router-link :to="{ name: 'speedrunners' }">
                <img
                    src="../assets/speedrunners-flier.svg"
                    class="max-w-full w-auto h-auto mx-auto"
                    style="max-height: calc(100vh - 200px)"
                />
            </router-link>
        </div>
    </div>
</template>
