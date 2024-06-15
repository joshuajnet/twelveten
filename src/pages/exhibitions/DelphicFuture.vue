<script>
import { ref } from 'vue';
import VideoEmbed from '../../components/VideoEmbed.vue';
import GallerySlideshow from '../../components/GallerySlideshow.vue';
import slideshowData from '../../json/delphicfuture-slideshow.json';

export default {
    components: {
        VideoEmbed,
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
            <GallerySlideshow :slides="slides" />
        </div>
        <div class="container mx-auto grid md:grid-cols-2 gap-6 px-3">
            <div>
                <img
                    src="/images/delphic-future/delphic-future-nomark-min2.png"
                    class="max-w-full w-auto h-auto mx-auto mb-6"
                />
                <VideoEmbed embedCode="XaswpDf-jMI" />
                <p class="text-sm"><em>Map of the Bomb</em> premiere trailer.</p>
            </div>
            <div id="press-release">
                <div class="grid md:grid-cols-2 grid-cols-1 gap-6 mb-6">
                    <div class="flex justify-between">
                        <div class="text-lg mb-3 font-roboto font-extrabold uppercase">
                            Amanda Beech<br />
                            Delphic Future
                        </div>
                        <div class="text-right">
                            <a
                                href="/docs/delphic-future/delphic-future-press-release.pdf"
                                class="md:hidden ml-auto block"
                                target="_blank"
                                >PDF</a>
                            <a
                            href="/documents/beech-von-sternberg-interview"
                            class="md:hidden ml-auto block"
                            target="_blank"
                            >In Conversation</a>
                        </div>
                    </div>
                    <div class="md:text-right text-left">
                        <a
                            href="/docs/delphic-future/delphic-future-press-release.pdf"
                            class="md:block hidden"
                            target="_blank"
                            >PDF</a
                        >
                        <a
                            href="/documents/beech-von-sternberg-interview"
                            class="md:block hidden mb-6"
                            target="_blank"
                            >In Conversation</a
                        >
                        Feb. 4th &mdash; Mar. 23rd, 2024<br />
                        Opening Feb. 4th, 5PM &mdash; 8PM<br />
                        <em>Map of the Bomb</em> Premiere Feb. 6th, 7PM &mdash; 9PM<br />
                        Hours: Wed - Sat, 1PM &mdash; 6PM<br />
                    </div>
                </div>
                <div>
                    <p class="mb-3">
                        Twelve Ten Gallery is pleased to present new paintings and drawings by Amanda Beech, accompanied
                        by an installation of the video work <em>Covenant Transport Move or Die</em> (2015) and a
                        special one-night US premiere of her 2022 film <em>Map of the Bomb</em> (commissioned by
                        Fieldwork Marfa) at the
                        <a href="https://www.musicboxtheatre.com/" target="_blank">Music Box Theatre</a>.
                    </p>
                    <p>These works ask: what does it mean to determine the future?</p>
                    <p>
                        We could think of “determine” in two senses here: the causal and the descriptive. Beech is
                        concerned with both senses. She rejects the predominant trajectory of contemporary art in favor
                        of a renewed rationalism and diagnoses contemporary art with practicing a "pseudo-critical
                        irrationalism" that sees the critical gesture as an end-in-itself. The artworld's ubiquitous
                        deployment of this gesture, however, is without any determinate political content that could
                        offer an alternative means of overcoming systems of domination (capitalism being an exemplar).
                        If we are to truly regard art as having some purchase on the world, we must take art seriously
                        as both a technique for producing knowledge about the world and as a means of generating a new
                        world.
                    </p>
                    <p>
                        Her work has engaged this problem in all forms of media, but consistently concentrates on how
                        images, stories and narratives construct a systemic reality that we often and erroneously
                        mythologize as inchoate material. Her videos generate cultic pop-fiction involving the work of
                        Ayn Rand and Dashiel Hammett, alongside US trash consumerism, Tony Scott's vampire movie
                        <em>The Hunger</em>, and inventions of parallel sci-fi realities that are more “real” than the
                        world we experience. <em>Covenant Transport Move or Die</em> focuses on the fetishization of
                        mobility in contemporary culture and its violence, and Map of the Bomb offers a dissonant
                        subterranean neo-noir reality episodic fiction that touches the explosive subject of "reality in
                        itself".
                    </p>
                    <p>
                        Beech's new works on paper enmesh systems of divergent techno-naturalisms, collapsing industrial
                        installations and rampant entropic overgrowth in a cosmological machine that objectifies the
                        dream of “infinite possibility”. These works merge print, paint and ink, layering vertiginous
                        natures that often compel us to decipher structures as if they are hidden when in fact they are
                        explicit. Inspiration for this new series comes from the medieval philosopher Ramon Llull, who
                        developed a rudimentary algorithmic procedure which operated over an iterative and combinatorial
                        process called the Ars (art). The Ars was composed of sets of abstracted symbols and was
                        illustrated by a series of intricate circular diagrams and tables, with instructions that
                        indicated the rules for querying the system. Significantly, Llull saw this system as rectifying a
                        major deficit in the practices of Scholasticism, which could only elucidate given syllogisms.
                        The Ars, however, could be used not only to identify truths but also to construct new
                        propositions.
                    </p>
                    <p>
                        Llull's diagrammatic machines surface in Beech's work in several guises: as both imagery in her
                        works on paper and as a method for determining the course of her new film <em>Map of the Bomb</em>. Not
                        only is Llull's invention the lever for this work, but also the book <em>Plotto</em>, written by the dime
                        store author William Wallace Cook in the 1920's. Cook's method became an influential device for
                        genre fiction and films, and Alfred Hitchcock, among many others, was known to use it. For
                        Beech, it is not just the creative impetus that these logics offer, but the formal, ideological
                        and methodological constraints through which they are structured, indicating not just the all
                        too clear problem of claims to objectivity, but more crucially, to argue that creativity need
                        not be divorced from rationality. It is in the development of such methodological devices that
                        art gains purchase on the world as a technique.
                    </p>
                    <p>
                        With this in mind, Beech is keenly aware that the use of these devices is not transparent; for
                        in deciphering the world, we do more than reveal its secrets, we also add to the complexity of
                        the world. The Janus-faced nature of our "determine" asserts its full consequences: new
                        information ramifies the site of investigation, changing its trajectory and manifesting a new
                        future. The devices Beech has sketched into her works are not just decrypting the world, but
                        they are also a part of it, and as they work to overtake nature the entropy they generate leads
                        nature to overtake them: the oracle creates its own future.
                    </p>
                </div>
                <div class="mt-10">
                    <p class="italic"><span class="font-bold">Amanda Beech</span> is an artist and writer. Her work entangles narratives of power, cause and contingency from philosophical theory, science, literature and real political events. Here the  material conditions of thought, myth and fiction that seem necessary for an account of human agency are explored as forms of ideological and rhetorical force. In video, painting, print and sculpture her work proposes art as a form of intelligence and power beyond the ideals of capitalism and the limits that art has set for itself by means of its critiques.</p>
                    <p class="italic">She has exhibited widely in various Biennales and has written texts for anthologies and museum catalogs. She has edited and contributed to numerous books including <span class="font-bold">Construction Site for Possible Worlds</span>, 2019, Urbanomic/MIT Press and <span class="font-bold">Cold War, Cold World</span>, Urbanomic, 2015. Her recent writing includes an essay on Jean Francois Lyotard’s exhibition "Les Immateriaux for Beyond Matter", ZKM, Karlsruhe. Forthcoming work includes a new book on art, aesthetics and philosophy; <span class="font-bold">The Intolerable Image</span>, from MIT. </p>
                </div>
            </div>
        </div>
    </div>
</template>
