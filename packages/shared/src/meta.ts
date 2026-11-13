import type { Exhibition, HomePage, NewsPost } from './content.ts';
import { formatDateRange } from './dates.ts';
import { exhibitionPath, newsPath } from './routes.ts';
import { escapeHtml, firstHtmlParagraph, firstParagraph, truncate } from './text.ts';

export const SITE_NAME = 'Twelve Ten Gallery';
export const SITE_DESCRIPTION = 'A contemporary art gallery based in Chicago';
export const DEFAULT_IMAGE = '/media/images/twelveten-share.jpg';
export const GALLERY_ADDRESS = {
    '@type': 'PostalAddress',
    streetAddress: '1104 W Thorndale Ave',
    addressLocality: 'Chicago',
    addressRegion: 'IL',
    postalCode: '60660',
    addressCountry: 'US',
} as const;

const DESCRIPTION_MAX = 160;

export interface HeadTags {
    title: string;
    description: string;
    canonical: string;
    image: string;
    imageAlt: string;
    ogType: 'website' | 'article';
    robots?: string;
    jsonLd?: Record<string, unknown>;
    status: 200 | 404;
}

export type MetaInput =
    | { kind: 'exhibition'; exhibition: Exhibition }
    | { kind: 'news-item'; post: NewsPost }
    | { kind: 'home'; home: HomePage }
    | { kind: 'static'; path: string; title?: string; description?: string; image?: string | null }
    | { kind: 'not-found'; path: string };

export interface MetaOptions {
    /** Absolute site origin, e.g. https://www.twelvetengallery.com */
    siteUrl: string;
}

const STATIC_TITLES: Record<string, string> = {
    '/about': 'About',
    '/exhibitions': 'Exhibitions',
    '/fairs': 'Fairs',
    '/news': 'News & Press',
    '/documents/beech-von-sternberg-interview': 'Amanda Beech in conversation with Parker von Sternberg',
};

function absolute(siteUrl: string, pathOrUrl: string): string {
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    return `${siteUrl.replace(/\/+$/, '')}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

const withSite = (title: string) => (title === SITE_NAME ? title : `${title} — ${SITE_NAME}`);

/** Join a description body and a suffix (like dates) and keep the total under the limit. */
function describe(body: string, suffix?: string): string {
    if (!suffix) return truncate(body, DESCRIPTION_MAX);
    const tail = ` ${suffix}`;
    if (!body) return suffix;
    return `${truncate(body, DESCRIPTION_MAX - tail.length)}${tail}`;
}

function exhibitionTitle(e: Pick<Exhibition, 'artistsLine' | 'title'>): string {
    return e.artistsLine ? `${e.artistsLine}: ${e.title}` : e.title;
}

export function buildMeta(input: MetaInput, { siteUrl }: MetaOptions): HeadTags {
    switch (input.kind) {
        case 'exhibition': {
            const e = input.exhibition;
            const path = exhibitionPath(e);
            const dates = formatDateRange(e.startsOn, e.endsOn);
            const firstVisible = e.artworks.find((a) => !a.hidden);
            const image = e.ogImage ?? e.heroImage ?? firstVisible?.image ?? DEFAULT_IMAGE;
            const name = exhibitionTitle(e);
            const jsonLd: Record<string, unknown> = {
                '@context': 'https://schema.org',
                '@type': 'ExhibitionEvent',
                name,
                startDate: e.startsOn,
                endDate: e.endsOn,
                url: absolute(siteUrl, path),
                image: absolute(siteUrl, image),
                eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
                location:
                    e.kind === 'fair' && e.venueText
                        ? { '@type': 'Place', name: e.venueText }
                        : { '@type': 'Place', name: SITE_NAME, address: GALLERY_ADDRESS },
                organizer: { '@type': 'ArtGallery', name: SITE_NAME, url: siteUrl },
            };
            const artists = e.artistsLine.split(/,\s*|\s+&\s+|\s+and\s+/).map((s) => s.trim()).filter(Boolean);
            if (artists.length) jsonLd.performer = artists.map((n) => ({ '@type': 'Person', name: n }));
            return {
                title: withSite(e.seoTitle ?? name),
                description: e.seoDescription ?? describe(firstParagraph(e.content), dates),
                canonical: absolute(siteUrl, path),
                image: absolute(siteUrl, image),
                imageAlt: e.heroAlt ?? `${name}. ${dates}`,
                ogType: 'website',
                jsonLd,
                status: 200,
            };
        }
        case 'news-item': {
            const p = input.post;
            const path = newsPath(p.slug);
            const firstImg = /<img[^>]+src="([^"]+)"/i.exec(p.bodyHtml)?.[1];
            const image = p.ogImage ?? firstImg ?? DEFAULT_IMAGE;
            return {
                title: withSite(p.seoTitle ?? p.title),
                description: p.seoDescription ?? describe(firstHtmlParagraph(p.bodyHtml)),
                canonical: absolute(siteUrl, path),
                image: absolute(siteUrl, image),
                imageAlt: p.title,
                ogType: 'article',
                jsonLd: {
                    '@context': 'https://schema.org',
                    '@type': 'NewsArticle',
                    headline: p.title,
                    datePublished: p.publishedAt,
                    dateModified: p.updatedAt,
                    image: [absolute(siteUrl, image)],
                    publisher: { '@type': 'Organization', name: SITE_NAME, url: siteUrl },
                    url: absolute(siteUrl, path),
                },
                status: 200,
            };
        }
        case 'home': {
            const h = input.home;
            const startsOn = h.link?.startsOn ?? h.startsOn;
            const endsOn = h.link?.endsOn ?? h.endsOn;
            const dates = startsOn && endsOn ? formatDateRange(startsOn, endsOn) : '';
            const lead = [h.headline, h.subline].filter(Boolean).join(': ');
            const generated = [lead, dates].filter(Boolean).join('. ');
            const image = h.ogImage ?? h.bgImage;
            return {
                title: h.seoTitle ?? SITE_NAME,
                description: h.seoDescription ?? (generated ? truncate(generated, DESCRIPTION_MAX) : SITE_DESCRIPTION),
                canonical: absolute(siteUrl, '/'),
                image: absolute(siteUrl, image),
                imageAlt: generated || SITE_NAME,
                ogType: 'website',
                jsonLd: {
                    '@context': 'https://schema.org',
                    '@type': 'ArtGallery',
                    name: SITE_NAME,
                    url: siteUrl,
                    address: GALLERY_ADDRESS,
                    image: absolute(siteUrl, image),
                },
                status: 200,
            };
        }
        case 'static': {
            const title = input.title ?? STATIC_TITLES[input.path] ?? SITE_NAME;
            const image = input.image ?? DEFAULT_IMAGE;
            return {
                title: withSite(title),
                description: input.description ?? SITE_DESCRIPTION,
                canonical: absolute(siteUrl, input.path),
                image: absolute(siteUrl, image),
                imageAlt: SITE_NAME,
                ogType: 'website',
                status: 200,
            };
        }
        case 'not-found':
            return {
                title: withSite('Page not found'),
                description: SITE_DESCRIPTION,
                canonical: absolute(siteUrl, input.path),
                image: absolute(siteUrl, DEFAULT_IMAGE),
                imageAlt: SITE_NAME,
                ogType: 'website',
                robots: 'noindex',
                status: 404,
            };
    }
}

/** Serialize head tags into HTML for injection into the page shell. */
export function renderHead(tags: HeadTags): string {
    const a = escapeHtml;
    const lines = [
        `<title>${a(tags.title)}</title>`,
        `<meta name="description" content="${a(tags.description)}" />`,
        `<link rel="canonical" href="${a(tags.canonical)}" />`,
        `<meta property="og:site_name" content="${SITE_NAME}" />`,
        `<meta property="og:title" content="${a(tags.title)}" />`,
        `<meta property="og:type" content="${tags.ogType}" />`,
        `<meta property="og:url" content="${a(tags.canonical)}" />`,
        `<meta property="og:description" content="${a(tags.description)}" />`,
        `<meta property="og:image" content="${a(tags.image)}" />`,
        `<meta property="og:image:alt" content="${a(tags.imageAlt)}" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:title" content="${a(tags.title)}" />`,
        `<meta name="twitter:description" content="${a(tags.description)}" />`,
        `<meta name="twitter:image" content="${a(tags.image)}" />`,
        `<meta name="twitter:image:alt" content="${a(tags.imageAlt)}" />`,
    ];
    if (tags.robots) lines.push(`<meta name="robots" content="${a(tags.robots)}" />`);
    if (tags.jsonLd) {
        // Escape '<' so content can never close the script tag.
        lines.push(`<script type="application/ld+json">${JSON.stringify(tags.jsonLd).replace(/</g, '\\u003c')}</script>`);
    }
    return lines.join('\n        ');
}
