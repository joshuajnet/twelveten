import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanMessage, jsonpUrl, mailchimpSubscribe } from '../mailchimp';

const ACTION = 'https://example.us11.list-manage.com/subscribe/post?u=abc&id=def&f_id=ghi';

function form(email: string) {
    const d = new FormData();
    d.append('EMAIL', email);
    d.append('b_abc_def', '');
    return d;
}

// Capture the JSONP <script> instead of loading it.
let script: HTMLScriptElement | null = null;
beforeEach(() => {
    script = null;
    vi.spyOn(document.head, 'appendChild').mockImplementation(<T extends Node>(node: T) => {
        script = node as unknown as HTMLScriptElement;
        return node;
    });
});
afterEach(() => vi.restoreAllMocks());

function respond(res: object) {
    const cb = new URL(script!.src).searchParams.get('c')!;
    (window as unknown as Record<string, (r: object) => void>)[cb]!(res);
    return cb;
}

describe('mailchimp', () => {
    it('builds the JSONP url from the form action', () => {
        const url = new URL(jsonpUrl(ACTION, form('a+b@example.com'), 'cb1'));
        expect(url.pathname).toBe('/subscribe/post-json');
        expect(url.searchParams.get('u')).toBe('abc');
        expect(url.searchParams.get('EMAIL')).toBe('a+b@example.com');
        expect(url.searchParams.get('b_abc_def')).toBe('');
        expect(url.searchParams.get('c')).toBe('cb1');
    });

    it('turns Mailchimp messages into plain text', () => {
        expect(cleanMessage('0 - Please enter a value')).toBe('Please enter a value');
        expect(cleanMessage('x@y.com is already subscribed. <a href="https://x">Click here to update your profile</a>')).toBe(
            'x@y.com is already subscribed. Click here to update your profile',
        );
    });

    it('resolves with the callback result and cleans up', async () => {
        const pending = mailchimpSubscribe(ACTION, form('a@b.com'));
        const cb = respond({ result: 'success', msg: 'Thank you for subscribing!' });
        await expect(pending).resolves.toEqual({ ok: true, message: 'Thank you for subscribing!' });
        expect(cb in window).toBe(false);
    });

    it('reports errors and times out', async () => {
        const pending = mailchimpSubscribe(ACTION, form('bad'));
        respond({ result: 'error', msg: '0 - An email address must contain a single @.' });
        await expect(pending).resolves.toEqual({ ok: false, message: 'An email address must contain a single @.' });
        await expect(mailchimpSubscribe(ACTION, form('a@b.com'), 10)).rejects.toThrow(/timed out/);
    });
});
