import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { REDIRECTS } from '@twelveten/shared';

// Load the CloudFront Function source and evaluate its `handler`.
const source = readFileSync(new URL('../cloudfront/viewer-request.js', import.meta.url), 'utf8');
const handler = new Function(`${source}; return handler;`)() as (e: { request: { uri: string } }) => { uri?: string; statusCode?: number; headers?: Record<string, { value: string }> };
const run = (uri: string) => handler({ request: { uri } });

describe('CloudFront viewer-request function', () => {
    it.each([
        ['/', '/index.html'],
        ['/exhibitions', '/exhibitions/index.html'],
        ['/exhibitions/africh-signal', '/exhibitions/africh-signal/index.html'],
        ['/exhibitions/africh-signal/', '/exhibitions/africh-signal/index.html'],
        ['/news/7-1-2026', '/news/7-1-2026/index.html'],
        ['/assets/index-abc.js', '/assets/index-abc.js'],
        ['/sitemap.xml', '/sitemap.xml'],
        ['/admin/login', '/index.html'],
    ])('%s → %s', (uri, expected) => expect(run(uri).uri).toBe(expected));

    it('redirects legacy URLs permanently, matching the shared route table', () => {
        for (const [from, to] of Object.entries(REDIRECTS)) {
            const res = run(from);
            expect(res.statusCode).toBe(301);
            expect(res.headers?.location?.value).toBe(to);
        }
        expect(run('/admin').headers?.location?.value).toBe('/admin/login');
    });
});
