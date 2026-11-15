import { describe, expect, it } from 'vitest';
import { derivedKey, derivedUrl, imageSrcset, isDerivable, placeholderUrl, zoomUrl } from './media.ts';

describe('media derivatives', () => {
    it('only derives raster /media images', () => {
        expect(isDerivable('/media/uploads/2026/11/a.JPG')).toBe(true);
        expect(isDerivable('/media/images/x/y.png?v=2')).toBe(true);
        expect(isDerivable('/media/uploads/a.svg')).toBe(false);
        expect(isDerivable('/media/uploads/a.gif')).toBe(false);
        expect(isDerivable('/media/derived/uploads/a.jpg/w480.webp')).toBe(false);
        expect(isDerivable('https://example.com/a.jpg')).toBe(false);
        expect(isDerivable(null)).toBe(false);
    });

    it('names derivatives after the original', () => {
        expect(derivedUrl('/media/uploads/2026/11/a.jpg', 'zoom.jpg')).toBe('/media/derived/uploads/2026/11/a.jpg/zoom.jpg');
        expect(derivedKey('media/images/x.png', 'w960.webp')).toBe('media/derived/images/x.png/w960.webp');
        expect(imageSrcset('/media/a.jpg')).toBe(
            '/media/derived/a.jpg/w480.webp 480w, /media/derived/a.jpg/w960.webp 960w, /media/derived/a.jpg/w1600.webp 1600w, /media/derived/a.jpg/w2400.webp 2400w',
        );
        expect(imageSrcset('/media/a.svg')).toBe('');
        expect(placeholderUrl('/media/a.jpg')).toBe('/media/derived/a.jpg/w48.webp');
        expect(zoomUrl('/media/a.gif')).toBeNull();
    });
});

import { richToHtml } from './rich/index.ts';
import { htmlToRich } from './rich/server.ts';

describe('rich-text figures', () => {
    it('render derivatives and keep the original through a round trip', () => {
        const doc = { type: 'doc', content: [{ type: 'figure', attrs: { src: '/media/uploads/a.jpg', alt: 'A', caption: 'Cap' } }] };
        const html = richToHtml(doc as never);
        expect(html).toContain('srcset="/media/derived/uploads/a.jpg/w480.webp 480w');
        expect(html).toContain('data-original="/media/uploads/a.jpg"');
        expect(htmlToRich(html).content[0]!.attrs!.src).toBe('/media/uploads/a.jpg');
        expect(richToHtml({ type: 'doc', content: [{ type: 'figure', attrs: { src: '/media/a.svg', alt: '', caption: '' } }] } as never)).not.toContain('srcset');
    });
});
