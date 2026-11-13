/**
 * Node-only helpers (uses @tiptap/html's server DOM). Import from '@twelveten/shared/rich/server'.
 */
import { generateHTML, generateJSON } from '@tiptap/html/server';
import type { RichDoc } from '../content.ts';
import { richExtensions } from './extensions.ts';

/**
 * Parse HTML into a rich document. Anything not in the schema (scripts, unknown tags,
 * event-handler attributes, disallowed link protocols) is dropped, so this doubles as the sanitizer.
 */
export function htmlToRich(html: string): RichDoc {
    return generateJSON(html, richExtensions()) as RichDoc;
}

/**
 * Rewrites legacy page markup into the schema's HTML:
 *   <p><img …/></p><p class="… text-center …">caption</p>  →  <figure><img …/><figcaption>caption</figcaption></figure>
 */
export function normalizeLegacyHtml(html: string): string {
    return html
        .replace(
            /<p[^>]*>\s*(<img[\s\S]*?\/?>)\s*<\/p>\s*<p[^>]*\btext-center\b[^>]*>([\s\S]*?)<\/p>/g,
            (_m, img: string, caption: string) => `<figure>${img}<figcaption>${caption.replace(/\s+/g, ' ').trim()}</figcaption></figure>`,
        )
        .replace(/<p[^>]*>\s*(<img[\s\S]*?\/?>)\s*<\/p>/g, (_m, img: string) => `<figure>${img}</figure>`);
}

/** Render a stored rich document to HTML in Node. */
export function richToHtmlServer(doc: RichDoc): string {
    return generateHTML(doc as Parameters<typeof generateHTML>[0], richExtensions());
}
