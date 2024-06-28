<script setup>
import Header from './components/Header.vue';
import Footer from './components/Footer.vue';
</script>

<template>
    <div id="app" class="relative flex grow flex-col w-full font-gentium-book text-slate-900">
        <Header />

        <main class="flex grow flex-col">
            <router-view v-slot="{ Component }">
                <transition name="route" mode="out-in">
                    <component :is="Component"></component>
                </transition>
            </router-view>
        </main>

        <Footer v-if="$route.name != 'home'" />
    </div>
</template>

<style>
main a {
    @apply text-sky-900 underline transition-all cursor-pointer;
}
main a:hover {
    @apply text-slate-900;
}
main p {
    @apply mb-3;
}
/* route transitions */
.route-enter-from {
    opacity: 0;
}
.route-enter-active {
    transition: all 0.3s ease-out;
}
.route-leave-to {
    opacity: 0;
}
.route-leave active {
    transition: all 0.3s ease-in;
}
#app.overlay-enabled {
    max-height: 100vh;
    overflow: hidden;
}
</style>
