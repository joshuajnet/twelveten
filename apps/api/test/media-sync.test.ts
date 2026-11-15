import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CreateBucketCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { syncMedia } from '../src/media/sync.ts';

const client = new S3Client({ region: 'us-east-2', endpoint: process.env.AWS_ENDPOINT_URL, forcePathStyle: true });

describe('syncMedia (LocalStack)', () => {
    it('uploads new files once and skips them on the next run', async (ctx) => {
        const bucket = `twelveten-test-media-${Date.now()}`;
        try {
            await client.send(new CreateBucketCommand({ Bucket: bucket, CreateBucketConfiguration: { LocationConstraint: 'us-east-2' } }));
        } catch {
            ctx.skip();
        }
        const dir = mkdtempSync(join(tmpdir(), 'tt-media-'));
        mkdirSync(join(dir, 'images', 'show'), { recursive: true });
        mkdirSync(join(dir, 'docs'), { recursive: true });
        writeFileSync(join(dir, 'images', 'show', 'a.jpg'), 'jpeg-bytes');
        writeFileSync(join(dir, 'docs', 'release.pdf'), 'pdf-bytes');
        writeFileSync(join(dir, '.DS_Store'), 'ignored');

        const first = await syncMedia({ client, bucket, dir, log: () => {} });
        expect(first).toMatchObject({ uploaded: 2, skipped: 0 });
        const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: 'media/images/show/a.jpg' }));
        expect(head.ContentType).toBe('image/jpeg');

        const second = await syncMedia({ client, bucket, dir, log: () => {} });
        expect(second).toMatchObject({ uploaded: 0, skipped: 2 });
    });
});
