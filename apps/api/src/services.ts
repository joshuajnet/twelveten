import { config } from './config.ts';
import { createAuth } from './auth/auth.ts';
import { db } from './db/index.ts';
import { createStorage } from './storage/uploads.ts';
import { createS3Publisher } from './publish/s3Publisher.ts';
import type { AppDeps } from './app.ts';

/** Production / local wiring of the app's dependencies from configuration. */
export function appDeps(): AppDeps {
    const cfg = config();
    const storage = createStorage({
        bucket: cfg.MEDIA_BUCKET,
        region: cfg.AWS_REGION,
        endpoint: cfg.AWS_ENDPOINT_URL,
        publicPrefix: cfg.MEDIA_PUBLIC_PREFIX,
    });
    return {
        db,
        auth: createAuth({ db: db() }),
        storage,
        // Same S3 client; pages go to the site bucket.
        publisher: createS3Publisher({ db, client: storage.client, bucket: cfg.SITE_BUCKET, siteUrl: cfg.SITE_URL }),
    };
}
