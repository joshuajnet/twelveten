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
    <router-link :to="{ name: 'star-e-eyed' }" class="flex flex-grow !no-underline">
        <div class="fixed top-0 left-0 w-full h-full flex flex-grow bg-cover bg-center">
            <div class="absolute top-[-4px] right-[-4px] left-[-4px] bottom-[-4px] bg-sky-900">
                <!--<div class="absolute w-full h-full overlay" />-->
                <img
                    src="/images/star-e-eyed/halpern-install2.jpg"
                    :class="{ 'blur-bg': menuActive }"
                    class="md:block hidden home-bg object-cover w-full h-full"
                />
                <img
                    src="/images/star-e-eyed/halpern-star.jpg"
                    :class="{ 'blur-bg': menuActive }"
                    class="md:hidden home-bg object-cover w-full h-full"
                />
            </div>
            <div class="relative z-10 container mx-auto items-center text-sm pt-8 px-3 flex flex-col grow">
                <div
                    class="mt-auto flex w-full md:flex-row flex-col md:gap-6 md:justify-between"
                >
                    <div class="text-lg">
                        <div class="text-lg mb-1 font-roboto font-bold uppercase">
                            TALI HALPERN<br />
                            <span class="text-base">&#9733;E EYED</span>
                        </div>
                    </div>
                    <div class="md:block hidden md:text-right md:mt-auto font-bold">
                        September 28th &mdash; October 26th, 2024<br />
                        Opening September 28th, 6PM &mdash; 9PM<br />
                        Hours: Wed - Sat, 1PM &mdash; 6PM<br />
                    </div>
                </div>
                <Footer class="relative z-10 !flex-grow-0 !flex-shrink" />
            </div>
        </div>
    </router-link>
</template>
<style scoped>
.overlay {
    background: rgba(0, 0, 0, 0.15);
}
.home-bg {
    transition: all 0.2s ease-in-out;
}
.blur-bg {
    opacity: 0.7;
    filter: blur(2px);
}
.shadow-text {
    text-shadow: 2px 2px 6px rgba(0, 0, 0, 0.05), -2px -2px 6px rgba(0, 0, 0, 0.05), 2px -2px 6px rgba(0, 0, 0, 0.2),
        -2px 2px 6px rgba(0, 0, 0, 0.05);
}
</style>
