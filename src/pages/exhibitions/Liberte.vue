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
        <div class="container mx-auto grid md:grid-cols-2 gap-6 px-3">
            <img
                v-lazy="{ src: '/images/liberte/micah-nomark.jpg' }"
                class="max-w-full w-auto h-auto mx-auto"
                alt="Collin Leitch: The Darling Maneuver. January 10th - February 14th, 2026"
            />
            <div id="press-release">
                <div class="grid md:grid-cols-2 grid-cols-1 gap-3 mb-6 mx-auto">
                    <div class="flex justify-between">
                        <div class="text-lg">
                            Micah Schippa-Wildfong<br />
                            <em>LIBERTÉ</em>
                        </div>
                    </div>
                    <div class="md:text-right text-left">
                        <a
                            href="/docs/liberte/schippa-wildfong-liberte-press-release.pdf"
                            class="block mb-3"
                            target="_blank"
                        >
                            PDF
                        </a>
                        February 21st &mdash; March 28th, 2026<br />
                        Opening: February 21st, 6PM &mdash; 9PM<br />
                        Hours: Wed - Sat, 1PM — 6PM
                    </div>
                </div>
                <div class="text-justify max-w-screen-sm mx-auto">
                    <p class="mb-3">
                        <em
                            >“What is the price of two sparrows—one copper coin? But not a single sparrow can fall to
                            the ground without your Father knowing it.”</em
                        >
                        —Matthew 10:29
                    </p>
                    <p class="mb-3">
                        <em
                            >“In my dream I am hiding in a basement full of doves in cages, waiting for the woman
                            upstairs, whom I do not know, to leave.”</em
                        >
                        —Micah Schippa-Wildfong
                    </p>
                    <ul class="list-disc ml-5 text-sm">
                        <li class="mb-2">
                            18th century experiments with electricity produced a technique that jolted dead tissue,
                            causing contractions and convulsions in the bodies it was applied to. Named “Galvanism” for
                            Luigi Galvani, who observed the phenomena early in frogs, his nephew would go on to
                            popularize the method, presenting the quivering cadavers of criminals to shocked audiences.
                        </li>
                        <li class="mb-2">
                            In <em>Abolishing Freedom</em>, a series of essays on free-will and fatalism, Frank Ruda
                            relays that “[Martin] Luther gave one of the most inhuman, charming definitions of the human
                            being as a piece of shit that fell out of God’s anus. Mankind has an excremental status. The
                            world is but a gigantic latrine. […] Against any trivializations of God’s decisions, against
                            any attempt to mine meaning out of them, Luther defends the knowledge that something
                            unknowable, unthinkable is at work in us.”
                        </li>
                        <li class="mb-2">
                            A stuttering <em>élan vital</em> drives the behemoth that is the American national body, a
                            Frankenstein corpse sutured of rotting industrial cores, hollowed-out small-towns and
                            hyper-capitalized data-centers; experts warn that the U.S. power grid, an infrastructure
                            over one-hundred years old, and riven by neglect, regulatory and investment failures, has
                            been pushed to the breaking point by the demands of new technologies and the climate crisis.
                        </li>
                        <li class="mb-2">
                            Franz Neumann’s <em>Behemoth</em>, a 1942 critical diagnostic of the Nazi regime, contrasted
                            the structure of the fascist state with that of Hobbes’ Leviathan. If the leviathan is a
                            centralized state governed by a domineering social contract, then the behemoth is a chaotic
                            association of cartels and power-brokers maintaining a shambolic zombie-state governed by
                            self-interest and irrationality.
                        </li>
                        <li class="mb-2">
                            Winters in the mid-west are now more frequently accompanied by bouts of polar vortexes,
                            large low-pressure air masses which transform the city into a bleak icy wasteland, crippling
                            infrastructure and threatening hypothermia. Temperatures may turn to such frigid extremes
                            that migrating birds freeze and fall from the sky.
                        </li>
                        <li>
                            Citing Freud’s allusion to Matthew 10:29, Ruda argues that the most trivial of excretions
                            inverts our sense of understanding, “[leading] to the insight that previously ephemeral
                            things akin to the sparrow falling from the roof (slips of the tongue and other parapraxes)
                            are no longer irrelevant objects for rationalist and scientific investigation. And they may
                            or, more precisely, will lead us to the core of human subjectivity.”
                        </li>
                    </ul>
                    <div class="mt-10">
                        <p class="italic mb-3">
                            <span class="font-bold">Micah Schippa-Wildfong</span> (b. 1988) is an American artist,
                            writer and musician living and working in Chicago. They have recently exhibited at
                            Salzburger Kunstverein (Salzburg), The Museum of Contemporary Art Chicago (Chicago), Romance
                            (Pittsburgh), Mickey (Chicago) and Pech (Vienna). They have upcoming exhibitions with Mutter
                            (Amsterdam) and DISPLAY (Parma) later this year.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
