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
        <div>
            <GallerySlideshow :slides="slides" />
        </div>
        <div class="container mx-auto grid md:grid-cols-2 gap-6 px-3">
            <img src="/images/brain-worms/brain-worms-nomark-min.png" class="max-w-full w-auto h-auto mx-auto" />
            <div id="press-release">
                <div class="grid md:grid-cols-2 grid-cols-1 gap-3 mb-6">
                    <div class="flex justify-between">
                        <div>
                            <div class="text-lg mb-1 font-bold">
                                Pieter Schoolwerth<br />
                                Keith Tilford
                            </div>
                            <span class="font-creepster text-2xl">Brain Worms</span><br />
                        </div>
                    </div>
                    <div class="md:text-right text-left">
                        <a href="/docs/brain-worms/brain-worms-release.pdf" class="block mb-3" target="_blank">PDF</a>
                        June 8th &mdash; July 27th, 2024<br />
                        Opening: June 8th, 6PM &mdash; 9PM<br />
                        Hours: Wed - Sat, 1PM &mdash; 6PM<br />
                    </div>
                </div>
                <div class="text-justify max-w-screen-sm mx-auto">
                    <p class="mb-3">
                        Twelve Ten Gallery is pleased to present work by Pieter Schoolwerth and Keith Tilford.
                    </p>
                    <p>
                        In the cult film “Brain Damage” (1988), director Frank Henenlotter introduces a loquacious,
                        brain eating parasite, called Aylmer, that looks like a cross between a penis and a fluke worm.
                        Aylmer attaches himself to Brian (Rick Hearst), whom he seduces with his honeyed tongue and the
                        addictive properties of a psychoactive chemical called “juice” that he injects into Brian’s
                        brain stem.
                    </p>
                    <p>
                        Philosopher Michel Serres identified the parasite as an agent of exchange: “The parasite invents
                        something new. Since he does not eat like everyone else, he builds a new logic. He crosses the
                        exchange, makes it into a diagonal. He does not barter; he exchanges money. He wants to give his
                        voice for matter, (hot) air for solid, superstructure for infrastructure.” What is the new thing
                        that the parasite invents? Serres tells us that “He invents cybernetics.” Aylmer pilots Brian
                        like an automaton as he exchanges juice for brains.
                    </p>
                    <p>
                        Schoolwerth’s paintings appropriate a variety of computer generated models as raw material for
                        their imagery. Sourcing these models from online marketplaces, he implicates the work in the
                        anonymous transactional flows of transnational cyber capital. Accompanying the paintings are a
                        series of videos that Schoolwerth created in collaboration with animator Phil Vanderhyden and
                        sound designer Aaron Dilloway. Disturbing and humorous in equal measure, the bodies in these
                        works twitch and jerk unnaturally as if puppeteered by a malign influence. Situated as both
                        subjects and objects of a process of rapid production and instant consumption, these virtual
                        avatars are animated by global forces of exchange beyond their immediate ken or control.
                    </p>
                    <p>
                        Tilford presents a digitally printed mural of AI generated images, which is overlaid with a
                        series of hand-executed drawings. His drawings serve as the base material fed into generative
                        models, producing artifactual renderings that appear to be ripped from sci-fi blockbusters. His
                        arrangement of these images recall the layout of comic pages or the taxonomic displays of
                        natural history museums, as if indexing weird species discovered on strange excursions.
                        Tilford’s drawings themselves abstract from the commercial illustration techniques of comics,
                        but it is precisely this vernacular of illustration from which the tech-industry uses AI to
                        extract surplus value. Tilford makes us question which is predator, prey or parasite as man and
                        machine seek to consume one another in a contest of pattern recognition.
                    </p>
                    <p>
                        In Schoolwerth and Tilford’s works we get the sense that there remains the intervention of a
                        particularly human craft, or craftiness, that is transformed by the parasitic exchange of
                        capital’s accelerating creative destruction and cybernetic reinvention of human labor.
                    </p>
                    <p>
                        Schoolwerth continues to investigate the dichotomies between painting/not-painting and
                        abstraction/representation. His work folds the logic of these oppositions back into itself
                        through a complex series of technical operations. Having experimented with tracings, sculpture
                        and relief, printing, and paint itself, digital media has become increasingly important to
                        Schoolwerth as the territories of his practice widen. Nonetheless, he has maintained a
                        dedication to painting, even as his engagement with new techniques and digital tools has
                        “expanded the field”.
                    </p>
                    <p>
                        Tilford’s work is rooted in the tradition of comics, a relatively recent artform that he
                        recognizes as having developed its own parallel genealogy to modernism and abstraction. Largely
                        ignored or dismissed by art history, the comics medium contains a rich synthesis of language and
                        the visual arts which makes it difficult to classify according to more traditional historical
                        narratives, but uniquely positioned to investigate the processes of artificial image generation
                        and how it reconfigures our understanding of the imagination.
                    </p>
                    <p>
                        At the end of “Brain Damage” Brian tries to quit Aylmer, only to be told by the parasite that
                        his brain chemistry has altered irrevocably and he will never be able to live without him.
                        Unable to overcome his addiction, Brian is injected with a massive overdose of juice. Rather
                        than killing him, however, Brian’s skull cracks open, revealing a glowing window. As the camera
                        zooms out, waves of light crackle from Brian’s head as we are presented with this new,
                        transcendent manifestation of his relationship to the parasite.
                    </p>
                    <div class="mt-10">
                        <p class="italic">
                            <span class="font-bold">Pieter Schoolwerth</span> (b. 1970, lives and works in Brooklyn, New
                            York) works in a multitude of mediums including painting, sculpture, installation, and
                            video. Since graduating from the California Institute of the Arts in 1994, Schoolwerth has
                            exhibited nationally and internationally with notable solo shows at Thread Waxing Space, New
                            York; Greene Naftali, New York; Grand Palais, Paris; Miguel Abreu Gallery, New York; What
                            Pipeline, Detroit; Capitain Petzel, Berlin; Kraupa-Tuskany Zeidler, Berlin and Petzel, New
                            York. His work has been included in group exhibitions at The Museum of Modern Art, New York;
                            The Whitney Museum of American Art, New York; Centre Pompidou, Paris; The Aldrich Museum of
                            Contemporary Art, Ridgefield; The Institute of Contemporary Art, Boston; Sadie Coles, London
                            among others. From 2003–2013 Schoolwerth ran Wierd Records (http://www.wierdrecords.com) and
                            the Wierd Party in the Lower East Side of NYC, releasing music by 46 bands and producing
                            over 500 live music, DJ, and performance art events.
                        </p>
                        <p class="italic">
                            <span class="font-bold">Keith Tilford</span> (b. 1978) is an artist and writer based in
                            Brooklyn, NY. He illustrated the graphic novel Chronosis (Urbanomic, 2022) co-created with
                            Robin MacKay and Reza Negarestani. Tilford has been an instructor for Foreign Objekt's
                            Intelligence/Computation Lab and a Visiting Tutor for Dutch Art Institute. Recent essays
                            include “Grand Theft Autoencoder” (2024), “Performing Creativity: Text to Image Synthesis
                            and the Mimicry of Artistic Subjectivity” (2023), and “Diagramming Horizons Between Art,
                            Technē, and the Artifactual Elaboration of Mind”.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
