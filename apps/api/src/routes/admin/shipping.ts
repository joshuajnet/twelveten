import { Hono } from 'hono';
import { shippingLabelsSchema } from '@twelveten/shared';
import type { AppEnv } from '../../env.ts';
import { buildShippingLabels } from '../../shipping/labels.ts';
import type { Storage } from '../../storage/uploads.ts';
import { body } from './errors.ts';
import { pdfResponse } from './util.ts';

/** Shipping labels. A POST: the addresses are personal data, kept out of URLs and logs. Nothing is stored. */
export function shippingRoutes(deps: { storage?: Storage } = {}) {
    const app = new Hono<AppEnv>();

    app.post('/shipping-labels.pdf', async (c) => {
        const input = await body(c, shippingLabelsSchema);
        const { pdf, filename } = await buildShippingLabels(c.var.db, deps.storage, input);
        return pdfResponse(c, pdf, filename, c.req.query('download') !== '1');
    });

    return app;
}
