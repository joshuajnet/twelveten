import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CreateBucketCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createApp } from '../src/app.ts';
import { migrateToLatest } from '../src/db/migrate.ts';
import { seed } from '../src/db/seed.ts';
import { createS3Publisher, pageKey } from '../src/publish/s3Publisher.ts';
import { headFor, injectHead, sitemapXml } from '../src/publish/head.ts';
import { resetSchema, testDb } from './db.ts';

const db = testDb();
const siteUrl = 'https://www.twelvetengallery.com';
const bucket = `twelveten-test-site-${Date.now()}`;
const client = new S3Client({ region: 'us-east-2', endpoint: process.env.AWS_ENDPOINT_URL ?? 'http://localhost:4566', forcePathStyle: true });
const SHELL = '<!doctype html><html><head><meta charset="UTF-8" />\n<!--app-head-->\n</head><body><div id="app"></div></body></html>';

let s3Available = true;

beforeAll(async () => {
    await resetSchema(db);
    await migrateToLatest(db);
    await seed(db);
    try {
        await client.send(new CreateBucketCommand({ Bucket: bucket, CreateBucketConfiguration: { LocationConstraint: 'us-east-2' } }));
        await client.send(new PutObjectCommand({ Bucket: bucket, Key: '_template.html', Body: SHELL, ContentType: 'text/html' }));
    } catch {
        s3Available = false;
    }
});
afterAll(() => db.destroy());

async function object(key: string): Promise<{ body: string; type?: string; cache?: string } | null> {
    try {
        const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return { body: (await res.Body?.transformToString()) ?? '', type: res.ContentType, cache: res.CacheControl };
    } catch {
        return null;
    }
}

describe('head tags', () => {
    it('describes an exhibition page', async () => {
        const head = await headFor(db, '/exhibitions/africh-signal', siteUrl);
        expect(head.tags.status).toBe(200);
        expect(head.html).toContain('<title>Noelle Africh: Signal — Twelve Ten Gallery</title>');
        expect(head.html).toContain(`<link rel="canonical" href="${siteUrl}/exhibitions/africh-signal" />`);
        expect(head.html).toContain('og:image" content="https://www.twelvetengallery.com/images/signal/africh-signal-square-nomark.jpg"');
        expect(head.html).toContain('"@type":"ExhibitionEvent"');
    });

    it('returns 404 for unknown, unpublished or mismatched pages', async () => {
        expect((await headFor(db, '/exhibitions/nope', siteUrl)).tags.status).toBe(404);
        expect((await headFor(db, '/fairs/africh-signal', siteUrl)).tags.status).toBe(404);
        expect((await headFor(db, '/random', siteUrl)).tags.status).toBe(404);
    });

    it('home describes the splash and its linked fair', async () => {
        const head = await headFor(db, '/', siteUrl);
        expect(head.tags.description).toBe('Noelle Africh: NADA Miami. December 1st — 5th, 2026');
    });

    it('serves head tags at /api/meta', async () => {
        const res = await createApp({ db: () => db, siteUrl }).request('/api/meta?path=/news/7-1-2026');
        const body = (await res.json()) as { status: number; html: string };
        expect(body.status).toBe(200);
        expect(body.html).toContain('"@type":"NewsArticle"');
    });

    it('injects into the shell', () => {
        expect(injectHead(SHELL, '<title>x</title>')).toContain('<head><meta charset="UTF-8" />\n<title>x</title>');
        expect(() => injectHead('<html></html>', 'x')).toThrow(/app-head/);
    });

    it('lists only published pages in the sitemap', async () => {
        await db.updateTable('exhibitions').set({ published: false }).where('slug', '=', 'coldbomb').execute();
        const xml = await sitemapXml(db, siteUrl);
        expect(xml).toContain(`<loc>${siteUrl}/exhibitions/africh-signal</loc>`);
        expect(xml).toContain(`<loc>${siteUrl}/news/7-1-2026</loc>`);
        expect(xml).not.toContain('coldbomb');
        await db.updateTable('exhibitions').set({ published: true }).where('slug', '=', 'coldbomb').execute();
    });
});

describe('S3 publisher (LocalStack)', () => {
    it('prerenders pages, sitemap and robots.txt, and removes pages that disappear', async (ctx) => {
        if (!s3Available) ctx.skip();
        const publisher = createS3Publisher({ db: () => db, client, bucket, siteUrl });
        await publisher.render(['/exhibitions/africh-signal', '/']);

        const page = await object(pageKey('/exhibitions/africh-signal'));
        expect(page?.type).toContain('text/html');
        expect(page?.cache).toContain('max-age=60');
        expect(page?.body).toContain('<title>Noelle Africh: Signal — Twelve Ten Gallery</title>');
        expect((await object('index.html'))?.body).toContain('NADA Miami');
        expect((await object('sitemap.xml'))?.body).toContain('<urlset');
        expect((await object('robots.txt'))?.body).toContain(`Sitemap: ${siteUrl}/sitemap.xml`);

        // Unpublishing removes the prerendered page.
        await db.updateTable('exhibitions').set({ published: false }).where('slug', '=', 'africh-signal').execute();
        await publisher.render(['/exhibitions/africh-signal']);
        await expect(client.send(new HeadObjectCommand({ Bucket: bucket, Key: pageKey('/exhibitions/africh-signal') }))).rejects.toThrow();
        await db.updateTable('exhibitions').set({ published: true }).where('slug', '=', 'africh-signal').execute();
    });

    it('rebuildAll renders every page and deletes stale ones', async (ctx) => {
        if (!s3Available) ctx.skip();
        await client.send(new PutObjectCommand({ Bucket: bucket, Key: 'exhibitions/old-show/index.html', Body: 'old' }));
        const publisher = createS3Publisher({ db: () => db, client, bucket, siteUrl });
        const { pages } = await publisher.rebuildAll();
        expect(pages).toBe(6 + 17 + 24);
        expect(await object('exhibitions/old-show/index.html')).toBeNull();
        expect((await object('news/7-1-2026/index.html'))?.body).toContain('Anatomy of Habit');
    });

    it('does nothing (and does not fail) before the site shell is deployed', async (ctx) => {
        if (!s3Available) ctx.skip();
        await client.send(new PutObjectCommand({ Bucket: bucket, Key: 'about/index.html', Body: 'marker' }));
        const publisher = createS3Publisher({ db: () => db, client, bucket, siteUrl, templateKey: '_missing.html' });
        await expect(publisher.render(['/about'])).resolves.toBeUndefined();
        expect((await object('about/index.html'))?.body).toBe('marker');
    });
});

describe('pageKey', () => {
    it.each([
        ['/', 'index.html'],
        ['/news', 'news/index.html'],
        ['/exhibitions/africh-signal/', 'exhibitions/africh-signal/index.html'],
    ])('%s → %s', (path, key) => expect(pageKey(path)).toBe(key));
});
