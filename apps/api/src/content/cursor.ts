import { MAX_PAGE_SIZE, PAGE_SIZE } from '@twelveten/shared';

/** Keyset cursor: the sort value and id of the last item on the previous page. */
export interface Cursor {
    sort: string;
    id: string;
}

export class InvalidCursorError extends Error {}

export function encodeCursor(c: Cursor): string {
    return Buffer.from(JSON.stringify([c.sort, c.id])).toString('base64url');
}

export function decodeCursor(raw: string | undefined | null): Cursor | null {
    if (!raw) return null;
    try {
        const parsed: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
        if (
            Array.isArray(parsed) &&
            parsed.length === 2 &&
            typeof parsed[0] === 'string' &&
            typeof parsed[1] === 'string' &&
            /^[0-9a-f-]{36}$/i.test(parsed[1])
        ) {
            return { sort: parsed[0], id: parsed[1] };
        }
    } catch {
        // fall through
    }
    throw new InvalidCursorError('Invalid cursor');
}

export function parseLimit(raw: string | undefined): number {
    if (!raw) return PAGE_SIZE;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) return PAGE_SIZE;
    return Math.min(n, MAX_PAGE_SIZE);
}
