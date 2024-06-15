<script setup>
import { ref } from 'vue';

const menuActive = ref(0);
</script>

<template>
    <div class="bg-white w-full">
        <div class="container mx-auto py-8 px-3 md:justify-between flex md:flex-row flex-col md:items-center">
            <div class="justify-between flex items-center">
                <router-link :to="{ name: 'home' }" @click="menuActive = 0">
                    <h1 class="text-4xl mb-0 font-germania-one text-sky-900">Twelve Ten</h1>
                </router-link>

                <div class="md:hidden block text-xl" @click="menuActive = !menuActive">
                    <span v-if="!menuActive"><i class="las la-bars"></i></span>
                    <span v-if="menuActive"><i class="las la-times"></i></span>
                </div>
            </div>

            <div class="md:flex flex md:gap-6 gap-3 md:flex-row flex-col md:mt-0 mt-3 md:text-xl text-sky-800" :class="{ hidden: !menuActive }">
                <router-link :to="{ name: 'exhibitions' }" @click="menuActive = !menuActive">Exhibitions</router-link>
                <router-link :to="{ name: 'news' }" @click="menuActive = !menuActive">News</router-link>
                <router-link :to="{ name: 'about' }" @click="menuActive = !menuActive">About</router-link>
                <a href="https://www.instagram.com/twelvetengallery/" target="_blank" class="flex items-center"
                    ><i class="lab la-instagram"></i>
                    <span class="md:hidden ml-2">Instagram</span>
                </a>
            </div>
        </div>
    </div>
</template>

<style scoped>
a:hover {
    @apply text-sky-900;
}
</style>
