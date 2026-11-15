import { generateHTML, generateJSON } from '@tiptap/html';
import type { RichDoc } from '../content.ts';
import { richExtensions, type RichOptions } from './extensions.ts';

/** Render a stored rich document to HTML in the browser (Node: use rich/server). */
export function richToHtml(doc: RichDoc): string {
    return generateHTML(doc as Parameters<typeof generateHTML>[0], richExtensions());
}

/** Parse HTML into a rich document in the browser (Node: use rich/server). */
export function htmlToRichBrowser(html: string, opts: RichOptions = {}): RichDoc {
    return generateJSON(html, richExtensions(opts)) as RichDoc;
}
