<script>
import { ref } from 'vue';
import GallerySlideshow from '../../components/GallerySlideshow.vue';
import slideshowData from '../../json/bullethell-slideshow.json';

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
        <div class="container mx-auto grid md:grid-cols-2 gap-3 px-3">
            <img src="/images/bullethell/bullethell-nomark-min.png" class="max-w-full w-auto h-auto mx-auto" />
            <div id="press-release">
                <div class="grid md:grid-cols-2 grid-cols-1 gap-3 mb-6">
                    <div>
                        <div class="text-lg mb-3 font-gloock">
                            Sam Dickey<br />
                            Helmut Hammen<br />
                            Trey Rozell
                        </div>
                        <em>Bullet Hell</em><br />
                        curated by David Mitchell
                    </div>
                    <div class="md:text-right text-left">
                        <a href="/docs/bullethell/bullethell-press-release.pdf" class="block mb-3" target="_blank"
                            >PDF</a
                        >
                        Nov. 17th &mdash; Jan. 12th, 2024<br />
                        Opening Nov. 17th, 6PM &mdash; 9PM<br />
                        Hours: Wed - Sat, 1PM &mdash; 6PM<br />
                    </div>
                </div>
                <div class="text-justify">
                    <p class="mb-3">
                        They march you up with a paper target on your chest and a blindfold, so you can’t see the five
                        men in a line, all aiming down sights. Lockstep heels make a metronome of the firing squad, the
                        click-click-click pilot light chatter as the flames ignite. Telltale signs of an impending
                        thunderous volley, a rhythmic firestorm, a manmade bullet hell aimed at your heart. The real
                        trick of it is that those men all get to be blameless instruments of the system, the anonymous
                        agents of a machine beyond your comprehension or control.
                    </p>
                    <p>Let’s go back. Let’s keep going.</p>
                    <p>
                        You’re at the crime scene. The evidence is overwhelming—pornographic even in its excess. It
                        points everywhere. It’s like that old Agatha Christie yarn, the one set on the train: everyone
                        is culpable, no one is innocent. The “signal to noise ratio” isn’t even a relevant metric. The
                        raw volume of information available and produced at all times is a pulsating, white hot noise
                        cranked beyond any perceivable scale, an event horizon both sublime and profane. There are
                        functionally infinite points of data which can rearrange into an infinite-times-infinite number
                        of interpretations, every framework viable but none necessary. The deluge of possibilities are
                        dizzying, blinding, paralyzing and nothing at all.
                    </p>
                    <p>Let’s go back. Let’s keep going.</p>
                    <p>
                        You got on the case when you first noticed an odd bit of graffiti scribbled on the wall by some
                        punk – was it a musical instrument of some kind? A horn? Maybe that, maybe not, maybe a circle
                        with a line, maybe a pendulum, maybe nothing at all. It spilled out from there, contaminating
                        everything you saw. A maddening apophenia or a real conspiracy? Repetition, the mass
                        proliferation of information, is itself the gesture to interpret. Sedimentation of small
                        fragments is one strategy to extract meaning, like divination through tea leaves. Looking at the
                        temporary alignments and patterns that emerge from the system is like glimpsing the cosmic plan
                        written across the sky in a constellation. Numerological poetry in the infinite digits of pi.
                    </p>
                    <p>Let’s go back. Let’s keep going.</p>
                    <p>
                        It was before this whole mess. You were innocent, just another cog in the machine when they
                        marched the prisoner in front of you. You didn't know if your gun held the live bullet, or just
                        a blank. Right before you pulled the trigger, you heard the prisoner whisper: “The world is
                        being engulfed in truth.”
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>
