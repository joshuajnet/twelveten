<script setup>
import { defineAsyncComponent, onMounted, ref } from 'vue';
import Header from './components/Header.vue';
import Footer from './components/Footer.vue';
import { isAdmin, loadSession } from './session';

// Editing tools are a separate bundle, downloaded only for signed-in admins.
const AdminLayer = defineAsyncComponent(() => import('./admin/AdminLayer.vue'));
const menuActive = ref(false);

onMounted(() => void loadSession());
</script>

<template>
    <div id="app" class="relative flex grow flex-col w-full font-gentium-book text-slate-900">
        <Header @menu="menuActive = $event" />

        <main class="flex grow flex-col">
            <router-view v-slot="{ Component }">
                <transition name="route" mode="out-in">
                    <component :is="Component" :menuActive="menuActive"></component>
                </transition>
            </router-view>
        </main>

        <Footer v-if="$route.name != 'home'" />
        <AdminLayer v-if="isAdmin" />
    </div>
</template>

<style>
@reference "@/style.css";
/* In the base layer so utility classes (e.g. no-underline, mb-6) still override these. */
@layer base {
    main a {
        @apply text-sky-900 underline transition-all cursor-pointer;
    }
    main a:hover {
        @apply text-slate-900;
    }
    main p {
        @apply mb-3;
    }
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
