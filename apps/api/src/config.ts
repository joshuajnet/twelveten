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
    /** Signs session cookies. Required outside tests; at least 32 characters. */
    BETTER_AUTH_SECRET: z.string().min(32).optional(),
    PORT: z.coerce.number().int().positive().default(3000),
    AWS_REGION: z.string().default('us-east-2'),
    /** Custom AWS endpoint (LocalStack in development). */
    AWS_ENDPOINT_URL: z.url().optional(),
    MEDIA_BUCKET: z.string().default('twelveten-local-media'),
    SITE_BUCKET: z.string().default('twelveten-local-site'),
    /** Path the media bucket is served under on the site. */
    MEDIA_PUBLIC_PREFIX: z.string().default('/media'),
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
