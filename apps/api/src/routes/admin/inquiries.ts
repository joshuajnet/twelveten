import { Hono } from 'hono';
import { sql } from 'kysely';
import { INQUIRIES_PAGE_SIZE } from '@twelveten/shared';
import type { AppEnv } from '../../env.ts';
import { getInquiry, listInquiries, unseenInquiries } from '../../inquiries/queries.ts';
import { HttpError } from './errors.ts';
import { idParam, pageParams } from './util.ts';

/** Inquiries: the list, the back office alert (not yet dismissed), dismissing and deleting. */
export function inquiryRoutes() {
    const app = new Hono<AppEnv>();

    app.get('/inquiries', async (c) => {
        const status = c.req.query('status') ?? 'all';
        if (status !== 'new' && status !== 'all') throw new HttpError(400, 'status must be new or all');
        const { page, pageSize } = pageParams(c, INQUIRIES_PAGE_SIZE);
        return c.json(await listInquiries(c.var.db, { status, q: c.req.query('q')?.trim() || undefined }, page, pageSize));
    });

    app.get('/inquiries/unseen', async (c) => c.json(await unseenInquiries(c.var.db)));

    /** Dismiss every alert (for every admin). */
    app.post('/inquiries/seen', async (c) => {
        const r = await c.var.db
            .updateTable('inquiries')
            .set({ seen_at: sql`now()`, seen_by: c.var.userId })
            .where('seen_at', 'is', null)
            .executeTakeFirst();
        return c.json({ dismissed: Number(r.numUpdatedRows) });
    });

    app.post('/inquiries/:id/seen', async (c) => {
        const id = idParam(c);
        await c.var.db
            .updateTable('inquiries')
            .set({ seen_at: sql`coalesce(seen_at, now())`, seen_by: sql`coalesce(seen_by, ${c.var.userId})` })
            .where('id', '=', id)
            .execute();
        const inquiry = await getInquiry(c.var.db, id);
        if (!inquiry) throw new HttpError(404, 'Not found');
        return c.json(inquiry);
    });

    /** Spam and mistakes. */
    app.delete('/inquiries/:id', async (c) => {
        const r = await c.var.db.deleteFrom('inquiries').where('id', '=', idParam(c)).executeTakeFirst();
        if (!Number(r.numDeletedRows)) throw new HttpError(404, 'Not found');
        return c.body(null, 204);
    });

    return app;
}
