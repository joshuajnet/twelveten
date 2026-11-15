/**
 * One-time copy of the local gallery data to a deployed stage (the only way prod gets data):
 *
 *   npm run data:push -w apps/api -- --stage prod --yes [--force]
 *
 * 1. Copies back-office uploads (`media/uploads/*`) from the local LocalStack media bucket to the
 *    stage's media bucket (skipping ones already there); the media function makes their derivatives.
 * 2. Exports every local table except sign-in state (see db/transfer.ts), gzips it in memory and
 *    uploads it to the private `import/` prefix of the media bucket. Nothing is written to disk.
 * 3. Invokes the stage's `migrate` function to replace the stage's data with it; the function
 *    deletes the upload afterwards. A stage that was already imported refuses unless --force.
 * 4. Re-renders the site pages.
 *
 * Local settings come from .env.local; AWS access from your CLI profile (e.g. AWS_PROFILE=twelveten).
 * Create a stage admin afterwards: npx osls invoke -f migrate --stage prod -d '{"admin":{"email":"…"}}'
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createDb } from '../db/index.ts';
import { exportData } from '../db/transfer.ts';

const arg = (name: string, fallback?: string) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? process.argv[i + 1] : fallback;
};
const flag = (name: string) => process.argv.includes(`--${name}`);

const stage = arg('stage');
if (!stage || !/^[a-z0-9-]+$/.test(stage)) throw new Error('Usage: data:push --stage <stage> --yes [--force]');
if (!flag('yes')) throw new Error(`This replaces all data on "${stage}" with your local database. Re-run with --yes to confirm.`);
const force = flag('force');

// Local settings, read without touching process.env so the AWS clients below can't pick up
// LocalStack's endpoint or test credentials.
const envFile = fileURLToPath(new URL('../../../../.env.local', import.meta.url));
const local = Object.fromEntries(
    readFileSync(envFile, 'utf8')
        .split('\n')
        .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
        .filter((m): m is RegExpMatchArray => Boolean(m))
        .map((m) => [m[1]!, m[2]!.trim()]),
) as Record<string, string | undefined>;
delete process.env.AWS_ENDPOINT_URL;

const region = arg('region', 'us-east-2')!;
const localS3 = new S3Client({
    region,
    endpoint: local.AWS_ENDPOINT_URL ?? 'http://localhost:4566',
    forcePathStyle: true,
    credentials: { accessKeyId: local.AWS_ACCESS_KEY_ID ?? 'test', secretAccessKey: local.AWS_SECRET_ACCESS_KEY ?? 'test' },
});
const localBucket = local.MEDIA_BUCKET ?? 'twelveten-local-media';
const s3 = new S3Client({ region });
const lambda = new LambdaClient({ region });

const stack = (await new CloudFormationClient({ region }).send(new DescribeStacksCommand({ StackName: `twelveten-${stage}` })).catch(() => null))?.Stacks?.[0];
const bucket = stack?.Outputs?.find((o) => o.OutputKey === 'MediaBucketName')?.OutputValue;
if (!bucket) throw new Error(`Stack twelveten-${stage} isn't deployed yet; deploy it first (CI or osls deploy).`);

async function invoke(fn: string, payload: unknown): Promise<unknown> {
    const res = await lambda.send(new InvokeCommand({ FunctionName: `twelveten-${stage}-${fn}`, Payload: new TextEncoder().encode(JSON.stringify(payload)) }));
    const body = res.Payload ? JSON.parse(new TextDecoder().decode(res.Payload)) : null;
    if (res.FunctionError) throw new Error(`${fn} failed: ${body?.errorMessage ?? res.FunctionError}`);
    return body;
}

// 1. Uploads.
let copied = 0;
let present = 0;
let token: string | undefined;
do {
    const page = await localS3.send(new ListObjectsV2Command({ Bucket: localBucket, Prefix: 'media/uploads/', ContinuationToken: token }));
    for (const { Key } of page.Contents ?? []) {
        if (!Key) continue;
        const exists = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key })).then(() => true, () => false);
        if (exists) {
            present++;
            continue;
        }
        const obj = await localS3.send(new GetObjectCommand({ Bucket: localBucket, Key }));
        await s3.send(new PutObjectCommand({ Bucket: bucket, Key, Body: await obj.Body!.transformToByteArray(), ContentType: obj.ContentType, CacheControl: obj.CacheControl }));
        copied++;
    }
    token = page.NextContinuationToken;
} while (token);
console.log(`Uploads: ${copied} copied, ${present} already there.`);

// 2. Export (in memory) and upload to the private import/ prefix.
const localUrl = local.DATABASE_URL ?? 'postgres://twelveten:twelveten@localhost:5432/twelveten';
process.env.DATABASE_URL ??= localUrl; // the app config requires it; only the local database is opened
const db = createDb(localUrl, 1);
const dump = await exportData(db).finally(() => db.destroy());
const rows = Object.values(dump.tables).reduce((n, t) => n + t.length, 0);
const key = `import/${dump.exportedAt.replace(/[:.]/g, '-')}.json.gz`;
const put = await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: gzipSync(JSON.stringify(dump)), ContentType: 'application/gzip' }));
console.log(`Exported ${Object.keys(dump.tables).length} tables, ${rows} rows (schema ${dump.migration}).`);

// 3. Import on the stage; the function deletes the upload, and so do we if it never ran.
try {
    const result = (await invoke('migrate', { import: { key, versionId: put.VersionId, force } })) as { import?: Record<string, number> };
    const counts = Object.entries(result.import ?? {}).filter(([, n]) => n > 0);
    console.log(`Imported into ${stage}: ${counts.map(([t, n]) => `${t} ${n}`).join(', ')}`);
} finally {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key, VersionId: put.VersionId })).catch(() => {});
}

// 4. Pages.
await invoke('rebuild', {});
console.log('Pages re-rendered. Next, create an admin for this stage:');
console.log(`  npx osls invoke -f migrate --stage ${stage} -d '{"admin":{"email":"you@example.com","name":"You"}}'`);
