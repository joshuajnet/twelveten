import { describe, it, expect } from 'vitest';
import { htmlToRich, normalizeLegacyHtml, richToHtmlServer as richToHtml } from './server.ts';
import { firstParagraph } from '../text.ts';

describe('rich text schema', () => {
    it('parses legacy page markup', () => {
        const doc = htmlToRich(
            '<p class="italic mb-3">Intro <span class="font-bold">bold</span> and <em>em</em></p>' +
                '<p class="italic text-lg">Press any button to start.</p>' +
                '<ul class="list-disc ml-5 text-sm"><li class="mb-2">one</li></ul>' +
                '<div data-bio><p class="italic mb-3"><span class="font-bold">Artist</span> (b. 1992)</p></div>',
        );
        expect(doc.content.map((n) => n.type)).toEqual(['paragraph', 'paragraph', 'bulletList', 'bio']);
        expect(doc.content[0]?.attrs?.variant).toBe('italic');
        expect(doc.content[1]?.attrs?.variant).toBe('lead');
        expect(JSON.stringify(doc.content[0])).toContain('"bold"');
        expect(firstParagraph(doc)).toBe('Intro bold and em');
    });

    it('turns image + caption paragraphs into figures', () => {
        const html = normalizeLegacyHtml(
            '<p class="mb-3">\n<img\nsrc="/images/a.jpg"\nalt="Alt\ntext"\n/>\n</p>\n<p class="mb-6 text-center font-roboto">Caption\nline.</p>',
        );
        const doc = htmlToRich(html);
        expect(doc.content).toEqual([{ type: 'figure', attrs: { src: '/images/a.jpg', alt: 'Alt text', caption: 'Caption line.' } }]);
        expect(richToHtml(doc)).toContain('<figcaption class="mb-6 text-center font-roboto font-light text-xs">Caption line.</figcaption>');
    });

    it('renders YouTube videos and rejects bad ids', () => {
        const doc = htmlToRich('<div data-video="XaswpDf-jMI"></div><div data-video="javascript:alert(1)"></div>');
        expect(doc.content).toEqual([{ type: 'video', attrs: { youtubeId: 'XaswpDf-jMI' } }]);
        expect(richToHtml(doc)).toContain('src="https://www.youtube.com/embed/XaswpDf-jMI?rel=0&amp;autoplay=0"');
    });

    it('drops anything outside the schema', () => {
        const doc = htmlToRich(
            '<p onclick="steal()">Hi <a href="javascript:alert(1)">bad</a> <a href="https://ok.example">ok</a></p><script>alert(1)</script><iframe src="https://evil"></iframe>',
        );
        const html = richToHtml(doc);
        expect(html).not.toMatch(/onclick|javascript:|<script|evil/);
        expect(html).toContain('href="https://ok.example"');
    });

    it('round-trips through HTML without changes', () => {
        const doc = htmlToRich('<p>One <strong>two</strong></p><div data-bio><p class="italic">Bio</p></div><div data-press-list></div>');
        expect(htmlToRich(richToHtml(doc))).toEqual(doc);
    });
});
