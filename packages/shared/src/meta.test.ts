import { describe, it, expect } from 'vitest';
import { buildMeta, renderHead, SITE_NAME } from './meta.ts';
import type { Exhibition, HomePage, NewsPost } from './content.ts';
import { truncate, htmlToText } from './text.ts';

const siteUrl = 'https://www.twelvetengallery.com';
const id = '0190f5c2-0000-7000-8000-000000000001';
const ts = '2026-04-01T12:00:00.000Z';

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });

const exhibition = (over: Partial<Exhibition> = {}): Exhibition => ({
    id, slug: 'africh-signal', kind: 'exhibition', artists: 'Noelle Africh', title: 'Signal', subtitle: null, titleFirst: false, locationText: null,
    startsOn: '2026-04-04', endsOn: '2026-05-23', timezone: 'America/Chicago',
    thumbnail: null, heroImage: '/media/images/signal/hero.jpg', heroAlt: null, published: true,
    hoursText: null, venueText: null, pressReleaseUrl: null, headerLinks: [], showInquire: false, slideshowVisible: true, worksAvailable: true,
    content: { type: 'doc', content: [{ type: 'paragraph' }, para('Twelve Ten Gallery is thrilled to present Signal, an exhibition by Noelle Africh.')] },
    seoTitle: null, seoDescription: null, ogImage: null, updatedAt: ts, contentHtml: '',
    events: [], artworks: [], press: [],
    ...over,
});

describe('buildMeta: exhibition', () => {
    it('derives title, description with dates, image and canonical', () => {
        const tags = buildMeta({ kind: 'exhibition', exhibition: exhibition() }, { siteUrl });
        expect(tags.title).toBe(`Noelle Africh: Signal — ${SITE_NAME}`);
        expect(tags.description).toBe(
            'Twelve Ten Gallery is thrilled to present Signal, an exhibition by Noelle Africh. April 4th — May 23rd, 2026',
        );
        expect(tags.image).toBe(`${siteUrl}/media/images/signal/hero.jpg`);
        expect(tags.canonical).toBe(`${siteUrl}/exhibitions/africh-signal`);
        expect(tags.jsonLd).toMatchObject({ '@type': 'ExhibitionEvent', startDate: '2026-04-04', endDate: '2026-05-23' });
        expect(tags.status).toBe(200);
    });

    it('keeps long descriptions under 160 characters including the dates', () => {
        const long = 'word '.repeat(80);
        const tags = buildMeta({ kind: 'exhibition', exhibition: exhibition({ content: { type: 'doc', content: [para(long)] } }) }, { siteUrl });
        expect(tags.description.length).toBeLessThanOrEqual(160);
        expect(tags.description.endsWith('April 4th — May 23rd, 2026')).toBe(true);
    });

    it('falls back from og image → hero → first visible artwork → default', () => {
        const art = (image: string, hidden: boolean) => ({
            id, exhibitionId: id, position: 0, image, video: null, alt: '', author: null, title: null, dateText: null,
            dimensions: null, media: null, credit: null, hidden, available: false, updatedAt: ts,
        });
        const noHero = exhibition({ heroImage: null, artworks: [art('/a.jpg', true), art('/b.jpg', false)] });
        expect(buildMeta({ kind: 'exhibition', exhibition: noHero }, { siteUrl }).image).toBe(`${siteUrl}/b.jpg`);
        expect(buildMeta({ kind: 'exhibition', exhibition: exhibition({ ogImage: 'https://cdn.example/og.jpg' }) }, { siteUrl }).image)
            .toBe('https://cdn.example/og.jpg');
        expect(buildMeta({ kind: 'exhibition', exhibition: exhibition({ heroImage: null }) }, { siteUrl }).image)
            .toContain('/media/images/twelveten-share.jpg');
    });

    it('uses fair routes and venue', () => {
        const tags = buildMeta({ kind: 'exhibition', exhibition: exhibition({ kind: 'fair', slug: 'nada-miami-2026', venueText: 'NADA Miami' }) }, { siteUrl });
        expect(tags.canonical).toBe(`${siteUrl}/fairs/nada-miami-2026`);
        expect(tags.jsonLd).toMatchObject({ location: { name: 'NADA Miami' } });
    });

    it('respects SEO overrides', () => {
        const tags = buildMeta({ kind: 'exhibition', exhibition: exhibition({ seoTitle: 'Custom', seoDescription: 'Desc' }) }, { siteUrl });
        expect(tags.title).toBe(`Custom — ${SITE_NAME}`);
        expect(tags.description).toBe('Desc');
    });
});

describe('artists', () => {
    it('joins multi-line artists and puts the title first for group shows', () => {
        const group = exhibition({ artists: 'Sam Bornstein\nAisling Hamrogue\nKate Steciw', title: 'The Veil', titleFirst: true });
        const tags = buildMeta({ kind: 'exhibition', exhibition: group }, { siteUrl });
        expect(tags.title).toBe(`The Veil: Sam Bornstein, Aisling Hamrogue & Kate Steciw — ${SITE_NAME}`);
        expect(tags.jsonLd?.performer).toHaveLength(3);
    });
});

describe('buildMeta: news, home, static, 404', () => {
    const post: NewsPost = {
        id, slug: '7-1-2026', title: 'Record Release', publishedAt: '2026-07-01T17:00:00.000Z',
        bodyHtml: '<p>Twelve Ten Gallery is pleased to host &amp; celebrate.</p><p>More</p>',
        seoTitle: null, seoDescription: null, ogImage: null, published: true, updatedAt: ts,
    };

    it('news uses the first paragraph and NewsArticle', () => {
        const tags = buildMeta({ kind: 'news-item', post }, { siteUrl });
        expect(tags.description).toBe('Twelve Ten Gallery is pleased to host & celebrate.');
        expect(tags.ogType).toBe('article');
        expect(tags.jsonLd).toMatchObject({ '@type': 'NewsArticle', datePublished: post.publishedAt });
    });

    const home: HomePage = {
        bgImage: '/media/images/nada-miami-2026/privacy-whitespace.jpg', bgImageMobile: null, bgFocalPoint: '50% 50%',
        headline: 'Noelle Africh', subline: 'NADA Miami', extraText: null, startsOn: null, endsOn: null, textColor: 'black',
        link: { id, slug: 'nada-miami-2026', kind: 'fair', startsOn: '2026-12-01', endsOn: '2026-12-05' },
        seoTitle: null, seoDescription: null, ogImage: null, updatedAt: ts,
    };

    it('home description comes from the splash and linked dates', () => {
        const tags = buildMeta({ kind: 'home', home }, { siteUrl });
        expect(tags.title).toBe(SITE_NAME);
        expect(tags.description).toBe('Noelle Africh: NADA Miami. December 1st — 5th, 2026');
        expect(tags.image).toBe(`${siteUrl}/media/images/nada-miami-2026/privacy-whitespace.jpg`);
    });

    it('static pages and 404', () => {
        expect(buildMeta({ kind: 'static', path: '/about' }, { siteUrl }).title).toBe(`About — ${SITE_NAME}`);
        const nf = buildMeta({ kind: 'not-found', path: '/x' }, { siteUrl });
        expect(nf.status).toBe(404);
        expect(nf.robots).toBe('noindex');
    });
});

describe('renderHead', () => {
    it('escapes content and cannot break out of JSON-LD', () => {
        const html = renderHead(
            buildMeta({ kind: 'exhibition', exhibition: exhibition({ title: '"Quotes" & <tags></script>' }) }, { siteUrl }),
        );
        expect(html).toContain('&quot;Quotes&quot; &amp; &lt;tags&gt;');
        expect(html).not.toContain('</script><');
        expect(html.match(/<\/script>/g)).toHaveLength(1);
        expect(html).toContain('<meta property="og:image" content="https://www.twelvetengallery.com/media/images/signal/hero.jpg" />');
    });
});

describe('text helpers', () => {
    it('truncates at word boundaries', () => {
        expect(truncate('one two three four five six', 20)).toBe('one two three four…');
        expect(truncate('short', 12)).toBe('short');
    });
    it('decodes entities', () => expect(htmlToText('<p>A&nbsp;&amp;&#8217;B</p>')).toBe('A &’B'));
});
