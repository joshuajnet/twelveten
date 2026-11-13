/**
 * Node-only helpers (uses @tiptap/html's server DOM). Import from '@twelveten/shared/rich/server'.
 */
import { getSchema } from '@tiptap/core';
import { generateHTML, generateJSON } from '@tiptap/html/server';
import type { RichDoc, RichNode } from '../content.ts';
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

/** Drop nodes and marks that the schema doesn't know (rendering would otherwise throw). */
export function pruneUnknown(doc: RichDoc): RichDoc {
    const schema = getSchema(richExtensions());
    const visit = (node: RichNode): RichNode | null => {
        if (!schema.nodes[node.type]) return null;
        const out: RichNode = { ...node };
        if (node.marks) out.marks = node.marks.filter((m) => Boolean(schema.marks[m.type]));
        if (node.content) out.content = node.content.map(visit).filter((n): n is RichNode => n !== null);
        return out;
    };
    return { type: 'doc', content: doc.content.map(visit).filter((n): n is RichNode => n !== null) };
}

/**
 * Normalise an editor-submitted document: unknown nodes/marks are dropped, then it is
 * rendered and re-parsed through the schema so attributes (e.g. link protocols) are validated.
 */
export function sanitizeRichDoc(doc: RichDoc): RichDoc {
    return htmlToRich(richToHtmlServer(pruneUnknown(doc)));
}
