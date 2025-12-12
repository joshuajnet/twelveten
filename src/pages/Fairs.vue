<script setup>
import { ref } from 'vue';
</script>

<template>
    <div class="container mx-auto py-4 px-3 flex flex-col grow">
        <div class="grid md:grid-cols-4 grid-cols-2 gap-6 mb-6" v-if="true === false">
            <div v-if="true === false">
                <h3 class="font-roboto text-xl mb-3">Current</h3>
                <router-link :to="{ name: 'nada-miami-2025' }" class="no-underline text-2xl">
                    <div class="text-lg">
                        Tali Halpern<br />
                        <span class="text-base italic">NADA Miami</span><br />
                        <span class="text-sm">December 2nd &mdash; 6th, 2025</span>
                    </div>
                </router-link>
            </div>
            <div>
                <h3 class="font-roboto text-xl mb-3">Upcoming</h3>
                <router-link :to="{ name: 'nada-miami-2025' }" class="no-underline text-2xl">
                    <div class="text-lg">
                        Tali Halpern<br />
                        <span class="text-base italic">NADA Miami</span><br />
                        <span class="text-sm">December 2nd &mdash; 6th, 2025</span>
                    </div>
                </router-link>
            </div>
        </div>
        <h3 class="font-roboto text-xl mb-3">Past</h3>
        <div class="grid md:grid-cols-4 grid-cols-2 gap-6">
            <router-link :to="{ name: 'nada-miami-2025' }" class="no-underline text-2xl">
                <div class="text-lg">
                    Tali Halpern<br />
                    <span class="text-base italic">NADA Miami</span><br />
                    <span class="text-sm">December 2nd &mdash; 6th, 2025</span>
                </div>
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
