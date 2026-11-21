import { SHIPPING_LABELS_MAX, type ShippingLabelSource, type WorkSummary } from '@twelveten/shared';
import type { DB } from '../db/index.ts';
import { filteredWorks, summaryQuery, toSummary } from '../inventory/queries.ts';
import { getSettings } from '../invoices/queries.ts';
import { fittedImage } from '../lib/pdfImages.ts';
import { HttpError } from '../routes/admin/errors.ts';
import type { Storage } from '../storage/uploads.ts';
import { addressLines, LABEL_IMAGE_BOX, renderLabelPdf, type LabelImages, type LabelWork } from './labelPdf.ts';

/** The works a label PDF is for, in label order, and a name for the file. */
export async function labelWorks(db: DB, source: ShippingLabelSource): Promise<{ works: WorkSummary[]; name: string }> {
    switch (source.kind) {
        case 'works': {
            const rows = await summaryQuery(db).where('w.id', 'in', source.workIds).execute();
            const byId = new Map(rows.map((r) => [r.id, toSummary(r)]));
            const works = [...new Set(source.workIds)].map((id) => byId.get(id)).filter((w): w is WorkSummary => Boolean(w));
            if (works.length !== new Set(source.workIds).size) throw new HttpError(404, 'Work not found');
            const one = works.length === 1 ? works[0]! : null;
            return { works, name: one ? one.inventoryNumber || one.title || 'work' : `${works.length} works` };
        }
        case 'room': {
            const room = await db.selectFrom('viewing_rooms').select('title').where('id', '=', source.roomId).executeTakeFirst();
            if (!room) throw new HttpError(404, 'Room not found');
            const rows = await summaryQuery(db)
                .innerJoin('viewing_room_works as rw', 'rw.work_id', 'w.id')
                .where('rw.room_id', '=', source.roomId)
                .orderBy('rw.position')
                .limit(SHIPPING_LABELS_MAX + 1)
                .execute();
            if (rows.length > SHIPPING_LABELS_MAX) throw new HttpError(400, `At most ${SHIPPING_LABELS_MAX} labels at a time`);
            return { works: rows.map(toSummary), name: room.title };
        }
        case 'inventory': {
            const rows = await filteredWorks(db, {
                artistId: source.artist ?? undefined,
                statuses: source.statuses,
                location: source.location ?? undefined,
                q: source.q || undefined,
            })
                .limit(SHIPPING_LABELS_MAX + 1)
                .execute();
            if (rows.length > SHIPPING_LABELS_MAX) throw new HttpError(400, `More than ${SHIPPING_LABELS_MAX} works match; narrow the filters`);
            return { works: rows.map(toSummary), name: 'inventory' };
        }
    }
}

/** Fitted JPEGs for the label image box, a few at a time; missing ones are left out. */
async function labelImages(storage: Storage | undefined, urls: string[]): Promise<LabelImages> {
    const out: LabelImages = new Map();
    const queue = [...new Set(urls)];
    await Promise.all(
        Array.from({ length: 3 }, async () => {
            for (let url = queue.shift(); url; url = queue.shift()) {
                const img = await fittedImage(storage, url, LABEL_IMAGE_BOX.width, LABEL_IMAGE_BOX.height);
                if (img) out.set(url, img);
            }
        }),
    );
    return out;
}

/** The label PDF and its file name ("Shipping labels - Spring room.pdf"). */
export async function buildShippingLabels(
    db: DB,
    storage: Storage | undefined,
    input: { source: ShippingLabelSource; destination: string; returnAddress: string | null },
): Promise<{ pdf: Buffer; filename: string }> {
    const [{ works, name }, settings] = await Promise.all([labelWorks(db, input.source), getSettings(db)]);
    if (!works.length) throw new HttpError(400, 'No works to label');
    const returnAddress = input.returnAddress ? addressLines(input.returnAddress) : [settings.galleryName, ...addressLines(settings.address)].filter(Boolean);
    const items: LabelWork[] = works.map((w) => ({
        artistName: w.artistName,
        title: w.title,
        dateText: w.dateText,
        medium: w.medium,
        dimensions: w.dimensions,
        inventoryNumber: w.inventoryNumber,
        imageUrl: w.image?.url ?? null,
    }));
    const images = await labelImages(storage, items.flatMap((w) => (w.imageUrl ? [w.imageUrl] : [])));
    const pdf = await renderLabelPdf(items, { galleryName: settings.galleryName, returnAddress, destination: addressLines(input.destination) }, images);
    const label = works.length === 1 ? 'Shipping label' : 'Shipping labels';
    const filename = `${label} - ${name}`.replace(/[^\w\- ,]+/g, '').slice(0, 80).trim();
    return { pdf, filename: `${filename}.pdf` };
}
