import { fileURLToPath } from 'node:url';
import { S3Client } from '@aws-sdk/client-s3';
import { config } from '../config.ts';
import { deriveAll, diskIO, s3IO, withLocalOriginals } from './derive.ts';

/**
 * `npm run media:derive -w apps/api [-- --dry-run] [--force] [--prefix images/] [--bucket …] [--quiet]`:
 * make missing image derivatives for everything in the media bucket (and, in development, the
 * originals in .media that were never synced to the bucket).
 */
const arg = (name: string) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? process.argv[i + 1] : undefined;
};
const flag = (name: string) => process.argv.includes(`--${name}`);

const cfg = config();
const bucket = arg('bucket') ?? cfg.MEDIA_BUCKET;
const client = new S3Client({ region: cfg.AWS_REGION, endpoint: cfg.AWS_ENDPOINT_URL, forcePathStyle: Boolean(cfg.AWS_ENDPOINT_URL) });
const local = cfg.LOCAL_MEDIA_DIR ?? (cfg.AWS_ENDPOINT_URL ? fileURLToPath(new URL('../../../../.media', import.meta.url)) : undefined);
const io = local ? withLocalOriginals(s3IO(client, bucket), diskIO(local)) : s3IO(client, bucket);
const quiet = flag('quiet');

const started = Date.now();
deriveAll(io, { prefix: arg('prefix') ?? '', force: flag('force'), dryRun: flag('dry-run'), log: quiet ? undefined : console.log })
    .then((c) => {
        console.log(`image derivatives: ${c.derived} made, ${c.skipped} already there, ${c.missing} failed (${Math.round((Date.now() - started) / 1000)}s)`);
        if (c.missing) process.exitCode = 1;
    })
    .catch((err: unknown) => {
        console.error(err);
        process.exitCode = 1;
    });
