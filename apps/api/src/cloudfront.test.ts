import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { REDIRECTS } from '@twelveten/shared';
import { createRequire } from 'node:module';

const { withHosts } = createRequire(import.meta.url)('../cloudfront/function-code.cjs') as {
    withHosts: (source: string, domain: string, redirectDomains: string) => string;
};

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
        ['/admin', '/index.html'],
        ['/admin/people', '/index.html'],
        ['/admin/people/0190a1b2-0000-7000-8000-000000000000/artist', '/index.html'],
        ['/admin/works/new', '/index.html'],
        ['/rooms/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde', '/index.html'],
    ])('%s → %s', (uri, expected) => expect(run(uri).uri).toBe(expected));

    it('redirects legacy URLs permanently, matching the shared route table', () => {
        for (const [from, to] of Object.entries(REDIRECTS)) {
            const res = run(from);
            expect(res.statusCode).toBe(301);
            expect(res.headers?.location?.value).toBe(to);
        }
    });

    describe('host redirect', () => {
        type Req = { uri: string; headers?: Record<string, { value: string }>; querystring?: Record<string, { value: string; multiValue?: { value: string }[] }> };
        const build = (domain: string, redirects: string) =>
            new Function(`${withHosts(source, domain, redirects)}; return handler;`)() as (e: { request: Req }) => {
                uri?: string;
                statusCode?: number;
                headers?: Record<string, { value: string }>;
            };
        const prod = build('www.twelvetengallery.com', 'twelvetengallery.com');
        const req = (host: string, uri: string, querystring: Req['querystring'] = {}) => ({ request: { uri, headers: { host: { value: host } }, querystring } });

        it('sends the bare domain to the same path on www, keeping the query string', () => {
            const res = prod(req('twelvetengallery.com', '/exhibitions/africh-signal', { a: { value: '1' }, b: { value: '' } }));
            expect(res.statusCode).toBe(301);
            expect(res.headers?.location?.value).toBe('https://www.twelvetengallery.com/exhibitions/africh-signal?a=1&b');
        });

        it('keeps repeated query parameters', () => {
            const res = prod(req('TwelveTenGallery.com', '/', { t: { value: 'x', multiValue: [{ value: 'x' }, { value: 'y' }] } }));
            expect(res.headers?.location?.value).toBe('https://www.twelvetengallery.com/?t=x&t=y');
        });

        it('serves www and the CloudFront address normally', () => {
            expect(prod(req('www.twelvetengallery.com', '/exhibitions')).uri).toBe('/exhibitions/index.html');
            expect(prod(req('d3uzbcug6mietg.cloudfront.net', '/')).uri).toBe('/index.html');
        });

        it('never redirects when no domain is configured', () => {
            const none = build('', 'twelvetengallery.com');
            expect(none(req('twelvetengallery.com', '/')).uri).toBe('/index.html');
        });
    });
});
