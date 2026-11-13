<script>
import { ref } from 'vue';
import GallerySlideshow from '../../components/GallerySlideshow.vue';
import slideshowData from '../../json/coldbomb-slideshow.json';

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
            <img src="/images/coldbomb/loebs-nomark2.jpg" class="max-w-full w-auto h-auto mx-auto" />
            <div id="press-release">
                <div class="grid md:grid-cols-2 grid-cols-1 gap-3 mb-6">
                    <div class="flex justify-between">
                        <div class="text-lg font-roboto font-bold">
                            Jason Loebs<br />
                            <span class="text-base">COLDBOMB</span>
                        </div>
                    </div>
                    <div class="md:text-right text-left">
                        <a href="/docs/coldbomb/coldbomb-press-release.pdf" class="block mb-3" target="_blank"> PDF </a>
                        November 9th &mdash; December 21st, 2024<br />
                        Opening: November 9th, 6PM &mdash; 9PM<br />
                        Hours: Wed - Sat, 1PM &mdash; 6PM<br />
                    </div>
                </div>
                <div class="text-justify max-w-screen-sm mx-auto">
                    <p class="mb-3">
                        Yoke the world in a circle. The circle on its axis becomes a line, a cut, a basis from which all
                        other measures may be drawn. Set the circle at an observatory in Greenwich and impose the law of
                        the clock.
                    </p>
                    <p class="mb-3">
                        The prime meridian. An executive COUP. The declaration &amp; regulation of the degree 0. A cold
                        measure.
                    </p>
                    <p class="mb-3">
                        “Try to do the following: say ‘It’s cold here’, and mean ‘It’s warm here’. Can you do it? – And
                        what are you doing as you do it? And is there only one way of doing it?” [1]
                    </p>
                    <p class="mb-3">
                        Sense &amp; reference. There are many ways to capture Venus. Hesperus &amp; Phosphorus. What
                        does it mean to say that the evening star is Lucifer?
                    </p>
                    <p class="mb-3">A thought expressed by a bright disc.</p>
                    <p class="mb-3">A COIN flip.</p>
                    <p class="mb-3">
                        Fact: Heads.<br />
                        Fact: Tails.<br />
                        Fact: It stands on an edge.
                    </p>
                    <p class="mb-3">Observe the morning star.</p>
                    <p class="mb-3">An eclipse, by what swerve of the atom?</p>
                    <p class="mb-3">
                        <em>&mdash; Joshua Johnson, October 2024</em>
                    </p>
                    <ul class="ml-6 text-xs list-decimal">
                        <li>
                            Wittgenstein, Ludwig (2009) "Philosophical Investigations, 4th edition (trans. Hacker and
                            Schulte)". Wiley-Blackwell, p. 148, §510
                        </li>
                    </ul>
                    <div class="mt-10">
                        <p class="italic">
                            <span class="font-bold">Jason Loebs</span> lives and works in New York. He attended the
                            Whitney Independent Study Program in 2011, received his MFA from the School of the Art
                            Institute of Chicago in 2007, and a certificate from the Pennsylvania Academy of the Fine
                            Arts in 2004. Recent solo exhibitions include Kangaroo Stele, Éclair, Berlin; Stele Trail,
                            Ludlow 38, New York; Private Matters, Maxwell Graham / Essex Street, New York; and TITLE
                            STACK SINK RELEASE, Kunsthalle Fribourg, Fribourg.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
