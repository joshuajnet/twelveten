import { readdir, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { ListObjectsV2Command, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';

const TYPES: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.pdf': 'application/pdf',
};

async function* walk(dir: string): AsyncGenerator<string> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) yield* walk(full);
        else if (entry.isFile()) yield full;
    }
}

export interface SyncOptions {
    client: S3Client;
    bucket: string;
    /** Local folder holding images/ and docs/ (the repo's .media). */
    dir: string;
    dryRun?: boolean;
    concurrency?: number;
    log?: (line: string) => void;
}

/**
 * Uploads every file under `dir` to `media/<path>` in the bucket, skipping objects that already
 * exist with the same size. Safe to re-run.
 */
export async function syncMedia(opts: SyncOptions): Promise<{ uploaded: number; skipped: number; bytes: number }> {
    const log = opts.log ?? console.log;
    const existing = new Map<string, number>();
    let token: string | undefined;
    do {
        const res = await opts.client.send(new ListObjectsV2Command({ Bucket: opts.bucket, Prefix: 'media/', ContinuationToken: token }));
        for (const o of res.Contents ?? []) if (o.Key) existing.set(o.Key, o.Size ?? -1);
        token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);

    const queue: { file: string; key: string; size: number }[] = [];
    let skipped = 0;
    for await (const file of walk(opts.dir)) {
        const key = `media/${relative(opts.dir, file).split(sep).join('/')}`;
        const { size } = await stat(file);
        if (existing.get(key) === size) skipped++;
        else queue.push({ file, key, size });
    }

    let uploaded = 0;
    let bytes = 0;
    const total = queue.reduce((n, q) => n + q.size, 0);
    log(`${queue.length} files to upload (${(total / 1024 / 1024).toFixed(1)} MB), ${skipped} already in s3://${opts.bucket}`);
    if (opts.dryRun) return { uploaded: 0, skipped, bytes: 0 };

    const workers = Array.from({ length: opts.concurrency ?? 8 }, async () => {
        for (let item = queue.shift(); item; item = queue.shift()) {
            await opts.client.send(
                new PutObjectCommand({
                    Bucket: opts.bucket,
                    Key: item.key,
                    Body: createReadStream(item.file),
                    ContentLength: item.size,
                    ContentType: TYPES[extname(item.file).toLowerCase()] ?? 'application/octet-stream',
                    CacheControl: 'public, max-age=31536000',
                }),
            );
            uploaded++;
            bytes += item.size;
            if (uploaded % 50 === 0) log(`  ${uploaded} uploaded (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
        }
    });
    await Promise.all(workers);
    log(`Done: ${uploaded} uploaded, ${skipped} skipped`);
    return { uploaded, skipped, bytes };
}
