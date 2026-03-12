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
        <div class="container mx-auto grid md:grid-cols-2 gap-6 px-3">
            <img
                v-lazy="{ src: '/images/signal/africh-signal-square-nomark.jpg' }"
                class="max-w-full w-auto h-auto mx-auto"
                alt="Noelle Africh: Signal. April 4th - May 23rd, 2026"
            />
            <div id="press-release">
                <div class="grid md:grid-cols-2 grid-cols-1 gap-3 mb-6 mx-auto">
                    <div class="flex justify-between">
                        <div class="text-lg">
                            <strong>Noelle Africh</strong><br />
                            <em>Signal</em>
                        </div>
                    </div>
                    <div class="md:text-right text-left">
                        <a
                            href="/docs/signal/noelle-africh-signal-press-release.pdf"
                            class="block mb-3"
                            target="_blank"
                        >
                            PDF
                        </a>
                        April 4th &mdash; May 23rd, 2026<br />
                        Opening: April 4th, 6 &mdash; 9PM<br />
                        Hours: Wed - Sat, 1PM — 6PM
                    </div>
                </div>
                <div class="text-justify max-w-screen-sm mx-auto">
                    <p class="mb-3">
                        Twelve Ten Gallery is thrilled to present <em>Signal</em>, an exhibition by Noelle Africh. For
                        their solo presentation, Africh explores the mutability of distemper, a medium historically
                        associated with decorative painting, but here transformed into an opaque surface through which
                        the artist investigates the emergence of form.
                    </p>
                    <p class="mb-3">
                        Composed of pigment, chalk and a glue binder, distemper is amongst the earliest traditional
                        painting materials. Its quick preparation and economical application later made it common in
                        scenic painting for theater and architecture. Africh approaches the medium not as a stable
                        historical technique but as a volatile material system, probing the limits of its physical and
                        representational qualities.
                    </p>
                    <p class="mb-3">
                        Africh’s process begins with the search for an abstract form that can only be known
                        retrospectively. Because distemper must be applied hot to remain fluid, its surface initially
                        appears cloudy and unstable, resisting clear definition. The artist intensifies this uncertainty
                        through experimental methods that reactivate the surface as it begins to cure. Each intervention
                        alters the field while simultaneously obscuring its effects, leaving the image to unfold through
                        a sequence of partial revelations. The painting develops from these contingent trajectories,
                        only emerging in the last instance.
                    </p>
                    <p class="mb-3">
                        Yet the ambiguous forms that emerge are not arbitrary. In mathematics, a
                        <em>generic</em> property is one that holds for almost all configurations of a system, while
                        <em>non-generic</em> cases arise only under special conditions. Human perception is acutely
                        sensitive to such rare configurations. In information theory, a <em>signal</em> describes the
                        recognition of meaningful structure within noise—the moment when a figure becomes perceptible
                        against the field from which it arises.
                    </p>
                    <p class="mb-3">
                        The mathematician René Thom extended these ideas to living systems through a topology of
                        morphogenesis and the development of catastrophe theory, a branch of dynamical systems theory
                        that studies how gradual changes in underlying parameters can produce sudden qualitative shifts
                        in form. Africh, also trained as a mathematician, approaches painting as a parallel inquiry into
                        emergence: a way of tracing how latent structures surface from unstable material conditions and
                        how perceived order arises from uncertainty.
                    </p>
                    <p class="mb-3">
                        Distemper’s spectral qualities introduce a temporal dimension to this process, its opaque and
                        luminous surface evoking what Jacques Derrida described as “hauntology”, the persistent trace of
                        lost futures within the present. Once used to construct theatrical illusions and architectural
                        ornament, the medium carries the residue of its history and utopian aspirations. Africh’s
                        paintings treat the surface as a field where such traces linger and forms appear less as fixed
                        images than as signals surfacing from the submerged memory of the material itself.
                    </p>
                    <div class="mt-10">
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
