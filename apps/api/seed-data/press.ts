/** Press coverage as listed on the old News page (Press.vue), newest first. */

export interface SeedPressItem {
    outlet: string;
    title: string;
    url: string;
    publishedOn: string;
    /** Shown instead of the date (journals) */
    issueLabel: string | null;
    byline: string | null;
    /** Exhibition slug this coverage is about */
    exhibition: string | null;
}

export const pressItems: SeedPressItem[] = [
    {"outlet": "Newcity Art", "title": "“Beyond the Black Rainbow” and Utopian Collapse", "url": "https://art.newcity.com/2026/07/08/beyond-the-black-rainbow-and-utopian-collapse/", "publishedOn": "2026-07-08", "issueLabel": null, "byline": "by Teddy Sandler", "exhibition": "beyond-the-black-rainbow"},
    {"outlet": "Hyperallergic", "title": "10 Art Shows to See in Chicago This Summer (feat. Beyond the Black Rainbow group exhibition)", "url": "https://hyperallergic.com/10-art-shows-to-see-in-chicago-this-summer/", "publishedOn": "2026-06-24", "issueLabel": null, "byline": "by Natalie Jenkins", "exhibition": "beyond-the-black-rainbow"},
    {"outlet": "Newcity Art", "title": "Noelle Africh’s “Signal” Is Gut Instinct Turned Preserved Layer", "url": "https://art.newcity.com/2026/04/24/noelle-africhs-signal-is-gut-instinct-turned-preserved-layer/", "publishedOn": "2026-04-24", "issueLabel": null, "byline": "by Samuel Schwindt", "exhibition": "africh-signal"},
    {"outlet": "Newcity Art", "title": "Freedom and Its Limits in Micah Schippa-Wildfong’s “Liberté”", "url": "https://art.newcity.com/2026/03/02/freedom-and-its-limits-in-micah-schippa-wildfongs-liberte/", "publishedOn": "2026-03-02", "issueLabel": null, "byline": "by Annette LePique", "exhibition": "schippa-wildfong-liberte"},
    {"outlet": "Newcity Art", "title": "Collin Leitch Frames Nature Through the Machine in “The Darling Maneuver”", "url": "https://art.newcity.com/2026/02/03/collin-leitch-frames-nature-through-the-machine-in-the-darling-maneuver/", "publishedOn": "2026-02-03", "issueLabel": null, "byline": "by Jefferson Godard", "exhibition": "leitch-darling-maneuver"},
    {"outlet": "Newcity Art", "title": "Simulating Reality: A Review of “Terror Element” at Twelve Ten", "url": "https://art.newcity.com/2025/07/15/simulating-reality-a-review-of-terror-element-at-twelve-ten/", "publishedOn": "2025-07-15", "issueLabel": null, "byline": "by Teddy Sandler", "exhibition": "terror-element"},
    {"outlet": "Portable Gray", "title": "Map of the Bomb (2022) by Amanda Beech Film premiere at the Music Box Theatre 3733 N Southport Ave, Chicago, IL February 6, 2024", "url": "https://www.journals.uchicago.edu/doi/full/10.1086/737001", "publishedOn": "2025-06-01", "issueLabel": "Volume 8, Number 1 Spring 2025", "byline": "by Anna Searle Jones", "exhibition": "beech-delphic-future"},
    {"outlet": "Newcity Art", "title": "A Game Not for the Feign of Art: A Review of Trey Rozell’s “As above, so below” at Twelve Ten", "url": "https://art.newcity.com/2025/05/12/a-game-not-for-the-feign-of-art-a-review-of-trey-rozells-as-above-so-below-at-twelve-ten/", "publishedOn": "2025-05-12", "issueLabel": null, "byline": "by Curtis Anthony Bozif", "exhibition": "rozell-as-above-so-below"},
    {"outlet": "New Art Examiner", "title": "“The Ryleans”: An Art Exhibition or a Course in Twentieth-Century Philosophy?", "url": "https://www.thenewartexaminer.org/2025/03/05/6388/", "publishedOn": "2025-03-05", "issueLabel": null, "byline": "by Michel Segard", "exhibition": "ryleans"},
    {"outlet": "Contemporary Art Daily", "title": "Jason Loebs at Twelve Ten Gallery", "url": "https://www.contemporaryartdaily.com/project/jason-loebs-at-twelve-ten-gallery-chicago-44175", "publishedOn": "2024-12-24", "issueLabel": null, "byline": null, "exhibition": "coldbomb"},
    {"outlet": "Newcity Art", "title": "Weaving Online Life: A Review of Tali Halpern at Twelve Ten", "url": "https://art.newcity.com/2024/10/10/weaving-online-life-a-review-of-tali-halpern-at-twelve-ten/", "publishedOn": "2024-10-10", "issueLabel": null, "byline": "by Jennifer Smart", "exhibition": "halpern-stareeyed"},
    {"outlet": "Chicago Reader", "title": "Tali Halpern dreams big", "url": "https://chicagoreader.com/arts-culture/tali-halpern-twelve-ten-gallery/", "publishedOn": "2024-09-25", "issueLabel": null, "byline": "by Micco Caporale. Photography: Riley Valentine", "exhibition": "halpern-stareeyed"},
    {"outlet": "New Art Examiner", "title": "“Brain Worms” at Twelve Ten Gallery, Chicago June 8–July 27, 2024", "url": "https://www.thenewartexaminer.org/2024/09/23/brainworms/", "publishedOn": "2024-09-24", "issueLabel": null, "byline": "by Charles Venkatesh Young", "exhibition": "brain-worms"},
    {"outlet": "Art Viewer", "title": "Pieter Schoolwerth and Keith Tilford at Twelve Ten Gallery", "url": "https://artviewer.org/pieter-schoolwerth-and-keith-tilford-at-twelve-ten-gallery/", "publishedOn": "2024-07-25", "issueLabel": null, "byline": null, "exhibition": "brain-worms"},
    {"outlet": "Newcity Art", "title": "“Forget it, Jake. It’s the Internet.” A Review of “Brain Worms” at Twelve Ten Gallery", "url": "https://art.newcity.com/2024/07/16/forget-it-jake-its-the-internet-a-review-of-brain-worms-at-twelve-ten-gallery/", "publishedOn": "2024-07-16", "issueLabel": null, "byline": "by Annette LePique", "exhibition": "brain-worms"},
    {"outlet": "Art Viewer", "title": "The Veil at Twelve Ten Gallery", "url": "https://artviewer.org/the-veil-at-twelve-ten-gallery/", "publishedOn": "2024-05-22", "issueLabel": null, "byline": null, "exhibition": "the-veil"},
    {"outlet": "Art Forum", "title": "\"Must See\" The Veil at Twelve Ten Gallery", "url": "https://artguide.artforum.com/artguide/twelve-ten-gallery-23694/the-veil-229369", "publishedOn": "2024-05-09", "issueLabel": null, "byline": null, "exhibition": "the-veil"},
    {"outlet": "Art Viewer", "title": "Amanda Beech at Twelve Ten Gallery", "url": "https://artviewer.org/amanda-beech-at-twelve-ten-gallery/", "publishedOn": "2024-03-02", "issueLabel": null, "byline": null, "exhibition": "beech-delphic-future"},
    {"outlet": "Newcity Art", "title": "You Were Always Complicit: A Review of “Bullet Hell” at Twelve Ten Gallery", "url": "https://art.newcity.com/2023/12/15/you-were-always-complicit-a-review-of-bullet-hell-at-twelve-ten-gallery/", "publishedOn": "2023-12-15", "issueLabel": null, "byline": "by Annette LePique", "exhibition": "bullet-hell"},
    {"outlet": "Chicago Spleen", "title": "Isabelle Frances McGuire, Ryan Nault, Liz Vitlin, Ellis & Parker von Sternberg: Speedrunners @ Twelve Ten", "url": "https://chicagospleen.substack.com/p/isabelle-frances-mcguire-ryan-nault", "publishedOn": "2023-11-10", "issueLabel": null, "byline": "by Gareth Kaye", "exhibition": "speedrunners"},
];
