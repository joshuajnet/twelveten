<script>
import { ref } from 'vue';
import GallerySlideshow from '../../components/GallerySlideshow.vue';
import slideshowData from '../../json/brainworms-slideshow.json';

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
        <div v-if="true == false">
            <GallerySlideshow :slides="slides" />
        </div>
        <div class="container mx-auto grid md:grid-cols-2 gap-6 px-3">
            <img src="/images/star-e-eyed/halpern-nomark-min.jpg" class="max-w-full w-auto h-auto mx-auto" />
            <div id="press-release">
                <div class="grid md:grid-cols-2 grid-cols-1 gap-3 mb-6">
                    <div class="flex justify-between">
                        <div class="text-lg font-roboto font-bold uppercase">
                            TALI HALPERN<br />
                            <span class="text-base">&#9733;E EYED</span>
                        </div>
                    </div>
                    <div class="md:text-right text-left">
                        <a
                            href="/docs/star-e-eyed/halpern-star-e-eyed-press-release.pdf"
                            class="block mb-3"
                            target="_blank"
                        >
                            PDF
                        </a>
                        September 28th &mdash; October 26th, 2024<br />
                        Opening: September 28th, 6PM &mdash; 9PM<br />
                        Artist Talk: October 5th, 4PM &mdash; 6PM<br />
                        Hours: Wed - Sat, 1PM &mdash; 6PM<br />
                    </div>
                </div>
                <div class="text-justify max-w-screen-sm mx-auto">
                    <p class="mb-3">
                        Twelve Ten Gallery is pleased to present new fiber works by Tali Halpern. For their debut solo
                        exhibition at the gallery, Halpern has created a new series that employs a wide range of
                        techniques in the fiber arts to explore themes of queer performance and the production of the
                        self in contemporary media.
                    </p>
                    <p class="mb-3">
                        Halpern works with a digital loom to weave tapestries drawn from their personal collection of
                        texts, images and drag inspired performances. Tronrud Engineering, manufacturer of the TC2,
                        presents its digital loom as “a tool that assists during the ‘Innovative or the Creative’ phase
                        of the making of the textile and is designed primarily for Sampling, Rapid Prototyping or
                        Product Development purposes.”
                    </p>
                    <p class="mb-3">
                        Nonetheless, a person is required to pilot the machine. Even as the machine constructs a pattern
                        from the designs the artist supplies, the body of the artist must adapt their movement to the
                        measure of the machine, where “every pixel is mapped to a thread in the fabric”. Interpenetrated
                        with the assemblage of this new post-industrial form of rapid prototyping, Halpern performs
                        multiple roles simultaneously: Fordist laborer, content creator and microcelebrity, vamping
                        their own image as the star.
                    </p>
                    <p class="mb-3">
                        Philosopher and writer Paul B. Precadio characterizes the contemporary economic condition as
                        “pharmacopornographic”, a world in which “the paradigmatic body of this model of production is
                        that of the migrating whore, the transgender sex worker, or the porn actress or actor.” Where
                        the reproductive, sexual and biological aspects of labor were once treated as mere
                        externalities, Precadio argues that the manipulation of affective and biological characteristics
                        at a molecular level are now central to the lubricated operation of the technocracy: you take a
                        little Ozempic or Adderall, or go to the gym and practice mindfulness, because in this world,
                        you have to be the <em>best you</em> to succeed.
                    </p>
                    <p class="mb-3">
                        Halpern incorporates found aphorisms and textual fragments into their work. Appropriated from a
                        variety of sources, including evangelical signage, online message-boards, and self-help
                        pamphlets, these phrases operate on multiple levels, oscillating between sincere affirmation and
                        ironic self-awareness. Much like how contemporary workers are encouraged to practice an ethic of
                        “self-care” as a palliative for the toxic affective conditions of their labor, Halpern is drawn
                        to expressions that seem to offer spiritual truths or guidance for circumstances whose real
                        conditions they may only symptomize.
                    </p>
                    <p class="mb-3">
                        It is in a hopeful ambiguity towards this found material that Halpern seeks to reclaim and
                        redirect their content towards a project of community. Lovingly bedazzled in a high camp kitsch
                        style, Halpern does not reject what they find, but insteads draws out what was already queer in
                        it, suggesting, like Precadio that, “I am not going to claim that I am like you [...] My
                        ambition is to convince you that you are like me. Tempted by the same chemical abuse. ”
                    </p>
                    <div class="mt-10">
                        <p class="italic">
                            <span class="font-bold">Tali Halpern</span> (b. 1994, Chicago, IL) lives and works in
                            Chicago. MFA Studio of the Art Institute, BFA Hampshire College. Their works have been
                            exhibited at Co-Prosperity (Chicago) and The Laundry Gallery (San Francisco) among others.
                            Tali’s work explores the complexities of queerness, sexuality, gender and its aesthetics
                            through weaving, painting, drawing, collage, artist sketchbooks, makeup, drag and
                            installation. Their practice is informed by collage and exploring the layers of
                            intersectionality in art, identity, and existence. They are a nonbinary Jewish artist,
                            raised Orthodox in East Lakeview, Chicago’s predominantly gay neighborhood. They have been a
                            part of the queer techno scene in Chicago for eight years, where they perform, document, and
                            display elaborate makeup looks. With this documentation and through the use of self
                            portraiture they explore drag and gender performativity.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
