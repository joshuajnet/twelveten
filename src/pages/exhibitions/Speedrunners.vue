<script>
import { ref } from 'vue';
import GallerySlideshow from '../../components/GallerySlideshow.vue';
import slideshowData from '../../json/speedrunners-slideshow.json';

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
            <img
                src="/images/speedrunners/speedrunners-flier.svg"
                class="max-w-full w-auto h-auto mx-auto"
            />
            <div id="press-release">
                <div class="flex justify-between">
                    <h2 class="text-3xl font-bold italic mb-3">Speedrunners</h2>
                    <a href="/docs/speedrunners/speedrunners-press-release.pdf" target="_blank">PDF</a>
                </div>
                <div class="grid md:grid-cols-2 grid-cols-1 gap-6 mb-6">
                    <div class="text-lg">
                        Isabelle Frances McGuire<br />
                        Ryan Nault<br />
                        Liz Vitlin<br />
                        Ellis &amp; Parker von Sternberg<br />
                    </div>
                    <div class="md:text-right text-left">
                        Sept. 29th &mdash; Nov. 11th, 2023<br />
                        Opening Sept. 29th, 6PM &mdash; 9PM<br />
                        Hours: Wed - Sat, 1PM &mdash; 6PM<br />
                    </div>
                </div>
                <div>
                    <p class="italic mb-3">
                        You have entered game space. We have allotted you certain functions in game space with limited
                        parameters. While you may use the jump button, we do not support climbing. Please note that
                        animated legs are not currently included as a part of your character model. Some distant
                        features of game space may appear intriguing to you and you may wish to engage with them. We
                        regret to inform you that these spaces are currently unavailable. Your character is not the
                        appropriate level and/or our budgetary constraints have prevented us from developing these
                        features as player supported arenas. They are only visible in the world to provide a sense of
                        immersion.
                    </p>
                    <p>
                        Speedrunning is a peculiar cultural phenomena to gaming, where the player attempts to complete
                        some aspects of a game’s challenges as swiftly as possible. Time optimization may be the goal of
                        speedrunning, but what makes the approach of speedrunners truly engaging is the way in which
                        they manipulate a game’s design to achieve this speed.
                    </p>
                    <p>
                        The game space is not only the canvas upon which a player acts, but a set of constraints or
                        rules which limit what a player may accomplish within its design. Speedrunning is distinct from
                        cheating, in the sense that the speedrunner is not trying to subvert the game’s rules or
                        introduce new supersessionary rules to the game. Success in a speedrun is not determined by
                        achieving victory on the game’s terms, but by how the player prefers some state space in the
                        game. For example: The speedrunner may choose to romance all romanceable NPCs (non-player
                        characters) within their run, rather than beating the game. The player is working within the
                        parameters of the code, but with aspects of it that were never explicitly or intentionally
                        understood in its very conception. They find a sense of positive freedom in choosing how they
                        position themselves against the structures of the game.
                    </p>
                    <p>
                        The speedrunner runs orthogonal to the game’s design, analogous to how an artist may find
                        themselves positioned against the constraints of their medium, the milieu of the artworld, or
                        society more broadly. While the full extent of these structures may not be known, they are not
                        unknowable, and it is in allowing oneself to be trapped in the play of the game that the artist
                        expresses a cunning intelligence.
                    </p>
                    <p>
                        Baudrillard famously made the statement that Disneyland existed only to convince us that
                        everything else that surrounded it was real. While his point was that the America which
                        surrounded Disneyland was no less of a fabrication, in the post-digital age, where it seems any
                        reality dreamed of may be manufactured and circulated as readily as any other, would it not be
                        the very material production of the representational order that is closest to the real? The
                        artists in this exhibition all engage in the discursive structure of this hyperreal state,
                        manipulating its rules of engagement as they find them through their own distinctive media and
                        methodology:
                    </p>
                    <p>
                        Isabelle Frances McGuire works with animatronics, a hybrid form of art and engineering, or
                        “Imagineering”, that Disney pioneered to craft a seamless vision for its theme park experiences.
                        The world of the Imagineer, like the world of a game, exists for the viewer, who is the central
                        premise of a world designed to wrap them in its illusion. McGuire gleefully inverts the
                        techniques of the Imagineer, baring the bones of its construction and making present the
                        Frankenstein amalgamation of cultural and technical detritus from which their magic is drawn.
                    </p>
                    <p>
                        Ryan Nault captures digital images of his engagement with the playgrounds of the ultrawealthy on
                        his phone, re-interpreting them into his own oblique and dreamlike allegories. Presented in a
                        uniform format, constrained to mimic the aspects of a screen, his transformation of the smuggled
                        image to panel provides a new means of taking ownership over a world that is not explicitly for
                        him, but that the role of the artist provides a unique portal into.
                    </p>
                    <p>
                        Liz Vitlin works from a digital archive retrieved from her childhood computer, investigating the
                        world of her lost self. As the child of Russian immigrants, coming of age at the “end of
                        history” and the explosion of a new suite of digital tools, Vitlin not only reconstructs her
                        personal history, but upscales and digitally enhances it. Vitlin deploys the special effects of
                        a future that her younger self and a collapsing empire could not have envisioned, generating
                        documents of the past in the present.
                    </p>
                    <p>
                        Ellis and Parker von Sternberg engage the gallery as a game space in its own right - a place
                        where its conventions might be perverted and made to demonstrate the social constructions
                        underlying its architecture. Among other works, they introduce a series of transgressive, but
                        nonetheless ambiguous found images whose establishment as works of art is only generated through
                        the labor and creative choices of the framer solicited to make the works presentable for the
                        gallery.
                    </p>
                    <p class="italic text-lg">Press any button to start.</p>
                </div>
            </div>
        </div>
    </div>
</template>
