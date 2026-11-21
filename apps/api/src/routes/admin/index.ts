import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { isDerivable, uploadRequestSchema } from '@twelveten/shared';
import { deriveImage, diskIO, s3IO, withLocalOriginals } from '../../media/derive.ts';
import { config } from '../../config.ts';
import type { AppEnv } from '../../env.ts';
import type { Publisher } from '../../publish/publisher.ts';
import type { Storage } from '../../storage/uploads.ts';
import { body, fromDbError, HttpError } from './errors.ts';
import { exhibitionRoutes } from './exhibitions.ts';
import { siteRoutes } from './site.ts';
import { historyRoutes } from './history.ts';
import { peopleRoutes } from './people.ts';
import { inventoryRoutes } from './inventory.ts';
import { invoiceRoutes } from './invoices.ts';
import { roomRoutes } from './rooms.ts';
import { shippingRoutes } from './shipping.ts';
import { inquiryRoutes } from './inquiries.ts';

export interface AdminDeps {
    publisher: Publisher;
    storage?: Storage;
    /** Derive images in the request after an upload (development). Defaults to MEDIA_DERIVE_INLINE. */
    deriveInline?: boolean;
}

type Ctx = Context<AppEnv>;

export function adminRoutes(deps: AdminDeps) {
    const app = new Hono<AppEnv>();
    const { publisher } = deps;

    app.use('*', async (c, next) => {
        c.header('Cache-Control', 'private, no-store');
        if (!c.var.userId) throw new HttpError(401, 'Sign in required');
        if (!c.var.isAdmin) throw new HttpError(403, 'Admins only');
        await next();
    });

    const publish = async (paths: string[]) => {
        try {
            await publisher.render([...new Set(paths)]);
        } catch (err) {
            // Content is saved; a failed render is retried by the next save or a rebuild.
            console.error('publish failed', err);
        }
    };

    const routes = { publish };
    app.route('/', exhibitionRoutes(routes));
    app.route('/', siteRoutes(routes));
    app.route('/', historyRoutes(routes));
    // People, profiles, addresses, inventory, invoices, viewing rooms and shipping labels: no prerendered page changes.
    app.route('/', peopleRoutes());
    app.route('/', inventoryRoutes());
    app.route('/', invoiceRoutes({ storage: deps.storage }));
    app.route('/', roomRoutes({ storage: deps.storage }));
    app.route('/', shippingRoutes({ storage: deps.storage }));
    app.route('/', inquiryRoutes());

    // ---------- Uploads & publishing ----------

    app.post('/uploads', async (c) => {
        if (!deps.storage) throw new HttpError(422, 'File storage is not configured');
        const req = await body(c, uploadRequestSchema);
        return c.json(await deps.storage.presignUpload(req), 201);
    });

    /**
     * The browser finished uploading `url`. In production the S3-triggered media function makes its
     * derivatives; in development (no S3 events) they are made here.
     */
    app.post('/uploads/complete', async (c) => {
        const { url } = await body(c, z.object({ url: z.string().startsWith('/media/uploads/') }));
        const inline = deps.deriveInline ?? config().MEDIA_DERIVE_INLINE;
        if (!inline || !deps.storage || !isDerivable(url)) return c.json({ derived: false });
        const local = config().LOCAL_MEDIA_DIR;
        const bucket = s3IO(deps.storage.client, deps.storage.bucket);
        const io = local ? withLocalOriginals(bucket, diskIO(local)) : bucket;
        const result = await deriveImage(io, `media/${url.slice('/media/'.length)}`);
        return c.json({ derived: result === 'derived' || result === 'skipped' });
    });

    app.post('/publish/rebuild', async (c) => c.json(await publisher.rebuildAll()));

    return app;
}

/** Shared error handler for the API (HTTP errors, DB constraint errors, everything else = 500). */
export function handleError(err: Error, c: Ctx) {
    if (err instanceof HttpError) return c.json({ error: err.message, details: err.details }, err.status);
    const db = fromDbError(err);
    if (db) return c.json({ error: db.message, details: db.details }, db.status);
    console.error(err);
    return c.json({ error: 'Internal server error' }, 500);
}
