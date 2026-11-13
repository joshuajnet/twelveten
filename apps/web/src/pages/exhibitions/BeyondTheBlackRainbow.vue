<script>
import { ref } from 'vue';
import GallerySlideshow from '../../components/GallerySlideshow.vue';
import slideshowData from '../../json/beyond-the-black-rainbow-slideshow.json';

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
            <img src="/images/beyond-the-black-rainbow/btbr-square.jpg" class="max-w-full w-auto h-auto mx-auto" />
            <div id="press-release">
                <div class="grid md:grid-cols-2 grid-cols-1 gap-3 mb-6 mx-auto">
                    <div class="flex justify-between">
                        <div class="text-lg">
                            <strong>Beyond the Black Rainbow</strong><br />
                            Justin Beachler<br />
                            Laveen Gammie<br />
                            Tristan Higginbotham<br />
                            Nico Ramirez Rosas<br />
                        </div>
                    </div>
                    <div class="md:text-right text-left">
                        <a
                            href="/docs/beyond-the-black-rainbow/beyond-the-black-rainbow-pr.pdf"
                            class="block mb-3"
                            target="_blank"
                        >
                            PDF
                        </a>
                        June 6th &mdash; July 25th, 2026<br />
                        Opening June 6th, 6PM &mdash; 9PM<br />
                        Gallery Hours: Weds &mdash; Sat, 1PM &mdash; 6PM<br />
                    </div>
                </div>
                <div class="text-justify max-w-screen-sm mx-auto">
                    <p class="mb-6">
                        Twelve Ten Gallery is pleased to present “Beyond the Black Rainbow”,  a group exhibition titled after the 2010 film and featuring Justin Beachler, Laveen Gammie, Tristan Higginbotham, and Nico Ramirez Rosas.
                    </p>
                    <p class="mb-3">
                        Italian-Canadian director Panos Cosmatos' film unfolds as a hallucinatory vision of technological utopianism turned malignant. Set against the rise and collapse of postwar idealism, it traces the development of  the  fictional Aboria Institute, a research center founded in the 1960s on the promise of achieving human happiness through pharmaceuticals, spiritual therapy, and scientific advancement. By the 1980s, that promise curdles into something menacingly psychosexual and authoritarian. Centered on two figures: Dr. Barry Nyle (Michael J Rogers), a researcher and disciple of the institute’s ideology, and Elena (Eva Bourne), a psychic young woman held captive under his supervision, we see through their relationship how enlightenment mutates into domination and self-optimization into institutionalized abuse.  
                    </p>
                    <p class="mb-3">
                        More than an exercise in retro-futurist style, “Beyond the Black Rainbow” maps the trajectory of Western liberal optimism into the technologized logic of late capitalism. This ideological transformation finds a parallel in "Network”, Sidney Lumet’s 1976 satire of mass media and corporate power. Released near the midpoint of the historical arc imagined by Cosmatos’ film, “Network” presents one of the clearest, most compelling descriptions of neo-liberalism:
                    </p>
                    <p class="mb-3">
                        “We no longer live in a world of nations and ideologies ... The world is a college of corporations, inexorably determined by the immutable bylaws of business. The world is a business … It has been since man crawled out of the slime. And our children will live … to see that perfect world in which there's no war or famine, oppression or brutality -- one vast and ecumenical holding company, for whom all men will work to serve a common profit, in which all men will hold a share of stock, all necessities provided, all anxieties tranquilized, all boredom amused.” 
                    </p>
                    <p class="mb-3">
                        This speech, delivered by the corporate head of the network to Howard Beale (Peter Finch), who plays a charismatic but rebellious anchorman, ends with Beale accepting the revelation as divine truth, declaring he has “seen the face of God.”
                    </p>
                    <p class="mb-3">
                        A similar revelation haunts Barry Nyle. It is eventually disclosed that he himself is a product of the Aboria Institute’s experiments. Before murdering his wife and fully embracing his psychic transformation, he recounts a vision of transcendence: “I looked into the eye of God. And it looked back through me… it was so, so, so beautiful, like a black rainbow... and it chose me, it chose me, to reveal itself to me. You're nothing. You're less than nothing. Just... spit in the wind.”
                    </p>
                    <p class="mb-3">
                        More than forty years after the historical horizon evoked by these films, from the optimism of JFK to the deregulated excesses of Reaganism, we now inhabit the aftermath of that ideological project. The promises of liberation through technology, consumption, and self-actualization persist, but largely as exhausted spectacles masking systems of extraction, pharmacological dependence, surveillance, and psychic fragmentation. This exhibition draws from the thematic and aesthetic language of “Beyond the Black Rainbow” to reflect on that contemporary condition.
                    </p>
                    <p class="mb-3">
                        Justin Beachler collects ephemera from New Age movements and countercultural self-help systems, transforming them into minimalist sculptures that oscillate between devotion and obsolescence. Tristan Higginbotham constructs biomorphic forms from consumer debris and organic residue, producing objects that feel simultaneously synthetic and alive. Laveen Gammie stages haunted interiors that camouflage and expose conditions of collective psychosis embedded within everyday space. Nico Ramirez Rosas engages the pharmakon to excavate the spiritual, traumatic, and chemically mediated dimensions of contemporary life.
                    </p>
                    <p class="mb-3">
                        Together, these works examine the collapse of utopian promises into systems of sedation, control, and spectacle. They inhabit the psychic residue left behind by neoliberalism’s dream of infinite progress and perfectibility. We are beyond the black rainbow. We are spit in the wind.
                    </p>
                    <div class="mt-10">
                        <p class="italic mb-3">
                            <span class="font-bold">Justin Beachler</span> (b. 1981, Springfield, Missouri) lives and  works in Chicago. His work has recently been shown at Grunts Rare Books (Chicago, IL), Weatherproof  (Chicago, IL) and LVL3 in  (Chicago, IL), The Nerman Museum of Contemporary Art (Overland Park, KA), Granite City Art and Design District (Granite City, IL), Haw Contemporary(Kansas City, MO) and numerous other spaces. Beachler was a Charlotte Street Foundation studio resident and his work is part of the Nerman Museum of Contemporary Art’s permanent collection. Beachler attended the Kansas City Art Institute from 2001 to 2003 and graduated with a BA in art history from UMKC in 2012.
                        </p>
                        <p class="italic mb-3">
                            <span class="font-bold">Laveen Gammie</span> (b. 1997, Scarborough, Canada) lives and works in Chicago, IL. Her recent exhibitions include “Gut (Drink it Dry)” at 24 ATM Lotto (Toronto, Canada), “Always on My Mind” at the Barbershop (Detroit, MI), “Untitled” at Daniel Laskarin’s Sunday Afternoon Series (Victoria, Canada), “The Haunting of a Place That Longs For Your Arrival” at LVL 3  (Chicago, IL), “Substitute Equal Amounts: Part 1” at The Logan Center for the Arts (Chicago, IL), “The Air Will Travel Behind” at Stadium Projects (Guelph, Canada), “001” at WIHSH  (Chicago, IL). She holds a Bachelor of Fine Arts from the University of Victoria and a Master of Visual Arts from the University of Chicago.
                        </p>
                        <p class="italic mb-3">
                            <span class="font-bold">Tristan Higginbotham</span> (b. 1996, Nashville, Tennessee)  lives and works in New York City. Recent exhibitions include “Rustle” at Blue Boy (Savannah GA), “Fouling the Nest” (Cleveland OH), “Strange Figures” at Marvin Gardens (Queens NY), “Doing Time” at South Parade (London, UK), and “Serendipity Trail”, Badwater, (Knoxville TN). She has participated in various residencies, such as the NYC Audubon Governors Island residency, Stoveworks (Chattanooga, TN), Byrdcliffe Artist Colony (Woodstock, NY), and Wave Hill AIR (Bronx, NY). BFA from Watkins College of Art in 2018 and works as a state-licensed wildlife rehabilitator and veterinary assistant.
                        </p>
                        <p class="italic mb-3">
                            <span class="font-bold">Nico Ramirez Rosas</span> (b. 2002, El Paso, Texas) lives and works in Chicago, IL. Her work has been featured in LVL 3’s Artists of the Week, and exhibited with TUSK (Chicago, IL), GURE (Chicago, IL), and SULK (Chicago, IL) among others. She received her BFA in painting and drawing from the School of the Art Institute of Chicago (2025) and has participated in residence programs at HEIMA (Seyðisfjörður, Iceland) and the late Marfa OPEN (Marfa TX).
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
