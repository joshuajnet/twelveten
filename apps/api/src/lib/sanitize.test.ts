import { describe, expect, it } from 'vitest';
import { sanitizeNewsHtml } from './sanitize.ts';

describe('sanitizeNewsHtml', () => {
    it('keeps allowed markup and adds rel to new-tab links', () => {
        expect(sanitizeNewsHtml('<p>Hi <em>there</em> <a href="https://x.example" target="_blank">x</a></p>')).toBe(
            '<p>Hi <em>there</em> <a href="https://x.example" target="_blank" rel="noopener noreferrer">x</a></p>',
        );
    });

    it('removes scripts, handlers and javascript: links', () => {
        const out = sanitizeNewsHtml('<p onclick="x()">a<script>alert(1)</script><a href="javascript:alert(1)">b</a><img src="x" onerror="y()"></p>');
        expect(out).not.toMatch(/script|onclick|onerror|javascript:/);
    });

    it('repairs malformed legacy markup', () => {
        expect(sanitizeNewsHtml('<p><A href="/docs/x.pdf">Press</a></p>')).toBe('<p><a href="/docs/x.pdf">Press</a></p>');
        expect(sanitizeNewsHtml('<p><a href="https://n.example" targe="_blank">view<a/></p>')).toBe('<p><a href="https://n.example">view</a></p>');
    });
});
