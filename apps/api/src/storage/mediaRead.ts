import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config.ts';
import type { Storage } from './uploads.ts';

/**
 * Bytes of a `/media/…` URL from the media bucket or, in development, from the local media copy
 * (LOCAL_MEDIA_DIR). Nothing outside the media prefix is read and nothing external is fetched;
 * a missing object is null.
 */
export async function readMedia(storage: Storage | undefined, url: string): Promise<Buffer | null> {
    if (!url.startsWith('/media/')) return null;
    const key = decodeURIComponent(url.slice(1).split(/[?#]/)[0]!);
    if (key.split('/').includes('..')) return null;
    try {
        const res = await storage?.client.send(new GetObjectCommand({ Bucket: storage.bucket, Key: key }));
        if (res?.Body) return Buffer.from(await res.Body.transformToByteArray());
    } catch {
        // Fall through to the local copy.
    }
    const localDir = config().LOCAL_MEDIA_DIR;
    if (!localDir) return null;
    const root = resolve(localDir);
    const file = resolve(root, key.slice('media/'.length));
    if (!file.startsWith(root + sep)) return null;
    try {
        return await readFile(file);
    } catch {
        return null;
    }
}

