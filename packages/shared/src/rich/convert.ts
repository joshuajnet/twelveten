import { generateHTML } from '@tiptap/html';
import type { RichDoc } from '../content.ts';
import { richExtensions } from './extensions.ts';

/** Render a stored rich document to HTML in the browser (Node: use rich/server). */
export function richToHtml(doc: RichDoc): string {
    return generateHTML(doc as Parameters<typeof generateHTML>[0], richExtensions());
}
