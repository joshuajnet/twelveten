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
    /** PEM bundle to verify the database's TLS certificate (the RDS CA bundle in the Lambda image). */
    DATABASE_SSL_CA_FILE: z.string().optional(),
    SITE_URL: z.url().default('http://localhost:5173'),
    /** When set, requests must carry this value in X-Origin-Verify (added by CloudFront), so the
     *  Lambda function URL can't be called directly. */
    ORIGIN_VERIFY_SECRET: z.string().min(16).optional(),
    /** Extra origins allowed to sign in (comma-separated), e.g. the local preview server. */
    TRUSTED_ORIGINS: z
        .string()
        .default('')
        .transform((v) => v.split(',').map((o) => o.trim()).filter(Boolean)),
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
