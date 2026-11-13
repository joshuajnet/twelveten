import { config } from './config.ts';
import { createAuth } from './auth/auth.ts';
import { db } from './db/index.ts';
import { createStorage } from './storage/uploads.ts';
import { noopPublisher, type Publisher } from './publish/publisher.ts';
import type { AppDeps } from './app.ts';

/** Production / local wiring of the app's dependencies from configuration. */
export function appDeps(publisher: Publisher = noopPublisher): AppDeps {
    const cfg = config();
    return {
        db,
        auth: createAuth({ db: db() }),
        publisher,
        storage: createStorage({
            bucket: cfg.MEDIA_BUCKET,
            region: cfg.AWS_REGION,
            endpoint: cfg.AWS_ENDPOINT_URL,
            publicPrefix: cfg.MEDIA_PUBLIC_PREFIX,
        }),
    };
}
