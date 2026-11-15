/**
 * Per-page <head> tags.
 * - dev: asks the API (`/api/meta?path=`) for the page's tags, so local pages match production.
 * - build: keeps the `<!--app-head-->` placeholder in `_template.html` (the shell the API prerenders
 *   pages into) and fills `index.html` / `404.html` with site defaults.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PLACEHOLDER = '<!--app-head-->';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function defaultHead({ title, description, robots }) {
    return [
        `<title>${esc(title)}</title>`,
        `<meta name="description" content="${esc(description)}" />`,
        `<meta property="og:site_name" content="Twelve Ten Gallery" />`,
        `<meta property="og:title" content="${esc(title)}" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:description" content="${esc(description)}" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        robots ? `<meta name="robots" content="${robots}" />` : '',
    ]
        .filter(Boolean)
        .join('\n        ');
}

const SITE = { title: 'Twelve Ten Gallery', description: 'A contemporary art gallery based in Chicago' };
const NOT_FOUND = { title: 'Page not found — Twelve Ten Gallery', description: SITE.description, robots: 'noindex' };

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
        },
    };
}
