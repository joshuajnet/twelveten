import { Hono } from 'hono';
import { formatDateRange, inquiryCreateSchema, type InquiryItem, type VisitorIdentity } from '@twelveten/shared';
import type { AppEnv } from '../env.ts';
import { forgetVisitor, knownVisitor, limitByIp, originGuard, rememberVisitor } from '../lib/visitors.ts';
import { identifyPerson } from '../people/identify.ts';
import { HttpError, validationError } from './admin/errors.ts';

const INQUIRY_LIMIT = { max: 5, windowMs: 10 * 60_000 };

/**
 * Inquiries from the public site (works-available slides and the exhibition Inquire button), and
 * the site-wide "who is this browser" lookup. Nothing here is cached.
 */
export function inquiryPublicRoutes(opts: { siteUrl: string; trustedOrigins?: string[] }) {
    const app = new Hono<AppEnv>();
    const checkOrigin = originGuard(opts.siteUrl, opts.trustedOrigins);
    const secure = opts.siteUrl.startsWith('https://');

    for (const path of ['/visitor', '/visitor/*', '/inquiries']) {
        app.use(path, async (c, next) => {
            c.header('Cache-Control', 'private, no-store');
            checkOrigin(c);
            await next();
        });
    }

    app.get('/visitor', async (c) => {
        const known = await knownVisitor(c);
        return c.json(known ? ({ name: known.name } satisfies VisitorIdentity) : null);
    });

    app.post('/visitor/forget', async (c) => {
        await forgetVisitor(c);
        return c.body(null, 204);
    });

    app.post('/inquiries', async (c) => {
        const db = c.var.db;
        let raw: unknown;
        try {
            raw = await c.req.json();
        } catch {
            throw new HttpError(400, 'Request body must be JSON');
        }
        const parsed = inquiryCreateSchema.safeParse(raw);
        if (!parsed.success) throw validationError(parsed.error);
        const input = parsed.data;
        await limitByIp(c, 'inquiry', INQUIRY_LIMIT.max, INQUIRY_LIMIT.windowMs, 'Too many inquiries; please try again in a few minutes');
        // Bots fill in every field; people never see this one.
        if (input.website) return c.json({ name: input.name ?? '' }, 201);

        // What they asked about, as it is now.
        let item: InquiryItem;
        let link: { exhibition_id: string; artwork_id?: string; work_id?: string | null };
        let source: 'slide' | 'exhibition';
        if (input.item.kind === 'slide') {
            const s = await db
                .selectFrom('artworks as a')
                .innerJoin('exhibitions as e', 'e.id', 'a.exhibition_id')
                .select(['a.id', 'a.image', 'a.author', 'a.title', 'a.date_text', 'a.media', 'a.dimensions', 'a.work_id', 'a.available', 'a.hidden', 'e.id as exhibition_id', 'e.title as ex_title', 'e.published', 'e.works_available'])
                .where('a.id', '=', input.item.artworkId)
                .executeTakeFirst();
            if (!s || !s.published || s.hidden) throw new HttpError(404, 'Not found');
            if (!s.works_available || !s.available) throw new HttpError(400, 'This work isn’t available');
            item = { title: s.title || 'Untitled', artist: s.author, date: s.date_text, medium: s.media, dimensions: s.dimensions, image: s.image, context: s.ex_title };
            link = { exhibition_id: s.exhibition_id, artwork_id: s.id, work_id: s.work_id };
            source = 'slide';
        } else {
            const e = await db
                .selectFrom('exhibitions')
                .select(['id', 'title', 'artists', 'starts_on', 'ends_on', 'hero_image', 'thumbnail', 'published', 'show_inquire'])
                .where('id', '=', input.item.exhibitionId)
                .executeTakeFirst();
            if (!e || !e.published) throw new HttpError(404, 'Not found');
            if (!e.show_inquire) throw new HttpError(400, 'Inquiries aren’t open for this exhibition');
            item = { title: e.title, artist: e.artists.split('\n').filter(Boolean).join(', ') || null, date: formatDateRange(e.starts_on, e.ends_on), image: e.thumbnail ?? e.hero_image };
            link = { exhibition_id: e.id };
            source = 'exhibition';
        }

        const known = await knownVisitor(c);
        const useKnown = known && !input.email;
        if (!useKnown) {
            const issues = [
                ...(input.name ? [] : [{ path: 'name', message: 'Please enter your name' }]),
                ...(input.email ? [] : [{ path: 'email', message: 'Please enter your email' }]),
            ];
            if (issues.length) throw new HttpError(400, 'Invalid input', issues);
        }

        const name = await db.transaction().execute(async (trx) => {
            let personId: string;
            let match: 'email' | 'alias' | 'new' | 'known';
            if (useKnown) {
                personId = known.personId;
                match = 'known';
                await trx.updateTable('visitor_identities').set({ last_seen_at: new Date() }).where('hash', '=', known.hash).execute();
            } else {
                ({ personId, match } = await identifyPerson(trx, { name: input.name!, email: input.email!, createdFrom: `an inquiry about “${item.title}”` }));
                if (known?.personId !== personId) await rememberVisitor(c, trx, personId, secure);
            }
            await trx
                .insertInto('inquiries')
                .values({
                    person_id: personId,
                    source,
                    ...link,
                    item: JSON.stringify(item),
                    page_url: input.pageUrl ?? null,
                    note: input.note,
                    entered_name: useKnown ? null : input.name!,
                    entered_email: useKnown ? null : input.email!,
                    match,
                })
                .execute();
            const p = await trx.selectFrom('persons').select('name').where('id', '=', personId).executeTakeFirstOrThrow();
            return useKnown ? p.name : input.name!;
        });
        return c.json({ name } satisfies VisitorIdentity, 201);
    });

    return app;
}
