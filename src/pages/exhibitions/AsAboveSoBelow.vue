<script>
import { ref } from 'vue';
import GallerySlideshow from '../../components/GallerySlideshow.vue';
import slideshowData from '../../json/star-e-eyed-slideshow.json';

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
            <img src="/images/as-above-so-below/trey-flier-nomark.jpg" class="max-w-full w-auto h-auto mx-auto" />
            <div id="press-release">
                <div class="grid md:grid-cols-2 grid-cols-1 gap-3 mb-6 mx-auto">
                    <div class="flex justify-between">
                        <div class="text-lg font-bold">
                            Trey Rozell<br />
                            <span class="text-base">As above, so below</span>
                        </div>
                    </div>
                    <div class="md:text-right text-left">
                        <a
                            href="/docs/as-above-so-below/trey-rozell-press-release.pdf"
                            class="block mb-3"
                            target="_blank"
                        >
                            PDF
                        </a>
                        April 12th &mdash; May 24th, 2025<br />
                        Opening: April 12th, 6PM &mdash; 9PM<br />
                        Artist Talk: April 25th, 6PM &mdash; 8PM<br />
                        Hours: Wed - Sat, 1PM &mdash; 6PM<br />
                    </div>
                </div>
                <div class="text-justify max-w-screen-sm mx-auto">
                    <p class="italic">
                        The work is always limited in time as well as in space. By forgetting (purposefully) these
                        essential facts one can pretend that there exists an immortal art, an eternal work … And one can
                        see how this concept and the mechanism used to produce it–among other things the function of the
                        Museum as we have very rapidly examined it–place the work of art once and for all above all
                        classes and ideologies. The same idealism also points to the eternal and apolitical Man which
                        the prevalent bourgeois ideology would like us to believe in and preserve.
                    </p>
                    <p class="mb-6 ml-6">&mdash; Daniel Buren, “Function of the Museum”, 1970</p>
                    <p class="mb-3">
                        Twelve Ten Gallery is pleased to present “As above, so below”, an installation of new work by
                        Trey Rozell.
                    </p>
                    <p class="mb-3">
                        Rozell’s first solo exhibition with the gallery consists of an installation of fifty-two works
                        on canvas. These works have been constructed in pairs: one half of the pair is a monochrome
                        cerulean blue canvas, while its twin is embellished with the artist’s signature pattern. At any
                        one time, twenty-six of these works will be present in a salon-style hanging covering the
                        entirety of the gallery’s largest wall, while the other half will be presented as a sculptural
                        assemblage of stacked works on the floor. The exhibition will start with a complete hanging of
                        the monochromatic half of the paired works, and transition throughout the duration of the
                        exhibition into a state where only the patterned works are present on the wall and all of the
                        monochromatic works are on the floor.
                    </p>
                    <p class="mb-3">
                        Rozell is interested in the medium of painting as a structural category whose terms are
                        exchangeable as within a game. It is no accident that the number of works is indexed to the
                        number of cards within a standard deck. Rozell’s installation operationalizes this condition,
                        playing the suites as they shift hands from painting to sculpture to performance. This process
                        of exchange is not just a mere formal play, but a recognition of the material movement of the
                        work of art from its presentational aspect to its inert status as standing reserve -- ready to
                        be deployed as commodity or shuffled into mere inventory.
                    </p>
                    <p class="mb-3">
                        The question of figure and ground also becomes acute in Rozell’s work as the viewer attends to
                        the artist’s use of the patterned canvases that slowly proliferate the main wall. If the
                        monochromatic works call attention to the context outside of the frame, the works with Rozell’s
                        irregular shapes begin to develop a more traditional pictorial field. Recalling cartoon clouds
                        or flowers, Rozell troubles not only the iconographic ambiguities, but also their cultural
                        lexicon: are these the expressive marks of authorship in the romantic-auratic sense, or
                        imitations of the mechanical processes of reproduction that mark pop art?
                    </p>
                    <p class="mb-3">
                        The exhibition title, “As above, so below” derives from an eighth-century hermetic alchemical
                        text, and poses a structural correspondence between the microcosm and macrocosm. Marx would
                        later develop an analogous co-determination between the “base” and "superstructure”, or the
                        material composition of labor and its cultural/ideological relations. The Marxist theorist
                        Althusser coined the phrase “in the last instance” to denote the idea that the superstructure of
                        society was determined by the economic base. What image, “in the last instance”, will remain
                        when the last hand is dealt?
                    </p>
                    <div class="mt-10">
                        <p class="italic">
                            <span class="font-bold">Trey Rozell</span> (b. 1996) is an artist from the American South
                            who is currently living and working out of Chicago, IL. His practice is firmly rooted in
                            painting, but extends into sculpture, performance, installation, and animation. His work is
                            made considering the perpetuated structures embedded within the history of painting, Trey
                            utilizes absurdity, repetition, and gamesmanship as a means of inquiry into these age-old
                            subjects with the hope to observe how the rhetoric of painting continues to survive and
                            evolve today. Trey has had work exhibited at Twelve Ten Gallery (Chicago, IL), The Atlanta
                            Contemporary Art Center (Atlanta, GA), The End Project Space (Atlanta, GA), Ruschman
                            (Chicago, IL), The Ionian Center for the Arts and Culture (Kefalonia, GD) and recently
                            received his MFA in painting from the School of the Art Institute of Chicago.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
