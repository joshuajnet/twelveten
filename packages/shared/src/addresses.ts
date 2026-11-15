/** Structured addresses that can be attached to any entity (people today). */
import { z } from 'zod';
import { schemas } from './content.ts';

const { isoTimestamp, uuid } = schemas;
const text = z.string().trim();
const optionalText = text.nullable();

/** Entities an address can be attached to. Widen together with the `address_links.entity` CHECK. */
export const addressEntity = z.enum(['person']);
export type AddressEntity = z.infer<typeof addressEntity>;

export const countryCode = z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .pipe(z.string().regex(/^[A-Z]{2}$/, 'Two-letter country code'));

const addressFields = {
    line1: text,
    line2: optionalText,
    city: optionalText,
    region: optionalText,
    postalCode: optionalText,
    country: countryCode,
    notes: optionalText,
};
/** A new address: missing fields take their defaults. */
export const addressFieldsSchema = z.object({
    line1: addressFields.line1.default(''),
    line2: addressFields.line2.default(null),
    city: addressFields.city.default(null),
    region: addressFields.region.default(null),
    postalCode: addressFields.postalCode.default(null),
    country: addressFields.country.default('US'),
    notes: addressFields.notes.default(null),
});
export type AddressFields = z.input<typeof addressFieldsSchema>;

export const addressSchema = z.object({
    id: uuid,
    line1: z.string(),
    line2: z.string().nullable(),
    city: z.string().nullable(),
    region: z.string().nullable(),
    postalCode: z.string().nullable(),
    country: z.string(),
    notes: z.string().nullable(),
    updatedAt: isoTimestamp,
});
export type Address = z.infer<typeof addressSchema>;

/** An address as attached to one owner. */
export interface AddressLink {
    linkId: string;
    label: string | null;
    isPrimary: boolean;
    position: number;
    /** How many owners share this address (editing it changes it for all of them). */
    sharedWith: number;
    address: Address;
}

export const addressAttachSchema = z
    .object({
        entity: addressEntity,
        entityId: uuid,
        label: optionalText.optional(),
        isPrimary: z.boolean().optional(),
        addressId: uuid.optional(),
        address: addressFieldsSchema.optional(),
    })
    .refine((v) => Boolean(v.addressId) !== Boolean(v.address), 'Send either addressId or address');
export type AddressAttach = z.input<typeof addressAttachSchema>;

/** Only the fields sent are changed (no defaults, unlike addressFieldsSchema). */
export const addressPatchSchema = z.object(addressFields).partial().extend({ updatedAt: isoTimestamp });
export type AddressPatch = z.input<typeof addressPatchSchema>;

export const addressLinkPatchSchema = z.object({
    label: optionalText.optional(),
    isPrimary: z.boolean().optional(),
    position: z.number().int().min(0).optional(),
});
export type AddressLinkPatch = z.infer<typeof addressLinkPatchSchema>;

/** Display lines for an address, e.g. ['12 Main St', 'Apt 2', 'Tulsa, OK 74103', 'US']. */
export function formatAddress(a: Pick<Address, 'line1' | 'line2' | 'city' | 'region' | 'postalCode' | 'country'>, home = 'US'): string[] {
    const cityLine = [a.city, [a.region, a.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    return [a.line1, a.line2 ?? '', cityLine, a.country === home ? '' : a.country].map((l) => l.trim()).filter(Boolean);
}
