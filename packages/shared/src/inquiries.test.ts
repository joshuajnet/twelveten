import { describe, expect, it } from 'vitest';
import { cleanNote, inquiryCreateSchema, INQUIRY_NOTE_MAX } from './inquiries.ts';

describe('cleanNote', () => {
    it('keeps text and newlines, drops control and invisible characters', () => {
        expect(cleanNote('  Hello\u0007 there​\r\n\r\n\r\n\r\n\r\nIs it framed?  \n')).toBe('Hello there\n\n\nIs it framed?');
        expect(cleanNote('<script>alert(1)</script>')).toBe('<script>alert(1)</script>');
        expect(cleanNote('x'.repeat(1500))).toHaveLength(INQUIRY_NOTE_MAX);
    });

    it('parses an inquiry', () => {
        const ok = inquiryCreateSchema.safeParse({
            item: { kind: 'slide', artworkId: '0190a0b0-0000-7000-8000-000000000001' },
            note: ' hi ',
            email: ' Pat@Example.com ',
        });
        expect(ok.success && ok.data).toMatchObject({ note: 'hi', email: 'pat@example.com' });
        expect(inquiryCreateSchema.safeParse({ item: { kind: 'work', workId: 'x' } }).success).toBe(false);
    });
});

describe('blank identity fields', () => {
    it('count as missing', () => {
        const r = inquiryCreateSchema.safeParse({ item: { kind: 'exhibition', exhibitionId: '0190a0b0-0000-7000-8000-000000000001' }, name: ' ', email: '  ' });
        expect(r.success && [r.data.name, r.data.email]).toEqual([undefined, undefined]);
        expect(inquiryCreateSchema.safeParse({ item: { kind: 'exhibition', exhibitionId: '0190a0b0-0000-7000-8000-000000000001' }, email: 'nope' }).success).toBe(false);
    });
});
