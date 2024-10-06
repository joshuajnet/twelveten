<script>
export default {
    data() {
        return {
            menuActive: false,
        };
    },
    mounted() {
        this.menuActive = false;
    },
    methods: {
        toggleMenu() {
            this.menuActive = !this.menuActive;
            this.$emit('menu', this.menuActive);
        },
        closeMenu() {
            this.menuActive = false;
            this.$emit('menu', this.menuActive);
        },
    },
};
</script>

<template>
    <div class="z-10 w-full header-bg">
        <div class="container mx-auto py-8 px-3 md:justify-between flex md:flex-row flex-col md:items-center">
            <div class="justify-between flex items-center">
                <router-link :to="{ name: 'home' }" @click="closeMenu()">
                    <h1
                        class="text-4xl mb-0 font-germania-one text-sky-900"
                    >
                        Twelve Ten
                    </h1>
                </router-link>

                <div
                    class="md:hidden block text-xl"
                    @click="toggleMenu()"
                >
                    <span v-if="!menuActive"><i class="las la-bars"></i></span>
                    <span v-if="menuActive"><i class="las la-times"></i></span>
                </div>
            </div>

            <div
                class="md:flex flex md:gap-6 gap-3 md:flex-row flex-col md:mt-0 mt-3 md:text-xl md:text-sky-900 transition-all"
                :class="[{ 'text-white': $route.name == 'home' }, { hidden: !menuActive }]"
            >
                <router-link
                    class="hover:text-sky-600"
                    :class="{ 'text-sky-600': $route.name == 'exhibitions' }"
                    :to="{ name: 'exhibitions' }"
                    @click="closeMenu()"
                >
                    Exhibitions
                </router-link>
                <router-link
                    class="hover:text-sky-600"
                    :class="{ 'text-sky-600': $route.name == 'news' }"
                    :to="{ name: 'news' }"
                    @click="closeMenu()"
                >
                    News
                </router-link>
                <router-link
                    class="hover:text-sky-600"
                    :class="{ 'text-sky-600': $route.name == 'about' }"
                    :to="{ name: 'about' }"
                    @click="closeMenu()"
                >
                    About
                </router-link>
                <a
                    class="hover:text-sky-600 flex items-center"
                    href="https://www.instagram.com/twelvetengallery/"
                    target="_blank"
                >
                    <i class="lab la-instagram"></i>
                    <span class="md:hidden ml-2">Instagram</span>
                </a>
            </div>
        </div>
    </div>
</template>

<style scoped>
.shadow-text {
    text-shadow: 2px 2px 6px rgba(0, 0, 0, 0.05), -2px -2px 6px rgba(0, 0, 0, 0.05), 2px -2px 6px rgba(0, 0, 0, 0.2),
        -2px 2px 6px rgba(0, 0, 0, 0.05);
}
</style>
