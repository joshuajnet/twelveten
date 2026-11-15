import { fileURLToPath } from 'node:url';
import { S3Client } from '@aws-sdk/client-s3';
import { config } from '../config.ts';
import { syncMedia } from './sync.ts';

const arg = (name: string) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? process.argv[i + 1] : undefined;
};

const cfg = config();
const dir = arg('dir') ?? fileURLToPath(new URL('../../../../.media', import.meta.url));
const bucket = arg('bucket') ?? cfg.MEDIA_BUCKET;
const client = new S3Client({ region: cfg.AWS_REGION, endpoint: cfg.AWS_ENDPOINT_URL, forcePathStyle: Boolean(cfg.AWS_ENDPOINT_URL) });

syncMedia({ client, bucket, dir, dryRun: process.argv.includes('--dry-run') }).catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
});
