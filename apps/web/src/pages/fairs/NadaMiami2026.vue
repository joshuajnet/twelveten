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
        <div v-if="true === false">
            <GallerySlideshow :slides="slides" :worksAvailable="true" />
        </div>
        <div class="container max-w-screen-sm mx-auto grid md:grid-cols-1 gap-6 px-3">
            <div id="press-release">
                <div class="grid md:grid-cols-2 grid-cols-1 gap-3 mb-6 mx-auto">
                    <div class="flex justify-between">
                        <div class="text-lg">
                            <strong>Noelle Africh</strong><br />
                            <em>NADA Miami 2026</em>
                        </div>
                    </div>
                    <div class="md:text-right text-left">
                        <a  v-if="true === false"
                            href="/docs/nada-miami-2025/tali-halpern-nada-miami-preview.pdf"
                            class="block mb-3"
                            target="_blank"
                        >
                            Preview PDF
                        </a>
                        December 1st &mdash; 5th, 2026<br />
                        Ice Palace Studios<br />
                        1400 North Miami Avenue<br />
                        <a
                            href="mailto:joshua@twelvetengallery.com?subject=NADA"
                            class="py-1 px-3 inline-block cursor-pointer hover:text-sky-600 !no-underline border hover:shadow mt-3 font-roboto font-light text-sm"
                        >
                            Inquire
                        </a>
                    </div>
                </div>
                <div class="text-justify max-w-screen-sm mx-auto">
                    <p class="mb-3">
                        Twelve Ten Gallery is pleased to present a solo booth of paintings by Chicago-based artist Noelle Africh. Africh's paintings explore the emergence of form through the material and historical properties of distemper, recasting one of the earliest painting media in conversation with modern forms of image making. Drawing from a diverse array of influences, including early photographic experimentation, material and process based-art, Africh develops the medium and its mnemonic content, affecting the moment where recognition is retroactively constituted.
                    </p>
                    <p class="mb-3">
                        <img
                            src="/images/nada-miami-2026/privacy.jpg"
                            alt="Noelle Africh, 'Privacy', 2026. Distemper on linen over panel. 12 x 9 in (22.86 x 20.48
                        cm). Photo credit: Jonas Mueller."
                        />
                    </p>
                    <p class="mb-6 text-center font-roboto font-light text-xs">
                        Noelle Africh, "Privacy", 2026. Distemper on linen over panel. 12 x 9 in (22.86 x 20.48
                        cm). Photo credit: Jonas Mueller.
                    </p>
                    <p class="mb-3">
                        Consisting of chalk, pigment, and a binder, distemper is a medium that is applied while hot and fluid, undergoing a continual process of change as it cools and cures. The artist engages this alchemical flux, intervening with experimental techniques that reactivate the surface and alter its contingent outcomes. Latent images become visible through a material reaction, as though developed rather than composed. In this respect, Africh’s process recalls the temporal doubling of photographic processes, as the image is carefully calibrated in both its time of capture and time of exposure.
                    </p>
                    <p class="mb-3">
                        Africh’s images emerge mercurially through successive stages, the final form remaining unfixed until the artist marks their completion through an axiomatic decision. In this sense they draw on the rich dialectical arc between tradition and the avant-garde, as the determinate gestures of craft and authorial heroism are reconstituted in favor of autonomic execution and the selective framing of process and materials. The artist’s decision to arrest the process of a painting into one state, one moment, rather than another, demands a similarly nominative attention, their paintings occupying a space between the procedural and the intentional.
                    </p>
                    <p>
                        For Africh, this process of continuous change is where mimicry inspires mimesis. Recalling the work of post-minimalists such as Lynda Benglis or Eva Hesse, whose practices demonstrate how the literality of material acquires a new expressive relationship in regards to the body and time,  Africh stages the synthetic constitution of memory. Their paintings foreground the act of recognition itself: the moment when a particular form may surface or be submerged within an indeterminate field.
                    </p>
                    <p class="mb-3" s>
                        For NADA Miami 2026, this focused presentation will bring together a selection of recent works that highlight Africh’s singular engagement with material transformation and the representational possibilities of painting’s surface.
                    </p>
                    <div class="mt-10">
                        <p class="italic mb-3">
                            <span class="font-bold">Noelle Africh</span> (b. 1992, Chicago, IL) lives and works in Chicago, IL. They received an MFA in Painting and Drawing from The School of the Art Institute of Chicago and a Bachelor of Science degree in Mathematics from the University of Illinois in Urbana-Champaign. Solo exhibitions include "Signal", Twelve Ten (Chicago, IL), "Superstition", Slow Dance (Chicago, IL) and "Loomer", SHED Projects (Cleveland, OH). They have also participated in a three-person at No31 (Duns, Scotland) in 2026, and many group exhibitions including at Galerie Gisela Clement (Bonn, Germany), RUSCHWOMAN (Chicago, IL), Hyde Park Art Center (Chicago, IL), The Plan (Chicago, IL), The Green Gallery - West (Milwaukee, WI), and Patient Info (Chicago, IL), among others.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
