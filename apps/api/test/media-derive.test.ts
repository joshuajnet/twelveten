import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CreateBucketCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { createApp } from '../src/app.ts';
import { migrateToLatest } from '../src/db/migrate.ts';
import { createStorage } from '../src/storage/uploads.ts';
import { mediaHandler } from '../src/media/handler.ts';
import { resetSchema, testDb } from './db.ts';

const db = testDb();
const endpoint = process.env.AWS_ENDPOINT_URL ?? 'http://localhost:4566';
const bucket = `twelveten-test-media-${Date.now()}`;
const client = new S3Client({ region: 'us-east-2', endpoint, forcePathStyle: true });
const storage = createStorage({ bucket, region: 'us-east-2', endpoint, publicPrefix: '/media' });
let s3Available = true;

const jpeg = () => sharp({ create: { width: 1200, height: 900, channels: 3, background: '#336699' } }).jpeg().toBuffer();
const exists = async (key: string) =>
    client.send(new HeadObjectCommand({ Bucket: bucket, Key: key })).then(
        () => true,
        () => false,
    );

beforeAll(async () => {
    await resetSchema(db);
    await migrateToLatest(db);
    try {
        await client.send(new CreateBucketCommand({ Bucket: bucket, CreateBucketConfiguration: { LocationConstraint: 'us-east-2' } }));
    } catch {
        s3Available = false;
    }
});
afterAll(() => db.destroy());

const app = (deriveInline: boolean) =>
    createApp({ db: () => db, storage, resolveUser: async () => ({ id: '00000000-0000-7000-8000-000000000001', role: 'admin' }), deriveInline });

describe('image derivatives after upload', () => {
    it('are made by the API when inline derivation is on (development)', async (ctx) => {
        if (!s3Available) ctx.skip();
        await client.send(new PutObjectCommand({ Bucket: bucket, Key: 'media/uploads/2026/11/x-photo.jpg', Body: await jpeg(), ContentType: 'image/jpeg' }));
        const post = (deriveInline: boolean, url: string) =>
            app(deriveInline).request('/api/admin/uploads/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });

        expect(await (await post(false, '/media/uploads/2026/11/x-photo.jpg')).json()).toEqual({ derived: false });
        expect(await exists('media/derived/uploads/2026/11/x-photo.jpg/zoom.jpg')).toBe(false);

        expect(await (await post(true, '/media/uploads/2026/11/x-photo.jpg')).json()).toEqual({ derived: true });
        expect(await exists('media/derived/uploads/2026/11/x-photo.jpg/zoom.jpg')).toBe(true);
        expect(await exists('media/derived/uploads/2026/11/x-photo.jpg/w480.webp')).toBe(true);
        expect((await post(true, '/media/images/elsewhere.jpg')).status).toBe(400);
    });

    it('are made by the media function from an S3 (EventBridge) event', async (ctx) => {
        if (!s3Available) ctx.skip();
        await client.send(new PutObjectCommand({ Bucket: bucket, Key: 'media/uploads/2026/11/y photo.jpg', Body: await jpeg(), ContentType: 'image/jpeg' }));
        process.env.MEDIA_BUCKET = bucket;
        process.env.AWS_REGION = 'us-east-2';
        process.env.AWS_ENDPOINT_URL = endpoint;
        const result = await mediaHandler({ 'detail-type': 'Object Created', detail: { object: { key: 'media/uploads/2026/11/y photo.jpg' } } });
        expect(result).toEqual({ 'media/uploads/2026/11/y photo.jpg': 'derived' });
        expect(await exists('media/derived/uploads/2026/11/y photo.jpg/w960.webp')).toBe(true);
    });
});
