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
                            href="/docs/nada-miami-2025/tali-halpern-nada-miami-preview.pdf"
                            class="block mb-3"
                            target="_blank"
                        >
                            Preview PDF
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
                    <img
                        src="/images/nada-miami-2025/TALI_HALPERN_NADA-11.jpg"
                        class="max-w-full w-auto h-auto mx-auto"
                    />

                    <p class="font-roboto text-xs text-center mt-2">
                        Tali Halpern, <em>teenage apocalypse 2</em>, 2025.<br />
                        Handwoven fabrics, cotton, wool, silk, bleach, rhinestone, beads (detail).
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
                            Chicago. Tali’s work explores the complexities of queerness, sexuality, desirability,
                            gender, and its aesthetics as well as topics surrounding addiction and recovery through a
                            mixed media fiber practice. Their work is informed by collage, exploring the layers of
                            intersectionality in art, identity, spirituality and existence. Fiber is a soft medium in
                            contrast with the often challenging themes in their work. Neither static nor flat, they are
                            tactile and in direct relationship to the body. They use self-portraiture as witness to
                            flesh, feelings, addictions, traumas, growth, and joy. Then through collage, they piece and
                            mend the broken, unite the solitary, and combine completely different facets into one, in an
                            attempt to heal. In sharing work about vulnerabilities, often deemed taboo and shameful by
                            society, they reject shame while offering solace and connection to viewers alienated by
                            similar struggles. Their works have been exhibited at Twelve Ten Gallery (Chicago), Tiger
                            Strikes Asteroid (Chicago) and de boer (Los Angeles), among others. MFA School of the Art
                            Institute of Chicago, BFA Hampshire College.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
