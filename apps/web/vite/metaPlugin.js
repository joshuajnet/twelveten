/**
 * Per-page <head> tags.
 * - dev: asks the API (`/api/meta?path=`) for the page's tags, so local pages match production.
 * - build: keeps the `<!--app-head-->` placeholder in `_template.html` (the shell the API prerenders
 *   pages into) and fills `index.html` / `404.html` with site defaults. Viewing rooms and the back
 *   office get their own non-indexed shells (`_room.html`, `_admin.html`; CloudFront serves them for
 *   /rooms/* and /admin*), so a shared room link previews generically, never as the home page.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PLACEHOLDER = '<!--app-head-->';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function defaultHead({ title, description, robots, card = 'summary_large_image', referrer }) {
    return [
        `<title>${esc(title)}</title>`,
        `<meta name="description" content="${esc(description)}" />`,
        `<meta property="og:site_name" content="Twelve Ten Gallery" />`,
        `<meta property="og:title" content="${esc(title)}" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:description" content="${esc(description)}" />`,
        `<meta name="twitter:card" content="${card}" />`,
        robots ? `<meta name="robots" content="${robots}" />` : '',
        referrer ? `<meta name="referrer" content="${referrer}" />` : '',
    ]
        .filter(Boolean)
        .join('\n        ');
}

const SITE = { title: 'Twelve Ten Gallery', description: 'A contemporary art gallery based in Chicago' };
const NOT_FOUND = { title: 'Page not found — Twelve Ten Gallery', description: SITE.description, robots: 'noindex' };
// Private pages: no image and nothing about the room, so link previews stay generic.
const ROOM = {
    title: 'Viewing room — Twelve Ten Gallery',
    description: 'A private viewing room from Twelve Ten Gallery.',
    robots: 'noindex, nofollow',
    card: 'summary',
    referrer: 'same-origin',
};
const ADMIN = { title: 'Admin — Twelve Ten Gallery', description: SITE.description, robots: 'noindex, nofollow', card: 'summary' };

export default function metaPlugin({ apiTarget }) {
    let template = null;
    let outDir = 'dist';
    return {
        name: 'twelveten-meta',
        configResolved(config) {
            outDir = resolve(config.root, config.build.outDir);
        },
        transformIndexHtml: {
            order: 'post',
            async handler(html, ctx) {
                if (!html.includes(PLACEHOLDER)) return html;
                if (ctx.server) {
                    const path = (ctx.originalUrl ?? '/').split('?')[0];
                    try {
                        const res = await fetch(`${apiTarget}/api/meta?path=${encodeURIComponent(path)}`);
                        if (res.ok) return html.replace(PLACEHOLDER, (await res.json()).html);
                    } catch {
                        // API not running: fall back to defaults
                    }
                    return html.replace(PLACEHOLDER, defaultHead(SITE));
                }
                template = html;
                return html.replace(PLACEHOLDER, defaultHead(SITE));
            },
        },
        // index.html is finalised during bundling, so write the extra shells once the build is done.
        closeBundle() {
            if (!template) return;
            writeFileSync(resolve(outDir, '_template.html'), template);
            writeFileSync(resolve(outDir, '404.html'), template.replace(PLACEHOLDER, defaultHead(NOT_FOUND)));
            writeFileSync(resolve(outDir, '_room.html'), template.replace(PLACEHOLDER, defaultHead(ROOM)));
            writeFileSync(resolve(outDir, '_admin.html'), template.replace(PLACEHOLDER, defaultHead(ADMIN)));
        },
    };
}
