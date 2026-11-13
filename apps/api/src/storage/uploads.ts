import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v7 as uuidv7 } from 'uuid';
import { slugify, UPLOAD_TYPES, type UploadRequest, type UploadTicket } from '@twelveten/shared';

export interface StorageConfig {
    bucket: string;
    region: string;
    /** Custom endpoint (LocalStack). */
    endpoint?: string;
    /** Public path prefix the media bucket is served under (CloudFront /media/*, Vite proxy locally). */
    publicPrefix: string;
}

export interface Storage {
    presignUpload(req: UploadRequest, now?: Date): Promise<UploadTicket>;
    client: S3Client;
    bucket: string;
}

/** Object keys live under `media/` so the bucket can be mounted at /media on the site. */
export function uploadKey(req: Pick<UploadRequest, 'filename' | 'contentType'>, now = new Date()): string {
    const ext = UPLOAD_TYPES[req.contentType];
    const base = slugify(req.filename.replace(/\.[^.]+$/, '')).slice(0, 60);
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `media/uploads/${yyyy}/${mm}/${uuidv7()}-${base}.${ext}`;
}

export function createStorage(cfg: StorageConfig): Storage {
    const client = new S3Client({
        region: cfg.region,
        endpoint: cfg.endpoint,
        forcePathStyle: Boolean(cfg.endpoint),
    });
    return {
        client,
        bucket: cfg.bucket,
        async presignUpload(req, now = new Date()) {
            const key = uploadKey(req, now);
            const command = new PutObjectCommand({
                Bucket: cfg.bucket,
                Key: key,
                ContentType: req.contentType,
                ContentLength: req.size,
                CacheControl: 'public, max-age=31536000, immutable',
            });
            const uploadUrl = await getSignedUrl(client, command, { expiresIn: 15 * 60 });
            return {
                uploadUrl,
                key,
                url: `${cfg.publicPrefix.replace(/\/+$/, '')}/${key.replace(/^media\//, '')}`,
                headers: { 'Content-Type': req.contentType, 'Cache-Control': 'public, max-age=31536000, immutable' },
            };
        },
    };
}
