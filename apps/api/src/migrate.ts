import { randomBytes } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { DeleteObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { upsertAdmin } from './auth/users.ts';
import { closeDb, db } from './db/index.ts';
import { migrateToLatest } from './db/migrate.ts';
import { seed } from './db/seed.ts';
import { importData, type DataDump } from './db/transfer.ts';

interface MigrateEvent {
    /** Load the original site content (skipped once applied). */
    seed?: boolean;
    /**
     * Replace all data with a dump uploaded by `npm run data:push` (media bucket, `import/` prefix,
     * never served by CloudFront). The object is deleted afterwards, version included.
     */
    import?: { key: string; versionId?: string; force?: boolean };
    /** Create or reset an admin; the generated password is returned once. */
    admin?: { email: string; name?: string };
}

/**
 * Lambda: apply pending migrations, then optionally seed and create an admin. Safe to run repeatedly.
 *   osls invoke -f migrate -d '{"seed":true}'
 *   osls invoke -f migrate -d '{"admin":{"email":"you@example.com","name":"You"}}'
 * Production data arrives only through `npm run data:push` (the `import` event), never the seed.
 */
export async function handler(event: MigrateEvent | null = {}) {
    try {
        const { results } = await migrateToLatest(db());
        const out: Record<string, unknown> = { ok: true, applied: (results ?? []).map((r) => `${r.status}: ${r.migrationName}`) };
        if (event?.seed) {
            if (process.env.STAGE === 'prod') throw new Error('prod is never seeded; its data comes from npm run data:push');
            const r = await seed(db(), {});
            out.seed = r.skipped ? 'already applied' : { exhibitions: r.exhibitions, slides: r.artworks, press: r.press, news: r.news };
        }
        if (event?.import?.key) {
            const { key, versionId, force } = event.import;
            if (!key.startsWith('import/')) throw new Error('Import key must be under import/');
            const s3 = new S3Client({});
            const Bucket = process.env.MEDIA_BUCKET!;
            try {
                const obj = await s3.send(new GetObjectCommand({ Bucket, Key: key, VersionId: versionId }));
                const dump = JSON.parse(gunzipSync(await obj.Body!.transformToByteArray()).toString('utf8')) as DataDump;
                out.import = await importData(db(), dump, { force });
            } finally {
                await s3.send(new DeleteObjectCommand({ Bucket, Key: key, VersionId: versionId }));
            }
        }
        if (event?.admin?.email) {
            const password = randomBytes(12).toString('base64url');
            const { created } = await upsertAdmin(db(), { email: event.admin.email, password, name: event.admin.name });
            out.admin = { email: event.admin.email, created, password };
        }
        return out;
    } finally {
        await closeDb();
    }
}
