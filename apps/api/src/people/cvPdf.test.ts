import { describe, expect, it } from 'vitest';
import { cvDocument, renderCvPdf } from './cvPdf.ts';

const person = { name: 'Noelle Africh', birthDate: '1990-03-02', birthPlace: 'Tulsa, OK', website: 'https://example.com' };

describe('cvDocument', () => {
    it('maps the rich-text CV to headings, paragraphs, marks, links and lists', () => {
        const def = cvDocument(person, {
            type: 'doc',
            content: [
                { type: 'paragraph', attrs: { variant: 'lead' }, content: [{ type: 'text', text: 'Solo exhibitions' }] },
                {
                    type: 'bulletList',
                    content: [
                        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Signal', marks: [{ type: 'italic' }] }, { type: 'text', text: ', Twelve Ten' }] }] },
                    ],
                },
                { type: 'paragraph', content: [{ type: 'text', text: 'Site', marks: [{ type: 'link', attrs: { href: 'https://x.test' } }, { type: 'bold' }] }] },
                { type: 'paragraph', content: [{ type: 'text', text: 'bad', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] },
                { type: 'video', attrs: { id: 'abc' } },
            ],
        });
        const content = def.content as any[];
        expect(content[0]).toMatchObject({ text: 'Noelle Africh', style: 'name' });
        expect(content[1]).toMatchObject({ text: 'b. March 2nd, 1990, Tulsa, OK' });
        const body = content.slice(4);
        expect(body[0]).toMatchObject({ style: 'heading', text: [{ text: 'Solo exhibitions' }] });
        expect(body[1].ul[0].stack[0].text).toEqual([{ text: 'Signal', italics: true }, { text: ', Twelve Ten' }]);
        expect(body[2].text[0]).toMatchObject({ text: 'Site', bold: true, link: 'https://x.test' });
        expect(body[3].text[0].link).toBeUndefined();
        expect(body).toHaveLength(4);
    });

    it('renders a PDF, including for an empty CV', async () => {
        const pdf = await renderCvPdf({ ...person, birthDate: null, website: null }, { type: 'doc', content: [] });
        expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    });
});
