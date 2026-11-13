/**
 * Uploads the built site (apps/web/dist) to the stage's site bucket and re-renders every page.
 *
 *   npm run build -w apps/web && npm run deploy:site -w apps/api -- --stage dev
 *
 * Hashed assets are cached for a year; HTML and the page shell briefly. The site bucket is read
 * from the CloudFormation stack outputs, so `osls deploy` must have run first.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const arg = (name: string, fallback?: string) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? process.argv[i + 1] : fallback;
};
const stage = arg('stage');
if (!stage) throw new Error('Usage: deploy:site --stage <stage>');
const region = arg('region', process.env.AWS_REGION ?? 'us-east-2');
const dist = arg('dir', fileURLToPath(new URL('../../../web/dist', import.meta.url)))!;

const TYPES: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
    '.txt': 'text/plain; charset=utf-8',
    '.ico': 'image/x-icon',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.woff2': 'font/woff2',
};

function cacheControl(key: string): string {
    if (key.startsWith('assets/')) return 'public, max-age=31536000, immutable';
    if (key === '_template.html') return 'no-store';
    return 'public, max-age=60, stale-while-revalidate=300';
}

async function* walk(dir: string): AsyncGenerator<string> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) yield* walk(full);
        else yield full;
    }
}

const cf = new CloudFormationClient({ region });
const stack = (await cf.send(new DescribeStacksCommand({ StackName: `twelveten-${stage}` }))).Stacks?.[0];
const bucket = stack?.Outputs?.find((o) => o.OutputKey === 'SiteBucketName')?.OutputValue;
if (!bucket) throw new Error(`Stack twelveten-${stage} has no SiteBucketName output — run osls deploy first`);

await stat(join(dist, '_template.html')).catch(() => {
    throw new Error(`${dist}/_template.html is missing — run npm run build -w apps/web first`);
});

const s3 = new S3Client({ region });
let count = 0;
for await (const file of walk(dist)) {
    const key = relative(dist, file).split(sep).join('/');
    await s3.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: await readFile(file),
            ContentType: TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
            CacheControl: cacheControl(key),
        }),
    );
    count++;
}
console.log(`Uploaded ${count} files to s3://${bucket}`);

const lambda = new LambdaClient({ region });
const res = await lambda.send(new InvokeCommand({ FunctionName: `twelveten-${stage}-rebuild` }));
console.log('Re-rendered pages:', new TextDecoder().decode(res.Payload));
