<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { exhibitionPath, formatDateRange } from '@twelveten/shared';
import Footer from '@/components/Footer.vue';
import ArtImage from '@/components/ArtImage.vue';
import { api } from '@/api/client';
import { useResource } from '@/composables/useResource';
import { useMeta } from '@/composables/useMeta';
import { isAdmin } from '@/session';
import { editMode } from '@/admin/state';

const HomeEditor = defineAsyncComponent(() => import('@/admin/HomeEditor.vue'));

defineProps<{ menuActive?: boolean }>();

const { data: home, reload } = useResource(
    () => 'home',
    () => api.home(),
);

const target = computed(() => (home.value?.link ? exhibitionPath(home.value.link) : null));
const dates = computed(() => {
    const h = home.value;
    if (!h) return '';
    const start = h.link?.startsOn ?? h.startsOn;
    const end = h.link?.endsOn ?? h.endsOn;
    return start && end ? formatDateRange(start, end) : '';
});
const textClass = computed(() => (home.value?.textColor === 'white' ? 'text-white hover:text-white!' : 'text-black hover:text-black!'));

useMeta(() => (home.value ? { kind: 'home', home: home.value } : null));
</script>

<template>
    <!-- Stable root: the route <transition> attaches here, so swapping to the (async) editor happens inside it. -->
    <div class="flex grow">
        <HomeEditor v-if="isAdmin && editMode.editing" @saved="reload" />
        <component :is="target ? 'router-link' : 'div'" v-else v-bind="target ? { to: target } : {}" class="flex grow no-underline!">
            <div class="fixed top-0 left-0 w-full h-full flex grow bg-cover bg-center">
                <div class="absolute top-[-4px] right-[-4px] left-[-4px] bottom-[-4px] bg-sky-900">
                    <template v-if="home">
                        <ArtImage
                            :src="home.bgImage"
                            alt=""
                            eager
                            sharpest
                            fit="cover"
                            sizes="100vw"
                            :class="{ 'blur-bg': menuActive }"
                            :style="{ objectPosition: home.bgFocalPoint }"
                            class="md:block hidden home-bg object-cover w-full h-full"
                        />
                        <ArtImage
                            :src="home.bgImageMobile ?? home.bgImage"
                            alt=""
                            eager
                            sharpest
                            fit="cover"
                            sizes="100vw"
                            :class="{ 'blur-bg': menuActive }"
                            :style="{ objectPosition: home.bgFocalPoint }"
                            class="md:hidden home-bg object-cover w-full h-full"
                        />
                    </template>
                </div>
                <div class="relative z-10 container mx-auto text-sm py-8 mb-4 px-3 flex flex-col grow" :class="{ 'blur-bg bg-sky-900': menuActive }">
                    <div v-if="home" class="mt-auto flex w-full md:flex-row flex-col md:gap-6 md:justify-between" :class="textClass">
                        <div class="text-left text-lg">
                            <strong v-if="home.headline" class="text-xl"> {{ home.headline }}</strong><br />
                            {{ home.subline }}
                            <template v-if="home.extraText"><br />{{ home.extraText }}</template>
                        </div>
                        <div v-if="dates" class="md:block hidden md:text-right md:mt-auto text-lg">
                            {{ dates }}
                        </div>
                    </div>
                    <Footer class="relative z-10 grow-0! shrink!" />
                </div>
            </div>
        </component>
    </div>
</template>

<style scoped>
.home-bg {
    transition: all 0.2s ease-in-out;
}
.blur-bg {
    opacity: 0.7;
    filter: blur(2px);
}
</style>
