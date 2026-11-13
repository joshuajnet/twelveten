<script>
import { ref } from 'vue';
import GallerySlideshow from '../../components/GallerySlideshow.vue';
import slideshowData from '../../json/veil-slideshow.json';

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
            <img src="/images/veil/veil-1-nomark-min.png" class="max-w-full w-auto h-auto mx-auto" />
            <div id="press-release">
                <div class="grid md:grid-cols-2 grid-cols-1 gap-6 mb-6">
                    <div>
                        <div class="text-lg mb-3 font-bold">
                            Sam Bornstein<br />
                            Aisling Hamrogue<br />
                            Nicholas Moenich<br />
                            Kate Steciw
                        </div>
                        <em>The Veil</em><br />
                    </div>
                    <div class="md:text-right text-left">
                        <a href="/docs/veil/veil-press-release.pdf" class="block mb-3" target="_blank">PDF</a>
                        April 5th &mdash; May 25th, 2024<br />
                        Opening April 5th, 6PM &mdash; 9PM<br />
                        Hours: Wed - Sat, 1PM &mdash; 6PM<br />
                    </div>
                </div>
                <div class="text-justify max-w-screen-sm mx-auto">
                    <p class="mb-3">
                        There is a story from Greek antiquity of a contest between two painters, Zeuxis and Parrhasius.
                        Zeuxis is said to have painted grapes so convincing that the birds alighted on the painting and
                        attempted to pluck at them. However, when Zeuxis went to unveil the curtain over his rival's
                        painting, he found he was grasping at the painting itself. Zeuxis conceded defeat, for the
                        artist himself was deceived.
                    </p>
                    <p>Is the image the veil that was sought, or the surface that was finally grasped?</p>
                    <p>
                        Functional theories of perception raise a distinction between beliefs and causes: a common
                        example is that of a frog hunting flies. The frog hunting flies does not need to have any
                        particular beliefs about what flies <em>are</em>, but simply needs to track the stimulus of
                        moving black dots. In an environment where most moving black dots are flies, then the presence
                        of this stimulus is sufficient to cause the frog to react to it, whether the dots are actually
                        flies or not.
                    </p>
                    <p>
                        Does the bird that seeks sustenance from the painting feel frustration when it encounters only
                        an image? Frogs, when surrounded with dead flies, will starve because they can detect no
                        movement.
                    </p>
                    <p>
                        Contrary to the mimetic approach of classical painting, the high modernists thought that the
                        perfection of art would come via its media-specificity, as each art-form came to express its
                        autonomous self-awareness. Painting, in its opticality, would become one with its surface,
                        discarding the veil of illusion, as the plasticity of the medium and its representational
                        content merged to express an intrinsic essence.
                    </p>
                    <p>
                        Can the image unite the ideal and the real? Would Zeuxis withdraw from the contest if we
                        dismissed the difference between the canvas and the curtain?
                    </p>
                    <p>
                        The modernists were also aware that their program was a response to the collapse of a tradition:
                        As Greenberg wrote of abstraction, it “[...] may answer the feeling that all hierarchical
                        distinctions have been, literally, exhausted and invalidated; that no area or order of
                        experience is intrinsically superior, on any final scale of values, to any other area or order
                        of experience.”
                    </p>
                    <p>
                        When a shroud is draped over a corpse it retains the contour of the body. The veil reveals an
                        impression of what it keeps hidden.
                    </p>
                    <p>Is the image what lies beneath the veil, or is it the veil itself?</p>
                    <div class="mt-10">
                        <p class="italic">
                            <span class="font-bold">Sam Bornstein</span> born in New York; works in New York. MFA Hunter
                            College, BFA Bard College. His solo exhibitions include Charles Moffett Gallery (New York)
                            and Embajada Gallery (San Juan). He has been presented in group exhibitions with Galerie
                            Moderne (Silkeborg), Salon 8 (Hamburg), and McBride Contemporain (Montreal), among others.
                            His work is in the public collections of Ærø Kunsthal Museum of Modern Art (Ærø, Denmark)
                            and Marina Tsvetaeva Museu (Moscow). His work has been featured in Art Forum, Timeout
                            Magazine, Harpers Magazine and New American Paintings.
                        </p>
                        <p class="italic">
                            <span class="font-bold">Aisling Hamrogue</span> was born in New York, where she lives and
                            works. Hamrogue received an MFA from Hunter College and BFA from The School of Visual Arts .
                            Her works have been exhibited at James Fuentes Gallery (New York), Fredericks &amp; Frieser
                            (New York), New Release Gallery (New York), Good Mother Gallery (Los Angeles) and most
                            recently The Hole Gallery (New York). Her paintings appropriate horror imagery and play with
                            the libidinal charge evoked by slasher films and neo-noir novels. Motifs ordinarily
                            associated with 1980’s film poster and book cover design are given new life, divorced from
                            their context. Recontextualizing eroticism and narrative fiction, Hamrogue addresses both
                            horror tropes and feminist theory, locating an uncomfortable torsion between the two.
                        </p>
                        <p class="italic">
                            <span class="font-bold">Nicholas Moenich</span> was born in Cleveland, Ohio and received a
                            BFA from the Cleveland Institute of Art and a MFA from Hunter College. He has exhibited
                            widely, with solo exhibitions at 1969 Gallery (New York), Furnace (Connecticut), Joseph
                            McCullough Gallery (Cleveland) and group and two-person exhibitions including at Anton Kern
                            Gallery (New York), KDR305 (Miami), Soloway (New York), and Pierogi (New York), among many
                            others. He is a 2023 Pollock-Krasner Foundation Grantee, a 2021 NYSCA/NYFA Artist Fellow in
                            Painting from The New York Foundation for the Arts and a 2019-2020 recipient of the
                            Sharpe-Walentas Studio Program Award, among many other awards and honors. Press includes New
                            American Paintings, Art Maze Magazine, Artspace, Hyperallergic and Two Coats of Paint.
                        </p>
                        <p class="italic">
                            <span class="font-bold">Kate Steciw</span> lives and works in upstate New York. She holds a
                            BA from Smith College and an MFA from the School of the Art Institute of Chicago. Steciw has
                            exhibited extensively in New York in group exhibitions at the International Center of
                            Photography, Hauser &amp; Wirth, Johannes Vogt Gallery, and Eyebeam. She has had solo
                            exhibitions at Higher Pictures Gallery (New York), Christophe Gaillard Gallery (Paris),
                            Brand New Gallery (Milan), Neumeister Bar-Am (Berlin), Annarumma Gallery (Naples), and Levy
                            Delval (Brussels). Her work has been featured in Artforum, Art in America, and Interview
                            magazine.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
