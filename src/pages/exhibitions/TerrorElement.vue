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
        <div class="container mx-auto grid md:grid-cols-2 gap-6 px-3">
            <img src="/images/terror-element/terror-element-nomark.jpg" class="max-w-full w-auto h-auto mx-auto" />
            <div id="press-release">
                <div class="grid md:grid-cols-2 grid-cols-1 gap-3 mb-6 mx-auto">
                    <div class="flex justify-between">
                        <div class="text-base">
                            Anna Engelhardt<br />
                            Mark Cinkevich<br />
                            <span class="text-lg">TERROR ELEMENT</span>
                        </div>
                    </div>
                    <div class="md:text-right text-left">
                        <a
                            href="/docs/terror-element/terror-element-press-release.pdf"
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
                        Twelve Ten Gallery is pleased to present "Terror Element", a video installation by Anna
                        Engelhardt and Mark Cinkevich. The exhibition follows a fictional investigator who attempts to
                        reconstruct an actual case: the 1999 apartment bombings in Russia. These incidents were a
                        pivotal moment in Russia's recent expansionist policies, and many believe the bombings were
                        orchestrated by Russian state security services to justify a second invasion of Chechnya and to
                        catalyse Vladimir Putin’s rise to power.
                    </p>
                    <p class="mb-3">
                        Engelhardt and Cinkevich, Russian and Belarusian expatriates respectively, hold faint memories
                        of the televised trials from childhood. For this work, they blend archival footage with
                        contemporary digital animation techniques, reflecting the lasting effect the past has on our
                        present. Fact and fiction merge together, paralleling the conflicting and contradictory media
                        and state reports used to justify the invasion.
                    </p>
                    <p class="mb-3">
                        “Terror Element” focuses particularly on the role of forensic science, looking at how evidence
                        can be manipulated and distorted. Drawn into grainy television footage from the past, their
                        fictional investigator tries to understand how crime labs became tools in this powerplay.
                        Slowly, her laboratory begins to resemble the televised one. As she struggles to reconcile her
                        role as a forensic scientist with her personal memories of the bombings, the boundary between
                        evidence, interpretation, and fabrication starts to dissolve. Soon, doubt seeps in: would her
                        own forensic methods stand up to scrutiny?
                    </p>
                    <p class="mb-3">
                        The installation stages part of the onscreen crime lab, featuring a CRT monitor displaying the
                        film and an HD camcorder framing a live feed of the set. This recursive mise-en-scène invites
                        viewers to examine the act of witnessing and how it affects the construction of truth.
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
