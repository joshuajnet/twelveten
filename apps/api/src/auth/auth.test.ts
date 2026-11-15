import { describe, expect, it } from 'vitest';
import { CLIENT_IP_HEADER, viewerIp, withClientIp } from './auth.ts';

describe('viewerIp', () => {
    it.each([
        ['198.51.100.10:46532', '198.51.100.10'],
        ['2001:db8::1:46532', '2001:db8::1'],
        ['[2001:db8::1]:46532', '2001:db8::1'],
        ['', null],
        [null, null],
    ])('%s → %s', (input, expected) => expect(viewerIp(input)).toBe(expected));
});

describe('withClientIp', () => {
    const post = (headers: Record<string, string>) =>
        new Request('http://x/api/auth/sign-in/email', { method: 'POST', headers, body: JSON.stringify({ email: 'a@b.c' }) });

    it('takes the address from CloudFront, not from the client', async () => {
        const req = withClientIp(post({ 'cloudfront-viewer-address': '203.0.113.7:51000', 'x-forwarded-for': '1.2.3.4, 203.0.113.7', [CLIENT_IP_HEADER]: '9.9.9.9' }));
        expect(req.headers.get(CLIENT_IP_HEADER)).toBe('203.0.113.7');
        expect(await req.json()).toEqual({ email: 'a@b.c' });
    });

    it('drops a client-supplied address when CloudFront sent none', () => {
        expect(withClientIp(post({ [CLIENT_IP_HEADER]: '9.9.9.9' })).headers.get(CLIENT_IP_HEADER)).toBeNull();
    });
});
