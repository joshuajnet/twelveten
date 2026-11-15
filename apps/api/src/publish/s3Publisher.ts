import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import type { DB } from '../db/index.ts';
import type { Publisher } from './publisher.ts';
import { allPaths, headFor, injectHead, robotsTxt, sitemapXml } from './head.ts';

export interface S3PublisherOptions {
    db: () => DB;
    client: S3Client;
    bucket: string;
    siteUrl: string;
    /** Key of the page shell uploaded with the site build. */
    templateKey?: string;
}

/** Object key for a site path: '/' → 'index.html', '/news/x' → 'news/x/index.html'. */
export function pageKey(path: string): string {
    const clean = path.replace(/^\/+|\/+$/g, '');
    return clean ? `${clean}/index.html` : 'index.html';
}

const HTML_CACHE = 'public, max-age=60, stale-while-revalidate=300';

/**
 * Writes prerendered pages (page shell + per-page head tags) to the site bucket.
 * Paths that no longer resolve (deleted or unpublished) are removed so CloudFront serves the 404 page.
 */
export function createS3Publisher(opts: S3PublisherOptions): Publisher {
    const templateKey = opts.templateKey ?? '_template.html';
    let template: string | null = null;

    async function loadTemplate(): Promise<string | null> {
        if (template) return template;
        try {
            const res = await opts.client.send(new GetObjectCommand({ Bucket: opts.bucket, Key: templateKey }));
            template = (await res.Body?.transformToString('utf-8')) ?? null;
        } catch (err) {
            if ((err as { name?: string }).name === 'NoSuchKey') {
                console.warn(`publish: ${templateKey} not found in ${opts.bucket}; pages are not prerendered until the site is deployed`);
                return null;
            }
            throw err;
        }
        return template;
    }

    const put = (Key: string, Body: string, ContentType: string) =>
        opts.client.send(new PutObjectCommand({ Bucket: opts.bucket, Key, Body, ContentType, CacheControl: HTML_CACHE }));

    async function writeExtras(db: DB) {
        await Promise.all([
            put('sitemap.xml', await sitemapXml(db, opts.siteUrl), 'application/xml; charset=utf-8'),
            put('robots.txt', robotsTxt(opts.siteUrl), 'text/plain; charset=utf-8'),
        ]);
    }

    async function renderPaths(paths: string[]): Promise<number> {
        const shell = await loadTemplate();
        if (!shell) return 0;
        const db = opts.db();
        const gone: string[] = [];
        let written = 0;
        for (const path of paths) {
            const head = await headFor(db, path, opts.siteUrl);
            if (head.tags.status === 404) {
                gone.push(pageKey(head.path));
                continue;
            }
            await put(pageKey(head.path), injectHead(shell, head.html), 'text/html; charset=utf-8');
            written++;
        }
        if (gone.length) {
            await opts.client.send(new DeleteObjectsCommand({ Bucket: opts.bucket, Delete: { Objects: gone.map((Key) => ({ Key })), Quiet: true } }));
        }
        await writeExtras(db);
        return written;
    }

    return {
        async render(paths) {
            await renderPaths(paths);
        },
        async rebuildAll() {
            const db = opts.db();
            const paths = await allPaths(db);
            const pages = await renderPaths(paths);
            // Remove prerendered pages for content that no longer exists.
            const keep = new Set(paths.map(pageKey));
            const stale: string[] = [];
            for (const prefix of ['exhibitions/', 'fairs/', 'news/']) {
                let token: string | undefined;
                do {
                    const res = await opts.client.send(new ListObjectsV2Command({ Bucket: opts.bucket, Prefix: prefix, ContinuationToken: token }));
                    for (const o of res.Contents ?? []) if (o.Key?.endsWith('/index.html') && !keep.has(o.Key)) stale.push(o.Key);
                    token = res.IsTruncated ? res.NextContinuationToken : undefined;
                } while (token);
            }
            if (stale.length) {
                await opts.client.send(new DeleteObjectsCommand({ Bucket: opts.bucket, Delete: { Objects: stale.map((Key) => ({ Key })), Quiet: true } }));
            }
            return { pages };
        },
    };
}
