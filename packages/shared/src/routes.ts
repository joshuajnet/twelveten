/** Route table shared by the Vue router, the prerenderer and the meta builder. */

export type RouteMatch =
    | { name: 'home' }
    | { name: 'about' }
    | { name: 'exhibitions' }
    | { name: 'fairs' }
    | { name: 'news' }
    | { name: 'news-item'; slug: string }
    | { name: 'exhibition'; slug: string }
    | { name: 'fair'; slug: string }
    | { name: 'beech-von-sternberg-interview' }
    | { name: 'redirect'; to: string }
    | { name: 'not-found' };

/** Legacy aliases kept working. */
export const REDIRECTS: Record<string, string> = {
    '/the-veil': '/exhibitions/the-veil',
    '/exhibitions/the-vei': '/exhibitions/the-veil',
};

const STATIC: Record<string, RouteMatch> = {
    '/': { name: 'home' },
    '/about': { name: 'about' },
    '/exhibitions': { name: 'exhibitions' },
    '/fairs': { name: 'fairs' },
    '/news': { name: 'news' },
    '/documents/beech-von-sternberg-interview': { name: 'beech-von-sternberg-interview' },
};

const SLUG = '([a-z0-9]+(?:-[a-z0-9]+)*)';
const DYNAMIC: [RegExp, (slug: string) => RouteMatch][] = [
    [new RegExp(`^/exhibitions/${SLUG}$`), (slug) => ({ name: 'exhibition', slug })],
    [new RegExp(`^/fairs/${SLUG}$`), (slug) => ({ name: 'fair', slug })],
    [new RegExp(`^/news/${SLUG}$`), (slug) => ({ name: 'news-item', slug })],
];

export function normalizePath(path: string): string {
    const clean = path.split(/[?#]/)[0] ?? '/';
    return clean.length > 1 ? clean.replace(/\/+$/, '') : '/';
}

export function matchRoute(rawPath: string): RouteMatch {
    const path = normalizePath(rawPath);
    const redirect = REDIRECTS[path];
    if (redirect) return { name: 'redirect', to: redirect };
    const staticMatch = STATIC[path];
    if (staticMatch) return staticMatch;
    for (const [re, build] of DYNAMIC) {
        const m = re.exec(path);
        if (m?.[1]) return build(m[1]);
    }
    return { name: 'not-found' };
}

export function exhibitionPath(e: { kind: 'exhibition' | 'fair'; slug: string }): string {
    return e.kind === 'fair' ? `/fairs/${e.slug}` : `/exhibitions/${e.slug}`;
}

export const newsPath = (slug: string) => `/news/${slug}`;
