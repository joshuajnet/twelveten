<script>
import { ref } from 'vue';
import GallerySlideshow from '../../components/GallerySlideshow.vue';
import slideshowData from '../../json/nada-miami-2025-slideshow.json';

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
        <div>
            <GallerySlideshow :slides="slides" :worksAvailable="true" v-if="true === false" />
        </div>
        <div class="container max-w-screen-sm mx-auto grid md:grid-cols-1 gap-6 px-3">
            <div id="press-release">
                <div class="grid md:grid-cols-2 grid-cols-1 gap-3 mb-6 mx-auto">
                    <div class="flex justify-between">
                        <div class="text-lg">
                            <strong>Noelle Africh</strong><br />
                            <strong>Micah Schippa-Wildfong</strong><br />
                            <span class="italic">Neighbors</span><br />
                        </div>
                    </div>
                    <div class="md:text-right text-left">
                        <a
                            v-if="true === false"
                            href="/docs/nada-miami-2025/tali-halpern-nada-miami-preview.pdf"
                            class="block mb-3"
                            target="_blank"
                        >
                            Preview PDF
                        </a>
                        <a href="https://www.neighbors.art/" target="_blank">Neighbors website</a><br />
                        April 8th &mdash; 12th, 2026<br />
                        1355 North Astor, Chicago IL 60610<br />
                        <a
                            href="mailto:joshua@twelvetengallery.com?subject=Neighbors"
                            class="py-1 px-3 inline-block cursor-pointer hover:text-sky-600 !no-underline border hover:shadow mt-3 font-roboto font-light text-sm"
                        >
                            Inquire
                        </a>
                    </div>
                </div>
                <div class="text-justify max-w-screen-sm mx-auto">
                    <p class="mb-6">
                        Twelve Ten Gallery is pleased to present Micah Schippa-Wildfong and Noelle Africh in the
                        inaugural edition of Neighbors Chicago, featuring works that thoughtfully engage with the
                        distinct domestic architecture of the space. Each artist's work uniquely references materials
                        commonly found and historically situated in the home, but through their practices they highlight
                        a sense of loss and the absence of presence.
                    </p>
                    <p class="mb-3">
                        <img
                            src="/images/liberte/1210_MICAH_RE-15.jpg"
                            alt="Micah Schippa-Wildfong, 'american sleep', 2024-ongoing. Lights collected from various locations
                        of purpose, each set to an automatic incremental timer. Dimensions variable."
                        />
                    </p>
                    <p class="mb-6 text-center font-roboto font-light text-xs">
                        Micah Schippa-Wildfong, "american sleep", 2024-ongoing. Lights collected from various locations
                        of purpose, each set to an automatic incremental timer. Dimensions variable. Photo credit: Mikey
                        Mosher.
                    </p>
                    <p class="mb-3">
                        Micah Schippa-Wildfong's "american sleep" (2024-ongoing) expands on the artist's past
                        performance for the Gray Center for Arts and Inquiry and its recent exhibition at Twelve Ten
                        Gallery. Consisting of a constellation of lights set to various timers, the installation
                        presents us with a synecdoche of the electrical grid, a large, mostly invisible and abstract
                        structure that people interact with in their rhythms of daily life but rarely consider. As in
                        much of the artist's work, found objects are submitted to a set of procedures determined by the
                        artist, but then left to develop from those initial conditions, taking on an active and poetic
                        quality. Here the lights continue their performance, winking on and off in staggered rhythms,
                        absent the ghostly subjects they allude to.
                    </p>
                    <p class="mb-6">
                        Noelle Africh's "Late Season" (2025) is a small distemper painting that reimagines a
                        historically decorative medium through an experimental, abstract lens. Rather than adhering to
                        traditional painterly approaches, Africh treats distemper as a process akin to photographic
                        chemical development, allowing the image to emerge through reactive transformation. When first
                        applied, distemper initially produces a surface that appears cloudy and unsettled, resisting
                        fixed form. Africh heightens this instability by intervening as the material begins to cure,
                        reactivating and disrupting the surface. Each gesture both alters and obscures what came before,
                        setting in motion a chain of partial revelations. From these contingent processes, the image
                        gradually materializes, less as a fixed composition than as a spectral presence, hovering at the
                        threshold of visibility.
                    </p>
                    <p class="mb-3">
                        <img
                            src="/images/signal/africh-late-season.jpg"
                            alt="Noelle Africh, 'Late Season', 2025. Distemper on linen over panel. 12 x 12 in (20.45 x 20.45
                        cm). Photo credit: Mikey Mosher."
                        />
                    </p>
                    <p class="mb-6 text-center font-roboto font-light text-xs">
                        Noelle Africh, "Late Season", 2025. Distemper on linen over panel. 12 x 12 in (20.45 x 20.45
                        cm). Photo credit: Mikey Mosher.
                    </p>
                    <div class="mt-10">
                        <p class="italic mb-3">
                            <span class="font-bold">Micah Schippa-Wildfong</span> (b. 1988) is an American artist,
                            writer, and musician living and working in Chicago. Recent solo exhibitions include
                            "LIBERTÉ", Twelve Ten Gallery (Chicago, IL), "People Are Glorious", Triangolo Gallery
                            (Cremona, IT), "In Another Room I Am Drinking Eggs from a Boot", Pech (Vienna, AT),
                            "Civilization of Happiness", Mickey (Chicago, IL), and "all fish in the night become birds",
                            ROMANCE, (Pittsburgh, PA). They have participated in group exhibitions and performances at
                            The Gray Center for Arts and Inquiry (Chicago, IL), the Museum of Contemporary Art (Chicago,
                            IL), Baader-Meinhof (Omaha, NB), Apparatus Projects (Chicago, IL), Scherben (Berlin, DE),
                            and Salzburger Kunstverein (Salzburg, AT) among many others. They have upcoming exhibitions
                            with Mutter (Amsterdam, NL) and DISPLAY (Parma, IT) later this year.
                        </p>
                        <p class="italic mb-3">
                            <span class="font-bold">Noelle Africh</span> (b. 1992 Chicago, IL) lives and works in
                            Chicago, IL. They received an MFA in Painting and Drawing from The School of the Art
                            Institute of Chicago and a Bachelor of Science degree in Mathematics from the University of
                            Illinois in Urbana-Champaign. Solo exhibitions include "Signal", Twelve Ten (Chicago, IL),
                            "Superstition", Slow Dance (Chicago, IL) and "Loomer", SHED Projects (Cleveland, OH). They
                            have also participated in many group exhibitions including at Galerie Gisela Clement (Bonn,
                            Germany), RUSCHWOMAN (Chicago, IL), Hyde Park Art Center (Chicago, IL), The Plan (Chicago,
                            IL), The Green Gallery - West (Milwaukee, WI), and Patient Info (Chicago, IL), among others.
                            They have a forthcoming two-person at No31 (Duns, Scotland) in 2026.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
