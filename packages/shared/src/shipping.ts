/** Shipping labels: a printable PDF with one page per work (admin-only). */
import { z } from 'zod';
import { schemas } from './content.ts';
import { workLocation, workStatus } from './inventory.ts';

const { uuid } = schemas;

/** Most works one label PDF may hold. */
export const SHIPPING_LABELS_MAX = 200;

const address = z.string().trim().min(1, 'Enter an address').max(1000);

export const shippingLabelSource = z.discriminatedUnion('kind', [
    /** These works, in this order. */
    z.object({ kind: z.literal('works'), workIds: z.array(uuid).min(1, 'Choose at least one work').max(SHIPPING_LABELS_MAX) }),
    /** Every work in the room (hidden ones too), in room order. */
    z.object({ kind: z.literal('room'), roomId: uuid }),
    /** Every inventory work matching these filters (as the inventory list). */
    z.object({
        kind: z.literal('inventory'),
        artist: uuid.nullish(),
        statuses: z.array(workStatus).optional(),
        location: workLocation.nullish(),
        q: z.string().trim().max(200).nullish(),
    }),
]);
export type ShippingLabelSource = z.infer<typeof shippingLabelSource>;

export const shippingLabelsSchema = z.object({
    source: shippingLabelSource,
    /** Ship-to address, one line per line. */
    destination: address,
    /** Return address as typed; null: the gallery's name and address (invoice settings). */
    returnAddress: address.nullable().default(null),
});
export type ShippingLabelsInput = z.input<typeof shippingLabelsSchema>;
