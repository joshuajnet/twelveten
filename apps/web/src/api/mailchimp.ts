/**
 * Subscribes through Mailchimp's embedded-form JSON endpoint. Mailchimp sends no CORS headers,
 * so this is JSONP: `/subscribe/post?` becomes `/subscribe/post-json?` with a `c=` callback.
 */
export interface SubscribeResult {
    ok: boolean;
    message: string;
}

let seq = 0;

/** Mailchimp messages may start with a field index ("0 - ") and contain HTML links; show plain text. */
export function cleanMessage(msg: string): string {
    const text = new DOMParser().parseFromString(msg, 'text/html').body.textContent ?? '';
    return text.replace(/^\d+\s*-\s*/, '').trim();
}

export function jsonpUrl(action: string, data: FormData, callback: string): string {
    const url = new URL(action.replace('/subscribe/post?', '/subscribe/post-json?'));
    for (const [k, v] of data) if (typeof v === 'string') url.searchParams.append(k, v);
    url.searchParams.set('c', callback);
    return url.toString();
}

export function mailchimpSubscribe(action: string, data: FormData, timeoutMs = 15_000): Promise<SubscribeResult> {
    return new Promise((resolve, reject) => {
        const callback = `__ttMailchimp${Date.now()}_${seq++}`;
        const script = document.createElement('script');
        const w = window as unknown as Record<string, unknown>;
        const cleanup = () => {
            clearTimeout(timer);
            delete w[callback];
            script.remove();
        };
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error('Mailchimp timed out'));
        }, timeoutMs);
        w[callback] = (res: { result?: string; msg?: string }) => {
            cleanup();
            const ok = res.result === 'success';
            resolve({ ok, message: cleanMessage(res.msg ?? '') || (ok ? 'Thank you for subscribing!' : 'Something went wrong. Please try again.') });
        };
        script.src = jsonpUrl(action, data, callback);
        script.onerror = () => {
            cleanup();
            reject(new Error('Mailchimp request failed'));
        };
        document.head.appendChild(script);
    });
}
