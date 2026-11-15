import { S3Client } from '@aws-sdk/client-s3';
import { deriveAll, deriveImage, s3IO } from './derive.ts';

/**
 * The `media` Lambda: makes image derivatives when an upload lands in the media bucket (S3
 * Object Created under media/uploads/, via EventBridge), or backfills with `{ "backfill": true, "prefix": "images/" }`.
 * Needs only S3 (through the VPC's gateway endpoint), not the database.
 */
/** EventBridge "Object Created" from the media bucket (keys are not URL-encoded). */
interface ObjectCreatedEvent {
    'detail-type': 'Object Created';
    detail: { object: { key: string } };
}
/** A direct S3 notification (keys URL-encoded, + for spaces). */
interface S3Event {
    Records?: { s3: { object: { key: string } } }[];
}
interface BackfillEvent {
    backfill: true;
    prefix?: string;
    force?: boolean;
}

let client: S3Client | null = null;
function io() {
    // A custom endpoint (LocalStack) needs path-style addressing.
    const endpoint = process.env.AWS_ENDPOINT_URL;
    client ??= new S3Client(endpoint ? { endpoint, forcePathStyle: true } : {});
    return s3IO(client, process.env.MEDIA_BUCKET!);
}

export async function mediaHandler(event: ObjectCreatedEvent | S3Event | BackfillEvent) {
    if ('backfill' in event) return deriveAll(io(), { prefix: event.prefix ?? '', force: event.force, log: console.log });
    const keys =
        'detail' in event ? [event.detail.object.key] : ((event as S3Event).Records ?? []).map((r) => decodeURIComponent(r.s3.object.key.replace(/\+/g, ' ')));
    const results: Record<string, string> = {};
    for (const key of keys) {
        if (key.startsWith('media/derived/')) continue;
        results[key] = await deriveImage(io(), key);
        console.log(`${results[key]} ${key}`);
    }
    return results;
}
