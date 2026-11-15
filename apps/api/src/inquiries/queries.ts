import type { InquirySummary, NumberedPage } from '@twelveten/shared';
import type { DB } from '../db/index.ts';
import { likePattern, numberedPage } from '../lib/paging.ts';

type Q = Pick<DB, 'selectFrom'>;

function inquiryQuery(db: Q) {
    return db
        .selectFrom('inquiries as i')
        .innerJoin('persons as p', 'p.id', 'i.person_id')
        .leftJoin('exhibitions as e', 'e.id', 'i.exhibition_id')
        .leftJoin('viewing_rooms as r', 'r.id', 'i.room_id')
        .leftJoin('user as u', 'u.id', 'i.seen_by')
        .selectAll('i')
        .select(['p.name as person_name', 'e.slug as ex_slug', 'e.kind as ex_kind', 'e.title as ex_title', 'r.title as room_title', 'u.name as seen_by_name']);
}

type Row = Awaited<ReturnType<ReturnType<typeof inquiryQuery>['execute']>>[number];

function toSummary(r: Row): InquirySummary {
    return {
        id: r.id,
        personId: r.person_id,
        personName: r.person_name,
        source: r.source,
        item: r.item,
        note: r.note,
        pageUrl: r.page_url,
        workId: r.work_id,
        exhibition: r.exhibition_id && r.ex_slug ? { id: r.exhibition_id, slug: r.ex_slug, kind: r.ex_kind!, title: r.ex_title! } : null,
        room: r.room_id && r.room_title ? { id: r.room_id, title: r.room_title } : null,
        enteredName: r.entered_name,
        enteredEmail: r.entered_email,
        match: r.match,
        seenAt: r.seen_at,
        seenBy: r.seen_by_name ?? null,
        createdAt: r.created_at,
    };
}

export async function getInquiry(db: Q, id: string): Promise<InquirySummary | null> {
    const r = await inquiryQuery(db).where('i.id', '=', id).executeTakeFirst();
    return r ? toSummary(r) : null;
}

/** Newest first; `status` new = not dismissed yet. */
export async function listInquiries(db: Q, f: { status?: 'new' | 'all'; q?: string }, page: number, pageSize: number): Promise<NumberedPage<InquirySummary>> {
    let q = inquiryQuery(db).orderBy('i.created_at', 'desc').orderBy('i.id', 'desc');
    if (f.status === 'new') q = q.where('i.seen_at', 'is', null);
    if (f.q) {
        const like = likePattern(f.q);
        q = q.where((eb) =>
            eb.or([eb('p.name', 'ilike', like), eb('i.note', 'ilike', like), eb('i.entered_email', 'ilike', like), eb(eb.cast(eb.ref('i.item'), 'text'), 'ilike', like)]),
        );
    }
    return numberedPage(q, page, pageSize, toSummary);
}

/** Not yet dismissed: how many, and the newest few (the back office alert). */
export async function unseenInquiries(db: Q, limit = 5): Promise<{ count: number; items: InquirySummary[] }> {
    const [count, rows] = await Promise.all([
        db.selectFrom('inquiries').select((eb) => eb.fn.countAll<number>().as('n')).where('seen_at', 'is', null).executeTakeFirst(),
        inquiryQuery(db).where('i.seen_at', 'is', null).orderBy('i.created_at', 'desc').limit(limit).execute(),
    ]);
    return { count: Number(count?.n ?? 0), items: rows.map(toSummary) };
}

export async function inquiriesForPerson(db: Q, personId: string): Promise<InquirySummary[]> {
    const rows = await inquiryQuery(db).where('i.person_id', '=', personId).orderBy('i.created_at', 'desc').execute();
    return rows.map(toSummary);
}
