import type { RichDoc, RichNode } from './content.ts';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…' };

/** Strip tags and decode common entities; collapse whitespace. */
export function htmlToText(html: string): string {
    return html
        .replace(/<\s*(br|\/p|\/div|\/h\d)\s*\/?>/gi, ' ')
        .replace(/<[^>]*>/g, '')
        .replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (m, code: string) => {
            if (code[0] === '#') {
                const n = code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
                return Number.isFinite(n) ? String.fromCodePoint(n) : m;
            }
            return ENTITIES[code.toLowerCase()] ?? m;
        })
        .replace(/\s+/g, ' ')
        .trim();
}

function nodeText(node: RichNode): string {
    if (node.type === 'text') return node.text ?? '';
    if (node.type === 'hardBreak') return ' ';
    return (node.content ?? []).map(nodeText).join('');
}

/** Text of the first non-empty paragraph in a rich document. */
export function firstParagraph(doc: RichDoc): string {
    for (const node of doc.content) {
        if (node.type === 'paragraph') {
            const text = nodeText(node).replace(/\s+/g, ' ').trim();
            if (text) return text;
        }
    }
    return '';
}

/** First non-empty paragraph of an HTML string. */
export function firstHtmlParagraph(html: string): string {
    for (const m of html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
        const text = htmlToText(m[1] ?? '');
        if (text) return text;
    }
    return htmlToText(html);
}

/** Truncate at a word boundary, adding an ellipsis, so the result is at most `max` characters. */
export function truncate(text: string, max: number): string {
    if (text.length <= max) return text;
    const cut = text.slice(0, max - 1);
    const lastSpace = cut.lastIndexOf(' ');
    return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:—–-]+$/, '')}…`;
}

export function escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
