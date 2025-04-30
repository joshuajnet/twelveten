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
    <router-link :to="{ name: 'as-above-so-below' }" class="flex flex-grow !no-underline">
        <div class="fixed top-0 left-0 w-full h-full flex flex-grow bg-cover bg-center">
            <div class="absolute top-[-4px] right-[-4px] left-[-4px] bottom-[-4px] bg-sky-900">
                <!--<div class="absolute w-full h-full overlay" />-->
                <img
                    src="/images/as-above-so-below/TR_WIDE_IT3-6-edit-min.jpg"
                    :class="{ 'blur-bg': menuActive }"
                    class="md:block hidden home-bg object-cover w-full h-full"
                />
                <img
                    src="/images/as-above-so-below/TR_DUAL-2A-min.jpg"
                    :class="{ 'blur-bg': menuActive }"
                    class="md:hidden home-bg object-cover w-full h-full"
                />
            </div>
            <div class="relative z-10 container mx-auto items-center text-sm pt-8 px-3 flex flex-col grow">
                <div
                    class="mt-auto flex w-full md:flex-row flex-col md:gap-6 md:justify-between text-sky-950 !hover:text-sky-950"
                >
                    <div class="text-lg">
                        <div class="text-lg font-bold">
                            Trey Rozell<br />
                            <span class="text-base">As above, so below</span>
                        </div>
                    </div>
                    <div class="md:block hidden md:text-right md:mt-auto font-bold">
                        April 12th &mdash; May 24th, 2025<br />
                        Opening: April 12th, 6PM &mdash; 9PM<br />
                        Artist Talk: April 25th, 6PM &mdash; 8PM<br />
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
