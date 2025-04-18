<script>
import { ref } from 'vue';
import GallerySlideshow from '../../components/GallerySlideshow.vue';
import slideshowData from '../../json/as-above-so-below-slideshow.json';

export default {
    components: {
        GallerySlideshow,
    },
    data() {
        return {
            slides: slideshowData,
        };
    },
};
</script>

<template>
    <div class="flex flex-col grow">
        <div v-if="true === false">
            <GallerySlideshow :slides="slides" :worksAvailable="true" />
        </div>
        <div class="container mx-auto grid md:grid-cols-1 gap-6 px-3 max-w-xl">
            <img
                v-if="true === false"
                src="/images/as-above-so-below/trey-flier-nomark.jpg"
                class="max-w-full w-auto h-auto mx-auto"
            />
            <div id="press-release">
                <div class="grid md:grid-cols-2 grid-cols-1 gap-3 mb-6 mx-auto">
                    <div class="flex justify-between">
                        <div class="text-lg">
                            Anna Engelhardt<br />
                            Mark Cinkevich<br />
                            <span class="text-base italic">Terror Element</span>
                        </div>
                    </div>
                    <div class="md:text-right text-left">
                        <a
                            v-if="true === false"
                            href="/docs/as-above-so-below/trey-rozell-press-release.pdf"
                            class="block mb-3"
                            target="_blank"
                        >
                            PDF
                        </a>
                        June 7th &mdash; July 19th, 2025<br />
                        Opening: June 7th, 6PM &mdash; 9PM<br />
                        Hours: Wed - Sat, 1PM &mdash; 6PM<br />
                    </div>
                </div>
                <div class="text-justify max-w-screen-sm mx-auto">
                    <p class="mb-3">
                        Twelve Ten Gallery is please to present "Terror Element" by Anna Engelhardt and Mark Cinkevitch.
                        Additional details forthcoming.
                    </p>
                    <div class="mt-10">
                        <p class="italic mb-3">
                            <span class="font-bold">Anna Engelhardt</span> is an alias of a video artist and writer. Her
                            investigative practice follows the traces of material violence, focusing on what could be
                            seen as the ‘ghost’ of information. The toxic information environments she deals with stem
                            from structures of extraction, occupation and dispossession. Her work has been shown at
                            transmediale, Berlin; ICA, London; Kyiv Biennial; Ars Electronica; Biennial TEA Tenerife;
                            National Gallery of Art, Lithuania, BFI London Film Festival; B3 Biennial of the Moving
                            Image, Frankfurt; The Henie Onstad Triennial for Photography and New Media, Oslo.
                        </p>
                        <p class="italic mb-3">
                            <span class="font-bold">Mark Cinkevich</span> is a Belarus-born interdisciplinary researcher
                            and artist. In his practice, he is interested in critical, speculative and experimental
                            aspects of art that operate at the intersection of fact and fiction. His work focuses on the
                            post-Soviet infrastructural and social landscape, through which he explores in particular
                            the concepts of nuclear colonialism, infrastructural colonialism, extractivism and
                            monstrosity. His works have been shown at transmediale in Berlin, steirischer herbst in
                            Graz, the BFI London Film Festival, the National Gallery of Art in Vilnius, Ars Electronica
                            in Linz, and the Aksioma Institute for Contemporary Art in Ljubljana, among others.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
