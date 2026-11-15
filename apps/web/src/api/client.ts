import type { Exhibition, ExhibitionKind, ExhibitionSummary, HomePage, NewsPost, Page, PressItem } from '@twelveten/shared';

export class ApiError extends Error {
    constructor(
        readonly status: number,
        message: string,
        /** Server-provided details (e.g. `{ current }` on a 409 conflict). */
        readonly details?: unknown,
    ) {
        super(message);
    }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`/api${path}`, {
        credentials: 'same-origin',
        ...init,
        headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    });
    if (!res.ok) {
        let message = res.statusText;
        let details: unknown;
        try {
            const body = (await res.json()) as { error?: string; details?: unknown };
            message = body.error ?? message;
            details = body.details;
        } catch {
            // non-JSON error body
        }
        throw new ApiError(res.status, message, details);
    }
    return (res.status === 204 ? undefined : await res.json()) as T;
}

/** `?a=1&b=2`, leaving out empty values ('' when nothing is left). */
export const qs = (params: Record<string, string | number | null | undefined>) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') s.set(k, String(v));
    const out = s.toString();
    return out ? `?${out}` : '';
};

/** A JSON request to an admin endpoint (`/api/admin…`). */
export const adminSend = <T>(method: string, path: string, body?: unknown) =>
    request<T>(`/admin${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
    request,
    home: () => request<HomePage>('/home'),
    exhibitions: (kind?: ExhibitionKind) => request<{ items: ExhibitionSummary[] }>(`/exhibitions${qs({ kind })}`).then((r) => r.items),
    exhibition: (slug: string, kind?: ExhibitionKind) => request<Exhibition>(`/exhibitions/${encodeURIComponent(slug)}${qs({ kind })}`),
    news: (cursor?: string | null, limit?: number) => request<Page<NewsPost>>(`/news${qs({ cursor, limit })}`),
    newsPost: (slug: string) => request<NewsPost>(`/news/${encodeURIComponent(slug)}`),
    press: (cursor?: string | null, limit?: number, exhibition?: string) => request<Page<PressItem>>(`/press${qs({ cursor, limit, exhibition })}`),
};
