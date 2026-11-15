import type { Context } from 'hono';
import { ZodError, type ZodType } from 'zod';

export class HttpError extends Error {
    constructor(
        readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429,
        message: string,
        readonly details?: unknown,
    ) {
        super(message);
    }
}

/** Parse a JSON body with a zod schema, turning failures into 400s with field messages. */
export async function body<T>(c: Context, schema: ZodType<T>): Promise<T> {
    let raw: unknown;
    try {
        raw = await c.req.json();
    } catch {
        throw new HttpError(400, 'Request body must be JSON');
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) throw validationError(parsed.error);
    return parsed.data;
}

export function validationError(err: ZodError): HttpError {
    return new HttpError(
        400,
        'Invalid input',
        err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
}

/** Map Postgres constraint errors to HTTP errors. */
export function fromDbError(err: unknown): HttpError | null {
    const e = err as { code?: string; constraint?: string; detail?: string };
    if (e?.code === '23505') return new HttpError(409, 'That value is already in use', { constraint: e.constraint });
    if (e?.code === '23514') return new HttpError(400, 'Invalid value', { constraint: e.constraint });
    if (e?.code === '23503') return new HttpError(400, 'Referenced item does not exist', { constraint: e.constraint });
    if (e?.code === '22P02' || e?.code === '22007' || e?.code === '22008') return new HttpError(400, 'Invalid value');
    return null;
}
