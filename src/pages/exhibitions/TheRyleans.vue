<script>
import { ref } from 'vue';
import GallerySlideshow from '../../components/GallerySlideshow.vue';
import slideshowData from '../../json/ryleans-slideshow.json';

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
            <GallerySlideshow :slides="slides" :worksAvailable="true" />
        </div>
        <div class="container mx-auto grid md:grid-cols-2 gap-6 px-3">
            <img src="/images/ryleans/ryleans-flier-nomark.jpg" class="max-w-full w-auto h-auto mx-auto" />
            <div id="press-release">
                <div class="grid md:grid-cols-2 grid-cols-1 gap-3 mb-6">
                    <div class="flex justify-between">
                        <div class="text-base">
                            <div class="text-lg italic font-bold">The Ryleans</div>
                            Noelle Africh<br />
                            Ellis &amp; Parker von Sternberg<br />
                            Jonathan Worcester<br />
                            Ziyi Zhang
                        </div>
                    </div>
                    <div class="md:text-right text-left">
                        <a href="/docs/ryleans/ryleans-press-release.pdf" class="block mb-3" target="_blank"> PDF </a>
                        February 15th &mdash; March 29th, 2025<br />
                        Opening: February 15th, 6PM &mdash; 9PM<br />
                        Hours: Wed - Sat, 1PM &mdash; 6PM<br />
                    </div>
                </div>
                <div class="text-justify max-w-screen-sm mx-auto">
                    <p class="mb-3">
                        Twelve Ten Gallery is pleased to present “The Ryleans” featuring work by Noelle Africh, Ellis
                        &amp; Parker von Sternberg, Jonathan Worcester and Ziyi Zhang.
                    </p>
                    <p class="mb-3">
                        The American analytic philosopher Wilfrid Sellars proposed a mythical community of people who
                        have no concept of internal mental states, but all the expressive capacities of a public
                        language. Sellars dubbed this community “Ryleans” in honor of the behaviorist philosopher
                        Gilbert Ryle. In this thought experiment, the Ryleans are only able to explain what is most
                        overtly discernible in an individual’s actions and lack the means to account for behaviors that
                        are not reducible to observation alone.
                    </p>
                    <p class="mb-3">
                        Consider an encounter with the work of art. This encounter produces an impression that may
                        trigger a host of emotional and intellectual responses, but how could the Ryleans explain these
                        complex processes? As Sellars asks, "What resources would have to be added to the Rylean
                        language of these talking animals in order that they might come to recognize each other and
                        themselves as animals that think, observe, and have feelings and sensations, as we use these
                        terms?” (EPM, 179)
                    </p>
                    <p class="mb-3">
                        At this point, Sellars furnishes his tale with a local genius, Jones, who hypothesizes
                        speech-like episodes, or “thoughts” that are similar to the role that statements play in public
                        declarations, but exist only in the mind of the individual conceiving of them. Armed with this
                        new theory of “thought” episodes, the Ryleans may go on to develop a variety of theoretical
                        models for private behaviors that further extend the thought/speech analogy and develop a rich
                        psychology illuminating a variety of mental states.
                    </p>
                    <p class="mb-3">
                        Sellars’ myth inverts our common understanding that sense-impressions have priority over
                        theoretical entities, because it illustrates a condition where public language is prior to
                        individual experience. We are habituated to believe that our inner mental experiences are
                        privileged in some manner because they seem to be closest to our immediate experience. Yet, it
                        is precisely these experiences, he argues, that are already intersubjectively conditioned, for
                        we would not be able to report on them if we could not conceptualize them.
                    </p>
                    <p class="mb-3">
                        Art is often considered to have a privileged relationship to knowledge, in that the immediacy of
                        the encounter with the work of art acts as a catalyst to knowing in some direct manner. But
                        perhaps what appears most immediate in the work of art is already mediated in the most
                        mysterious manner. This exhibition, “The Ryleans”, offers a selection of works by artists whose
                        practices tarry at the boundaries between the immediate and the conceptual, teasing at where one
                        is concealed by the other.
                    </p>
                    <div class="mt-10">
                        <p class="italic">
                            <span class="font-bold">Noelle Africh</span> (b. 1992 Chicago, IL) lives and works in
                            Chicago, IL. They received an MFA in Painting and Drawing from The School of the Art
                            Institute of Chicago and a Bachelor of Science degree in Mathematics from the University of
                            Illinois in Urbana-Champaign. Their work has been exhibited at Slow Dance (Chicago, IL),
                            Galerie Gisela Clement (Bonn, Germany), RUSCHWOMAN (Chicago, IL), Hyde Park Art Center
                            (Chicago, IL), Stasias Gallery (Chicago, IL), The Plan (Chicago, IL), SHED Projects
                            (Cleveland, OH), The Green Gallery - West (Milwaukee, WI), Switch-Hook Projects (Chicago,
                            IL), Patient Info (Chicago, IL), among others.
                        </p>
                        <p class="italic">
                            <span class="font-bold">Ellis &amp; Parker von Sternberg</span> (b. 1990 &amp; 1988) are an
                            artist duo based between New York, NY, and Minneapolis, MN. Previous solo exhibitions
                            include King's Leap (New York, NY) and Basel Social Club (Basel, CH). Selected group
                            exhibitions include Twelve Ten (Chicago, IL), Freddy (Harris, NY), Gallery Albany (Albany,
                            NY), New York Chain Suitcase, Brussels Show (Brussels, BE), and Triest (Brooklyn, NY). Ellis
                            von Sternberg received his BFA from the School of the Art Institute of Chicago. Parker von
                            Sternberg is licensed to practice law in Minnesota and received his degree from the
                            University of Minnesota.
                        </p>
                        <p class="italic">
                            <span class="font-bold">Jonathan Worcester</span> lives and works in Chicago, IL. He
                            received his MFA in Painting and Drawing from the School of the Art Institute of Chicago in
                            2024, and a BA from Sarah Lawrence College in 2015. He has a forthcoming solo exhibition at
                            65 Grand (Chicago, IL), and has previously exhibited at Cleaner Gallery (Chicago, IL),
                            Weatherproof (Chicago, IL), Old Friends Gallery (Chicago, IL), Circle Contemporary North
                            Shore (Glenview, IL), The Plan (Chicago, IL), among many others
                        </p>
                        <p class="italic">
                            <span class="font-bold">Ziyi Zhang</span> is a cross-disciplinary project artist based in
                            Chicago, IL. She holds a BFA with a minor in philosophy from Washington University in St.
                            Louis (2021) and an MFA in painting from the School of the Art Institute of Chicago (2023).
                            Her work has been featured in Digital America, Floorr Magazine, Visual Atelier 8, etc, and
                            exhibited at Plexus Projects (virtual), The Wrong Biennale (virtual), among others.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
