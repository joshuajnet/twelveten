import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { formatDate, type RichDoc, type RichNode } from '@twelveten/shared';
import { pdfmake } from '../lib/pdf.ts';

type Inline = { text: string; bold?: boolean; italics?: boolean; link?: string; decoration?: 'underline' };

function inlines(nodes: RichNode[] | undefined, base: { italics?: boolean } = {}): Inline[] {
    const out: Inline[] = [];
    for (const n of nodes ?? []) {
        if (n.type === 'hardBreak') {
            out.push({ text: '\n' });
            continue;
        }
        if (n.type !== 'text' || !n.text) continue;
        const marks = new Set((n.marks ?? []).map((m) => m.type));
        const href = n.marks?.find((m) => m.type === 'link')?.attrs?.href;
        const item: Inline = { text: n.text };
        if (marks.has('bold')) item.bold = true;
        if (marks.has('italic') || base.italics) item.italics = true;
        if (typeof href === 'string' && /^(https?:|mailto:)/i.test(href)) {
            item.link = href;
            item.decoration = 'underline';
        }
        out.push(item);
    }
    return out;
}

function blocks(nodes: RichNode[] | undefined): Content[] {
    const out: Content[] = [];
    for (const n of nodes ?? []) {
        switch (n.type) {
            case 'paragraph': {
                const variant = n.attrs?.variant;
                const text = inlines(n.content, { italics: variant === 'italic' });
                // Empty paragraphs keep their vertical space, as in the editor.
                if (!text.length) out.push({ text: ' ', style: 'p' });
                else if (variant === 'lead') out.push({ text, style: 'heading' });
                else out.push({ text, style: 'p' });
                break;
            }
            case 'bulletList':
            case 'orderedList': {
                const items = (n.content ?? []).map((li) => ({ stack: blocks(li.content) }));
                out.push(n.type === 'bulletList' ? { ul: items, style: 'list' } : { ol: items, style: 'list' });
                break;
            }
            case 'bio':
                out.push(...blocks(n.content));
                break;
            case 'figure': {
                const caption = inlines(n.content);
                if (caption.length) out.push({ text: caption, style: 'caption' });
                break;
            }
            default:
                // Video, press list and anything unknown have no place in a printed CV.
                break;
        }
    }
    return out;
}

export interface CvPerson {
    name: string;
    birthDate: string | null;
    birthPlace: string | null;
    website: string | null;
}

export function cvDocument(person: CvPerson, cv: RichDoc): TDocumentDefinitions {
    const born = [person.birthDate ? formatDate(person.birthDate) : null, person.birthPlace].filter(Boolean).join(', ');
    const body = blocks(cv.content);
    return {
        info: { title: `${person.name} — CV`, author: 'Twelve Ten', creator: 'Twelve Ten' },
        pageSize: 'LETTER',
        pageMargins: [64, 64, 64, 64],
        defaultStyle: { font: 'Helvetica', fontSize: 10, lineHeight: 1.3 },
        content: [
            { text: person.name, style: 'name' },
            ...(born ? [{ text: `b. ${born}`, style: 'meta' } as Content] : []),
            ...(person.website ? [{ text: person.website, link: person.website, style: 'meta' } as Content] : []),
            { text: ' ', margin: [0, 6, 0, 0] },
            ...(body.length ? body : [{ text: 'No CV yet.', italics: true, color: '#666666' } as Content]),
        ],
        footer: (page, pages) => ({ text: `${person.name} — ${page} / ${pages}`, alignment: 'center', fontSize: 8, color: '#888888', margin: [0, 24, 0, 0] }),
        styles: {
            name: { fontSize: 18, bold: true, margin: [0, 0, 0, 4] },
            meta: { fontSize: 10, color: '#444444' },
            heading: { fontSize: 11, bold: true, margin: [0, 12, 0, 4] },
            p: { margin: [0, 0, 0, 4] },
            list: { margin: [0, 0, 0, 6] },
            caption: { fontSize: 9, italics: true, margin: [0, 0, 0, 6] },
        },
    };
}

/** Render the CV as a PDF. */
export async function renderCvPdf(person: CvPerson, cv: RichDoc): Promise<Buffer> {
    return pdfmake.createPdf(cvDocument(person, cv)).getBuffer();
}
