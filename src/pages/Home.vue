<script>
import Footer from '../components/Footer.vue';

export default {
    components: {
        Footer,
    },
    props: {
        menuActive: {
            type: Boolean,
            default: false,
        },
    },
};
</script>

<template>
    <router-link :to="{ name: 'brain-worms' }" class="flex flex-grow !no-underline">
    <div class="fixed top-0 left-0 w-full h-full flex flex-grow bg-cover bg-center">
        <div class="absolute top-[-4px] right-[-4px] left-[-4px] bottom-[-4px] bg-black">
            <div class="absolute w-full h-full overlay" />
            <img src="/images/brain-worms/installation-direct.jpg" :class="{'blur-bg' : menuActive}" class="home-bg object-cover w-full h-full" />
        </div>
        <div class="relative z-10 container mx-auto items-center text-sm pt-8 px-3 flex flex-col grow">           
            <div class="mt-auto flex w-full md:flex-row flex-col md:gap-6 md:justify-between text-white shadow-text">
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
    background: rgba(0,0,0,0.05);
}
.home-bg {
    transition: all .2s ease-in-out;
}
.blur-bg {
    opacity:.7;
    filter: blur(2px);
}
.shadow-text {
    text-shadow: 2px 2px 6px rgba(0,0,0,.05),-2px -2px 6px rgba(0,0,0,.05), 2px -2px 6px rgba(0,0,0,.2), -2px 2px 6px rgba(0,0,0,.05);
}
</style>
