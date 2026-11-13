import { buildMeta, matchRoute, normalizePath, renderHead, type HeadTags, type MetaInput } from '@twelveten/shared';
import type { DB } from '../db/index.ts';
import { getExhibition, getHome, getNews, listExhibitions } from '../content/queries.ts';

export interface PageHead {
    path: string;
    tags: HeadTags;
    html: string;
}

/** Resolve a site path to its meta input using published content only. */
async function metaInput(db: DB, path: string): Promise<MetaInput> {
    const route = matchRoute(path);
    switch (route.name) {
        case 'home': {
            const home = await getHome(db);
            return home ? { kind: 'home', home } : { kind: 'static', path: '/' };
        }
        case 'exhibition':
        case 'fair': {
            const e = await getExhibition(db, route.slug, route.name);
            return e ? { kind: 'exhibition', exhibition: e } : { kind: 'not-found', path };
        }
        case 'news-item': {
            const post = await getNews(db, route.slug);
            return post ? { kind: 'news-item', post } : { kind: 'not-found', path };
        }
        case 'exhibitions':
        case 'fairs': {
            const [latest] = await listExhibitions(db, route.name === 'fairs' ? 'fair' : 'exhibition');
            return { kind: 'static', path: `/${route.name}`, image: latest ? (latest.thumbnail ?? latest.heroImage) : null };
        }
        case 'about':
        case 'news':
        case 'beech-von-sternberg-interview':
            return { kind: 'static', path: normalizePath(path) };
        case 'redirect':
            return { kind: 'static', path: route.to };
        default:
            return { kind: 'not-found', path };
    }
}

export async function headFor(db: DB, path: string, siteUrl: string): Promise<PageHead> {
    const clean = normalizePath(path);
    const tags = buildMeta(await metaInput(db, clean), { siteUrl });
    return { path: clean, tags, html: renderHead(tags) };
}

export const HEAD_PLACEHOLDER = '<!--app-head-->';

/** Insert head tags into the page shell. */
export function injectHead(template: string, headHtml: string): string {
    if (!template.includes(HEAD_PLACEHOLDER)) throw new Error(`Page template is missing ${HEAD_PLACEHOLDER}`);
    return template.replace(HEAD_PLACEHOLDER, headHtml);
}

/** Every public path that should exist as a prerendered page. */
export async function allPaths(db: DB): Promise<string[]> {
    const [exhibitions, news] = await Promise.all([
        listExhibitions(db, undefined),
        db.selectFrom('news_posts').select('slug').where('published', '=', true).execute(),
    ]);
    return [
        '/',
        '/about',
        '/exhibitions',
        '/fairs',
        '/news',
        '/documents/beech-von-sternberg-interview',
        ...exhibitions.map((e) => (e.kind === 'fair' ? `/fairs/${e.slug}` : `/exhibitions/${e.slug}`)),
        ...news.map((n) => `/news/${n.slug}`),
    ];
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function sitemapXml(db: DB, siteUrl: string): Promise<string> {
    const base = siteUrl.replace(/\/+$/, '');
    const [exhibitions, news] = await Promise.all([
        db.selectFrom('exhibitions').select(['slug', 'kind', 'updated_at']).where('published', '=', true).execute(),
        db.selectFrom('news_posts').select(['slug', 'updated_at']).where('published', '=', true).execute(),
    ]);
    const urls: { loc: string; lastmod?: string }[] = [
        { loc: '/' },
        { loc: '/about' },
        { loc: '/exhibitions' },
        { loc: '/fairs' },
        { loc: '/news' },
        { loc: '/documents/beech-von-sternberg-interview' },
        ...exhibitions.map((e) => ({ loc: e.kind === 'fair' ? `/fairs/${e.slug}` : `/exhibitions/${e.slug}`, lastmod: e.updated_at.slice(0, 10) })),
        ...news.map((n) => ({ loc: `/news/${n.slug}`, lastmod: n.updated_at.slice(0, 10) })),
    ];
    const body = urls
        .map((u) => `  <url><loc>${xml(base + (u.loc === '/' ? '/' : u.loc))}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`)
        .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function robotsTxt(siteUrl: string): string {
    return `User-agent: *\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${siteUrl.replace(/\/+$/, '')}/sitemap.xml\n`;
}
