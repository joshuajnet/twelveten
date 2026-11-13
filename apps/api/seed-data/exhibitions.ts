/**
 * Exhibitions and fairs as they appeared on the hard-coded site, transcribed for the initial seed.
 * Body text lives next to this file as `<slug>.html` (+ `<slug>.bio.html`), extracted from the old pages.
 * Event times are wall-clock times in the exhibition's time zone.
 */

export interface SeedEvent {
    label: string;
    /** 'YYYY-MM-DD HH:mm' in the exhibition's time zone */
    start: string;
    end?: string;
}

export interface SeedExhibition {
    slug: string;
    kind: 'exhibition' | 'fair';
    /** One per line */
    artists: string[];
    title: string;
    subtitle?: string;
    titleFirst?: boolean;
    startsOn: string;
    endsOn: string;
    timezone?: string;
    events?: SeedEvent[];
    hoursText?: string;
    venueText?: string;
    locationText?: string;
    heroImage?: string;
    heroAlt?: string;
    thumbnail?: string;
    pressReleaseUrl?: string;
    headerLinks?: { label: string; url: string }[];
    showInquire?: boolean;
    slideshowVisible?: boolean;
    worksAvailable?: boolean;
    /** File name in apps/web/src/json (without .json) */
    slideshow?: string;
    /** YouTube id shown above the text */
    video?: string;
}

const HOURS = 'Hours: Wed - Sat, 1PM — 6PM';
const opening = (day: string, from = '18:00', to = '21:00'): SeedEvent => ({ label: 'Opening', start: `${day} ${from}`, end: `${day} ${to}` });

export const exhibitions: SeedExhibition[] = [
    {
        slug: 'beyond-the-black-rainbow',
        kind: 'exhibition',
        artists: ['Justin Beachler', 'Laveen Gammie', 'Tristan Higginbotham', 'Nico Ramirez Rosas'],
        title: 'Beyond the Black Rainbow',
        titleFirst: true,
        startsOn: '2026-06-06',
        endsOn: '2026-07-25',
        events: [opening('2026-06-06')],
        hoursText: 'Gallery Hours: Weds — Sat, 1PM — 6PM',
        heroImage: '/images/beyond-the-black-rainbow/btbr-square.jpg',
        heroAlt: 'Beyond the Black Rainbow: Justin Beachler, Laveen Gammie, Tristan Higginbotham, Nico Ramirez Rosas. June 6th - July 25th, 2026',
        thumbnail: '/images/beyond-the-black-rainbow/btbr-square.jpg',
        pressReleaseUrl: '/docs/beyond-the-black-rainbow/beyond-the-black-rainbow-pr.pdf',
        worksAvailable: true,
        slideshow: 'beyond-the-black-rainbow-slideshow',
    },
    {
        slug: 'africh-signal',
        kind: 'exhibition',
        artists: ['Noelle Africh'],
        title: 'Signal',
        startsOn: '2026-04-04',
        endsOn: '2026-05-23',
        events: [opening('2026-04-04')],
        hoursText: HOURS,
        heroImage: '/images/signal/africh-signal-square-nomark.jpg',
        heroAlt: 'Noelle Africh: Signal. April 4th - May 23rd, 2026',
        thumbnail: '/images/signal/africh-signal-square-nomark.jpg',
        pressReleaseUrl: '/docs/signal/noelle-africh-signal-press-release.pdf',
        worksAvailable: true,
        slideshow: 'signal-slideshow',
    },
    {
        slug: 'schippa-wildfong-liberte',
        kind: 'exhibition',
        artists: ['Micah Schippa-Wildfong'],
        title: 'LIBERTÉ',
        startsOn: '2026-02-21',
        endsOn: '2026-03-28',
        events: [opening('2026-02-21')],
        hoursText: HOURS,
        heroImage: '/images/liberte/micah-nomark.jpg',
        heroAlt: 'Micah Schippa-Wildfong: LIBERTÉ. February 21st - March 28th, 2026',
        thumbnail: '/images/liberte/micah-nomark.jpg',
        pressReleaseUrl: '/docs/liberte/schippa-wildfong-liberte-press-release.pdf',
        worksAvailable: true,
        slideshow: 'liberte-slideshow',
    },
    {
        slug: 'leitch-darling-maneuver',
        kind: 'exhibition',
        artists: ['Collin Leitch'],
        title: 'The Darling Maneuver',
        startsOn: '2026-01-10',
        endsOn: '2026-02-14',
        events: [opening('2026-01-10')],
        hoursText: HOURS,
        heroImage: '/images/darling-maneuver/leitch-thumb-01.jpg',
        heroAlt: 'Collin Leitch: The Darling Maneuver. January 10th - February 14th, 2026',
        thumbnail: '/images/darling-maneuver/leitch-thumb-01.jpg',
        pressReleaseUrl: '/docs/darling-maneuver/leitch-darling-maneuver-press-release.pdf',
        worksAvailable: true,
        slideshow: 'darling-maneuver-slideshow',
    },
    {
        slug: 'rozell-as-above-so-below',
        kind: 'exhibition',
        artists: ['Trey Rozell'],
        title: 'As above, so below',
        startsOn: '2025-04-12',
        endsOn: '2025-05-24',
        events: [opening('2025-04-12'), { label: 'Artist Talk', start: '2025-04-25 18:00', end: '2025-04-25 20:00' }],
        hoursText: HOURS,
        heroImage: '/images/as-above-so-below/trey-flier-nomark.jpg',
        thumbnail: '/images/as-above-so-below/trey-flier-nomark.jpg',
        pressReleaseUrl: '/docs/as-above-so-below/trey-rozell-press-release.pdf',
        worksAvailable: true,
        slideshow: 'as-above-so-below-slideshow',
    },
    {
        slug: 'terror-element',
        kind: 'exhibition',
        artists: ['Anna Engelhardt', 'Mark Cinkevich'],
        title: 'TERROR ELEMENT',
        startsOn: '2025-06-07',
        endsOn: '2025-07-19',
        events: [opening('2025-06-07')],
        hoursText: HOURS,
        heroImage: '/images/terror-element/terror-element-nomark.jpg',
        thumbnail: '/images/terror-element/terror-element-nomark.jpg',
        pressReleaseUrl: '/docs/terror-element/terror-element-press-release.pdf',
        worksAvailable: false,
        slideshow: 'terror-element-slideshow',
    },
    {
        slug: 'speedrunners',
        kind: 'exhibition',
        artists: ['Isabelle Frances McGuire', 'Ryan Nault', 'Liz Vitlin', 'Ellis & Parker von Sternberg'],
        title: 'Speedrunners',
        titleFirst: true,
        startsOn: '2023-09-29',
        endsOn: '2023-11-11',
        events: [opening('2023-09-29')],
        hoursText: HOURS,
        heroImage: '/images/speedrunners/speedrunners-flier.svg',
        thumbnail: '/images/speedrunners/speedrunners-flier.svg',
        pressReleaseUrl: '/docs/speedrunners/speedrunners-press-release.pdf',
        slideshow: 'speedrunners-slideshow',
    },
    {
        slug: 'bullet-hell',
        kind: 'exhibition',
        artists: ['Sam Dickey', 'Helmut Hammen', 'Trey Rozell'],
        title: 'Bullet Hell',
        subtitle: 'curated by David Mitchell',
        startsOn: '2023-11-17',
        endsOn: '2024-01-12',
        events: [opening('2023-11-17')],
        hoursText: HOURS,
        heroImage: '/images/bullethell/bullethell-nomark-min.png',
        thumbnail: '/images/bullethell/bullethell-nomark-min.png',
        pressReleaseUrl: '/docs/bullethell/bullethell-press-release.pdf',
        slideshow: 'bullethell-slideshow',
    },
    {
        slug: 'beech-delphic-future',
        kind: 'exhibition',
        artists: ['Amanda Beech'],
        title: 'Delphic Future',
        startsOn: '2024-02-04',
        endsOn: '2024-03-23',
        events: [
            opening('2024-02-04', '17:00', '20:00'),
            { label: 'Map of the Bomb Premiere', start: '2024-02-06 19:00', end: '2024-02-06 21:00' },
        ],
        hoursText: HOURS,
        heroImage: '/images/delphic-future/delphic-future-nomark-min2.png',
        thumbnail: '/images/delphic-future/delphic-future-nomark-min.png',
        pressReleaseUrl: '/docs/delphic-future/delphic-future-press-release.pdf',
        headerLinks: [{ label: 'In Conversation', url: '/documents/beech-von-sternberg-interview' }],
        slideshow: 'delphicfuture-slideshow',
        video: 'XaswpDf-jMI',
    },
    {
        slug: 'the-veil',
        kind: 'exhibition',
        artists: ['Sam Bornstein', 'Aisling Hamrogue', 'Nicholas Moenich', 'Kate Steciw'],
        title: 'The Veil',
        startsOn: '2024-04-05',
        endsOn: '2024-05-25',
        events: [opening('2024-04-05')],
        hoursText: HOURS,
        heroImage: '/images/veil/veil-1-nomark-min.png',
        thumbnail: '/images/veil/veil-2-nomark-min.png',
        pressReleaseUrl: '/docs/veil/veil-press-release.pdf',
        slideshow: 'veil-slideshow',
    },
    {
        slug: 'brain-worms',
        kind: 'exhibition',
        artists: ['Pieter Schoolwerth', 'Keith Tilford'],
        title: 'Brain Worms',
        startsOn: '2024-06-08',
        endsOn: '2024-07-27',
        events: [opening('2024-06-08')],
        hoursText: HOURS,
        heroImage: '/images/brain-worms/brain-worms-nomark-min.png',
        thumbnail: '/images/brain-worms/brain-worms-nomark-min.png',
        pressReleaseUrl: '/docs/brain-worms/brain-worms-release.pdf',
        slideshow: 'brainworms-slideshow',
    },
    {
        slug: 'halpern-stareeyed',
        kind: 'exhibition',
        artists: ['Tali Halpern'],
        title: '★E EYED',
        startsOn: '2024-09-28',
        endsOn: '2024-11-02',
        events: [opening('2024-09-28'), { label: 'Artist Talk', start: '2024-10-05 16:00', end: '2024-10-05 18:00' }],
        hoursText: HOURS,
        heroImage: '/images/star-e-eyed/halpern-nomark-min.jpg',
        heroAlt: 'Tali Halpern: Star(e) Eyed. September 28th — November 2nd, 2024',
        thumbnail: '/images/star-e-eyed/halpern-nomark-min.jpg',
        pressReleaseUrl: '/docs/star-e-eyed/halpern-star-e-eyed-press-release.pdf',
        worksAvailable: true,
        slideshow: 'star-e-eyed-slideshow',
    },
    {
        slug: 'coldbomb',
        kind: 'exhibition',
        artists: ['Jason Loebs'],
        title: 'COLDBOMB',
        startsOn: '2024-11-09',
        endsOn: '2024-12-21',
        events: [opening('2024-11-09')],
        hoursText: HOURS,
        heroImage: '/images/coldbomb/loebs-nomark2.jpg',
        thumbnail: '/images/coldbomb/loebs-nomark2.jpg',
        pressReleaseUrl: '/docs/coldbomb/coldbomb-press-release.pdf',
        worksAvailable: true,
        slideshow: 'coldbomb-slideshow',
    },
    {
        slug: 'ryleans',
        kind: 'exhibition',
        artists: ['Noelle Africh', 'Ellis & Parker von Sternberg', 'Jonathan Worcester', 'Ziyi Zhang'],
        title: 'The Ryleans',
        titleFirst: true,
        startsOn: '2025-02-15',
        endsOn: '2025-03-29',
        events: [opening('2025-02-15')],
        hoursText: HOURS,
        heroImage: '/images/ryleans/ryleans-flier-nomark.jpg',
        thumbnail: '/images/ryleans/ryleans-flier-nomark.jpg',
        pressReleaseUrl: '/docs/ryleans/ryleans-press-release.pdf',
        worksAvailable: true,
        slideshow: 'ryleans-slideshow',
    },
    {
        slug: 'nada-miami-2026',
        kind: 'fair',
        artists: ['Noelle Africh'],
        title: 'NADA Miami 2026',
        startsOn: '2026-12-01',
        endsOn: '2026-12-05',
        timezone: 'America/New_York',
        venueText: 'Ice Palace Studios\n1400 North Miami Avenue',
        locationText: 'Miami, FL',
        showInquire: true,
        worksAvailable: true,
        // As on the old page: this fair still shows the NADA Miami 2025 slideshow.
        slideshow: 'nada-miami-2025-slideshow',
    },
    {
        slug: 'neighbors-chicago-2026',
        kind: 'fair',
        artists: ['Noelle Africh', 'Micah Schippa-Wildfong'],
        title: 'Neighbors',
        startsOn: '2026-04-08',
        endsOn: '2026-04-12',
        venueText: '1355 North Astor, Chicago IL 60610',
        locationText: 'Chicago, IL',
        headerLinks: [{ label: 'Neighbors website', url: 'https://www.neighbors.art/' }],
        showInquire: true,
        slideshowVisible: false,
        worksAvailable: true,
    },
    {
        slug: 'nada-miami-2025',
        kind: 'fair',
        artists: ['Tali Halpern'],
        title: 'NADA Miami 2025',
        subtitle: 'Booth D206',
        startsOn: '2025-12-02',
        endsOn: '2025-12-06',
        timezone: 'America/New_York',
        venueText: 'Ice Palace Studios\n1400 North Miami Avenue',
        locationText: 'Miami, FL',
        headerLinks: [{ label: 'Preview PDF', url: '/docs/nada-miami-2025/tali-halpern-nada-miami-preview.pdf' }],
        worksAvailable: true,
        slideshow: 'nada-miami-2025-slideshow',
    },
];
