import { describe, it, expect } from 'vitest';
import { matchRoute, exhibitionPath, normalizePath } from './routes.ts';

describe('matchRoute', () => {
    it.each([
        ['/', { name: 'home' }],
        ['/about/', { name: 'about' }],
        ['/news?page=2', { name: 'news' }],
        ['/news/7-1-2026', { name: 'news-item', slug: '7-1-2026' }],
        ['/exhibitions/africh-signal', { name: 'exhibition', slug: 'africh-signal' }],
        ['/fairs/nada-miami-2026', { name: 'fair', slug: 'nada-miami-2026' }],
        ['/the-veil', { name: 'redirect', to: '/exhibitions/the-veil' }],
        ['/exhibitions/the-vei', { name: 'redirect', to: '/exhibitions/the-veil' }],
        ['/exhibitions/Bad_Slug', { name: 'not-found' }],
        ['/nope', { name: 'not-found' }],
    ])('%s', (path, expected) => expect(matchRoute(path)).toEqual(expected));

    it('builds paths', () => {
        expect(exhibitionPath({ kind: 'fair', slug: 'nada-miami-2026' })).toBe('/fairs/nada-miami-2026');
        expect(exhibitionPath({ kind: 'exhibition', slug: 'africh-signal' })).toBe('/exhibitions/africh-signal');
        expect(normalizePath('/news/#x')).toBe('/news');
    });
});
