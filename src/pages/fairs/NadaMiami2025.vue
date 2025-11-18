<script>
import { ref } from 'vue';
import GallerySlideshow from '../../components/GallerySlideshow.vue';
import slideshowData from '../../json/terror-element-slideshow.json';

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
            <GallerySlideshow :slides="slides" :worksAvailable="false" />
        </div>
        <div class="container max-w-screen-sm mx-auto grid md:grid-cols-1 gap-6 px-3">
            <div id="press-release">
                <div class="grid md:grid-cols-2 grid-cols-1 gap-3 mb-6 mx-auto">
                    <div class="flex justify-between">
                        <div class="text-lg">
                            <strong>Tali Halpern</strong><br />
                            <em>NADA Miami 2025</em>
                        </div>
                    </div>
                    <div class="md:text-right text-left">
                        <a
                            v-if="true === false"
                            href="/docs/terror-element/terror-element-press-release.pdf"
                            class="block mb-3"
                            target="_blank"
                        >
                            PDF
                        </a>
                        December 2nd &mdash; 6th, 2025<br />
                        Ice Palace Studios, 1400 North Miami Avenue<br />
                    </div>
                </div>
                <div class="text-justify max-w-screen-sm mx-auto">
                    <p class="mb-3">
                        For their participation in NADA Miami Projects Tali Halpern will present a focused series of
                        woven self-portraits that explore the tension between historical forms of image-making and the
                        digital conditions of contemporary self-representation.
                    </p>
                    <img src="/images/star-e-eyed/halpern-loved-detail.jpg" class="max-w-full w-auto h-auto mx-auto" />

                    <p class="font-roboto text-xs text-center mt-2">
                        Tali Halpern, <em>loved then cast aside</em>, 2024.<br />
                        Handwoven fabrics on a TC2, cotton, wool, thread, grommets and rhinestones (detail).
                    </p>
                    <p class="mb-3">
                        Halpern’s process, translating pixel-based imagery into thread via a digital Jacquard loom,
                        engages both traditional fiber craft and post-industrial production. The resulting works are
                        both material and conceptual hybrids: slow to make, yet drawn from the accelerated rhythms of
                        internet culture.
                    </p>
                    <p class="mb-3">
                        Working at the intersection of fiber, performance, and digital media, Halpern uses a
                        computerized loom to weave tapestries sourced from their archive of texts, selfies, and
                        performances. Their work resonates with feminist and queer legacies, invoking artists like
                        Miriam Schapiro, Cindy Sherman and Tracey Emin while also drawing from drag, meme culture, and
                        theories of gender performativity.
                    </p>
                    <p>
                        Halpern embraces mutable roles as both saint and seducer, merging sacred imagery with the
                        self-conscious gaze of digital culture. Their work navigates the performance of microcelebrity,
                        blending pop iconography with intimate acts of self-fashioning to create a texture of soft
                        glamour and digital nostalgia. Through collage and fragmentation, they explore the unstable
                        terrain of subjectification in a world that insists on clear boundaries and binary legibility.
                    </p>
                    <p class="mb-3" s>
                        Halpern’s practice threads together queer embodiment, textile history, and the aesthetics of
                        internet performance, offering a critical, and deeply personal, response to how the self is
                        constructed and consumed today.
                    </p>
                    <div class="mt-10">
                        <p class="italic mb-3">
                            <span class="font-bold">Tali Halpern</span> (b. 1994, Chicago, IL) lives and works in
                            Chicago. MFA Studio of the Art Institute, BFA Hampshire College. Their works have been
                            exhibited at Twelve Ten Gallery (Chicago), BravinLee (New York), and de boer (Los Angeles)
                            among others. Tali’s work explores the complexities of queerness, sexuality, gender and its
                            aesthetics through weaving, painting, drawing, collage, artist sketchbooks, makeup, drag and
                            installation. Their practice is informed by collage and exploring the layers of
                            intersectionality in art, identity, and existence.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
