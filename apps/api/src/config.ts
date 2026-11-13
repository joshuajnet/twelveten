import { z } from 'zod';

const schema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().min(1),
    /** Max connections per process. Lambda uses 1. */
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(5),
    DATABASE_SSL: z
        .enum(['true', 'false'])
        .default('false')
        .transform((v) => v === 'true'),
    SITE_URL: z.url().default('http://localhost:5173'),
    PORT: z.coerce.number().int().positive().default(3000),
});

export type Config = z.infer<typeof schema>;

let cached: Config | undefined;

export function config(): Config {
    cached ??= schema.parse(process.env);
    return cached;
}

/** For tests that change env between cases. */
export function resetConfig(): void {
    cached = undefined;
}
