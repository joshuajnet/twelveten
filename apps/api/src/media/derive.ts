import { mkdir, readFile, stat, writeFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { DISPLAY_WIDTHS, derivedKey, isDerivable, PLACEHOLDER_WIDTH, ZOOM_MAX, type MediaVariant } from '@twelveten/shared';

/** Where originals are read from and derivatives written to (keys are bucket keys: `media/…`). */
export interface MediaIO {
    read(key: string): Promise<Buffer | null>;
    exists(key: string): Promise<boolean>;
    write(key: string, body: Buffer, contentType: string): Promise<void>;
    /** Original image keys under `media/<prefix>` (derivatives excluded). */
    list(prefix: string): AsyncGenerator<string>;
}

const CACHE = 'public, max-age=31536000, immutable';

export function s3IO(client: S3Client, bucket: string): MediaIO {
    return {
        async read(key) {
            try {
                const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
                return Buffer.from(await res.Body!.transformToByteArray());
            } catch (e) {
                if ((e as { name?: string }).name === 'NoSuchKey') return null;
                throw e;
            }
        },
        async exists(key) {
            try {
                await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
                return true;
            } catch (e) {
                const status = (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
                if (status === 404 || (e as { name?: string }).name === 'NotFound') return false;
                throw e;
            }
        },
        async write(key, body, contentType) {
            await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, CacheControl: CACHE }));
        },
        async *list(prefix) {
            let token: string | undefined;
            do {
                const res = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: `media/${prefix}`, ContinuationToken: token }));
                for (const o of res.Contents ?? []) if (o.Key && isDerivable(`/${o.Key}`)) yield o.Key;
                token = res.IsTruncated ? res.NextContinuationToken : undefined;
            } while (token);
        },
    };
}

/** A local folder standing in for the bucket's `media/` prefix (development, tests). */
export function diskIO(dir: string): MediaIO {
    const file = (key: string) => join(dir, ...key.replace(/^media\//, '').split('/'));
    async function* walk(d: string): AsyncGenerator<string> {
        let entries;
        try {
            entries = await readdir(d, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries) {
            if (e.name.startsWith('.')) continue;
            const full = join(d, e.name);
            if (e.isDirectory()) yield* walk(full);
            else yield full;
        }
    }
    return {
        async read(key) {
            try {
                return await readFile(file(key));
            } catch {
                return null;
            }
        },
        async exists(key) {
            try {
                await stat(file(key));
                return true;
            } catch {
                return false;
            }
        },
        async write(key, body) {
            await mkdir(dirname(file(key)), { recursive: true });
            await writeFile(file(key), body);
        },
        async *list(prefix) {
            for await (const f of walk(join(dir, ...prefix.split('/').filter(Boolean)))) {
                const key = `media/${relative(dir, f).split(sep).join('/')}`;
                if (isDerivable(`/${key}`)) yield key;
            }
        },
    };
}

/** Reads originals from one place and writes derivatives to another (e.g. .media → LocalStack). */
export function splitIO(source: MediaIO, target: MediaIO): MediaIO {
    return { read: (k) => source.read(k), list: (p) => source.list(p), exists: (k) => target.exists(k), write: (k, b, t) => target.write(k, b, t) };
}

export type DeriveResult = 'derived' | 'skipped' | 'missing' | 'unsupported';

/**
 * Make every derivative of one original: display widths (WebP), a blurred-placeholder width and the
 * zoom copy (progressive JPEG, 4:4:4). Rotated from EXIF, converted to sRGB, never enlarged.
 * Existing derivatives are kept unless `force`.
 */
export async function deriveImage(io: MediaIO, key: string, opts: { force?: boolean } = {}): Promise<DeriveResult> {
    if (!isDerivable(`/${key}`)) return 'unsupported';
    const outputs: { name: MediaVariant; make: (img: sharp.Sharp) => sharp.Sharp; type: string }[] = [
        { name: `w${PLACEHOLDER_WIDTH}.webp`, make: (i) => i.resize({ width: PLACEHOLDER_WIDTH, withoutEnlargement: true }).webp({ quality: 50 }), type: 'image/webp' },
        ...DISPLAY_WIDTHS.map((w) => ({
            name: `w${w}.webp` as MediaVariant,
            make: (i: sharp.Sharp) => i.resize({ width: w, withoutEnlargement: true }).webp({ quality: 80, effort: 5 }),
            type: 'image/webp',
        })),
        {
            name: 'zoom.jpg',
            make: (i) =>
                i
                    .resize({ width: ZOOM_MAX, height: ZOOM_MAX, fit: 'inside', withoutEnlargement: true })
                    .flatten({ background: '#ffffff' })
                    .jpeg({ quality: 90, progressive: true, mozjpeg: true, chromaSubsampling: '4:4:4' }),
            type: 'image/jpeg',
        },
    ];
    // The zoom copy is written last, so it marks a finished set.
    if (!opts.force && (await io.exists(derivedKey(key, 'zoom.jpg')))) return 'skipped';

    const input = await io.read(key);
    if (!input) return 'missing';
    // Decode once; very large scans are allowed (the gallery photographs paintings).
    const base = sharp(input, { limitInputPixels: 400_000_000, failOn: 'none' }).rotate().toColourspace('srgb').withIccProfile('srgb');
    // Widths in srcset must be true: a width wider than the original isn't made at all (the page
    // then falls back to the original for it), so the browser never shows a smaller copy too small.
    const meta = await sharp(input, { limitInputPixels: 400_000_000, failOn: 'none' }).metadata();
    const width = (meta.orientation ?? 1) >= 5 ? (meta.height ?? 0) : (meta.width ?? 0);
    const todo = outputs.filter((o) => {
        const m = /^w(\d+)\.webp$/.exec(o.name);
        return !m || Number(m[1]) === PLACEHOLDER_WIDTH || Number(m[1]) <= width;
    });
    for (const o of todo) {
        const body = await o.make(base.clone()).toBuffer();
        await io.write(derivedKey(key, o.name), body, o.type);
    }
    return 'derived';
}

/** Derive everything under `media/<prefix>` that is missing derivatives, a few at a time. */
export async function deriveAll(
    io: MediaIO,
    opts: { prefix?: string; force?: boolean; dryRun?: boolean; concurrency?: number; log?: (line: string) => void } = {},
): Promise<Record<DeriveResult, number>> {
    const log = opts.log ?? (() => {});
    const counts: Record<DeriveResult, number> = { derived: 0, skipped: 0, missing: 0, unsupported: 0 };
    const keys: string[] = [];
    for await (const k of io.list(opts.prefix ?? '')) if (!k.startsWith('media/derived/')) keys.push(k);
    let next = 0;
    const worker = async () => {
        while (next < keys.length) {
            const key = keys[next++]!;
            if (opts.dryRun) {
                const missing = opts.force || !(await io.exists(derivedKey(key, 'zoom.jpg')));
                counts[missing ? 'derived' : 'skipped']++;
                if (missing) log(`would derive ${key}`);
                continue;
            }
            try {
                const r = await deriveImage(io, key, { force: opts.force });
                counts[r]++;
                if (r === 'derived') log(`derived ${key}`);
            } catch (e) {
                counts.missing++;
                log(`failed ${key}: ${(e as Error).message}`);
            }
        }
    };
    await Promise.all(Array.from({ length: opts.concurrency ?? 4 }, worker));
    return counts;
}

/** The bucket, with originals missing from it read from a local copy (development's `.media`). */
export function withLocalOriginals(bucket: MediaIO, local: MediaIO): MediaIO {
    return {
        read: async (k) => (await bucket.read(k)) ?? (await local.read(k)),
        exists: (k) => bucket.exists(k),
        write: (k, b, t) => bucket.write(k, b, t),
        async *list(prefix) {
            const seen = new Set<string>();
            for await (const k of bucket.list(prefix)) if (!seen.has(k)) (seen.add(k), yield k);
            for await (const k of local.list(prefix)) if (!seen.has(k)) (seen.add(k), yield k);
        },
    };
}
