import type {
    AddressAttach,
    AddressLink,
    AddressLinkPatch,
    AddressPatch,
    Address,
    AddressEntity,
    Artwork,
    ArtworkLinkInput,
    ArtistProfilePut,
    CollectorProfilePut,
    Invoice,
    InvoiceCreate,
    InvoiceItemPatch,
    InvoicePatch,
    InvoicePaymentCreate,
    InvoiceSettings,
    InvoiceSettingsPut,
    InvoiceStatus,
    InvoiceSummary,
    NumberedPage,
    Person,
    PersonCreate,
    PersonPatch,
    PersonSummary,
    ProfileFilter,
    Work,
    WorkChange,
    WorkCreate,
    WorkPatch,
    WorkStatus,
    WorkSummary,
} from '@twelveten/shared';
import { api } from '@/api/client';

/** Back-office (people, profiles, addresses, inventory) API client. Admin-only endpoints. */
const send = <T>(method: string, path: string, body?: unknown) =>
    api.request<T>(`/admin${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });

const qs = (params: Record<string, string | number | null | undefined>) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') s.set(k, String(v));
    const out = s.toString();
    return out ? `?${out}` : '';
};

export type PersonSort = 'name' | 'updated';
export interface PersonQuery {
    q?: string;
    profile?: ProfileFilter | null;
    sort?: PersonSort;
    page?: number;
    limit?: number;
}
export interface WorkQuery {
    q?: string;
    artist?: string | null;
    status?: WorkStatus | null;
    location?: string | null;
    page?: number;
    limit?: number;
}

export interface InvoiceQuery {
    q?: string;
    status?: InvoiceStatus | null;
    person?: string | null;
    page?: number;
    limit?: number;
}

export const boApi = {
    persons: (p: PersonQuery = {}) => send<NumberedPage<PersonSummary>>('GET', `/persons${qs({ ...p })}`),
    person: (id: string) => send<Person>('GET', `/persons/${id}`),
    createPerson: (input: PersonCreate) => send<Person>('POST', '/persons', input),
    patchPerson: (id: string, patch: PersonPatch) => send<Person>('PATCH', `/persons/${id}`, patch),
    deletePerson: (id: string) => send<void>('DELETE', `/persons/${id}`),

    putArtistProfile: (id: string, input: ArtistProfilePut) => send<Person>('PUT', `/persons/${id}/artist-profile`, input),
    deleteArtistProfile: (id: string) => send<Person>('DELETE', `/persons/${id}/artist-profile`),
    putArtistExhibitions: (id: string, exhibitionIds: string[]) => send<Person>('PUT', `/persons/${id}/artist-profile/exhibitions`, { exhibitionIds }),
    cvPdfUrl: (id: string) => `/api/admin/persons/${id}/artist-profile/cv.pdf`,

    addresses: (entity: AddressEntity, id: string) => send<{ items: AddressLink[] }>('GET', `/addresses${qs({ entity, id })}`).then((r) => r.items),
    attachAddress: (input: AddressAttach) => send<{ items: AddressLink[] }>('POST', '/addresses', input).then((r) => r.items),
    patchAddress: (id: string, patch: AddressPatch) => send<Address>('PATCH', `/addresses/${id}`, patch),
    patchAddressLink: (linkId: string, patch: AddressLinkPatch) => send<{ items: AddressLink[] }>('PATCH', `/address-links/${linkId}`, patch).then((r) => r.items),
    detachAddress: (linkId: string) => send<{ items: AddressLink[] }>('DELETE', `/address-links/${linkId}`).then((r) => r.items),

    works: (p: WorkQuery = {}) => send<NumberedPage<WorkSummary>>('GET', `/works${qs({ ...p })}`),
    work: (id: string) => send<Work>('GET', `/works/${id}`),
    createWork: (input: WorkCreate) => send<Work>('POST', '/works', input),
    patchWork: (id: string, patch: WorkPatch) => send<Work>('PATCH', `/works/${id}`, patch),
    deleteWork: (id: string) => send<void>('DELETE', `/works/${id}`),
    workHistory: (id: string) => send<{ items: WorkChange[] }>('GET', `/works/${id}/history`).then((r) => r.items),
    addWorkImage: (id: string, url: string, alt = '') => send<Work>('POST', `/works/${id}/images`, { url, alt }),
    patchWorkImage: (id: string, imageId: string, alt: string) => send<Work>('PATCH', `/works/${id}/images/${imageId}`, { alt }),
    deleteWorkImage: (id: string, imageId: string) => send<Work>('DELETE', `/works/${id}/images/${imageId}`),
    orderWorkImages: (id: string, ids: string[]) => send<Work>('PUT', `/works/${id}/images/order`, { ids }),

    putCollectorProfile: (id: string, input: CollectorProfilePut) => send<Person>('PUT', `/persons/${id}/collector-profile`, input),
    deleteCollectorProfile: (id: string) => send<Person>('DELETE', `/persons/${id}/collector-profile`),

    invoices: (p: InvoiceQuery = {}) => send<NumberedPage<InvoiceSummary>>('GET', `/invoices${qs({ ...p })}`),
    invoice: (id: string) => send<Invoice>('GET', `/invoices/${id}`),
    createInvoice: (input: InvoiceCreate) => send<Invoice>('POST', '/invoices', input),
    patchInvoice: (id: string, patch: InvoicePatch) => send<Invoice>('PATCH', `/invoices/${id}`, patch),
    deleteInvoice: (id: string) => send<void>('DELETE', `/invoices/${id}`),
    addInvoiceItem: (id: string, workId: string) => send<Invoice>('POST', `/invoices/${id}/items`, { workId }),
    patchInvoiceItem: (id: string, itemId: string, patch: InvoiceItemPatch) => send<Invoice>('PATCH', `/invoices/${id}/items/${itemId}`, patch),
    deleteInvoiceItem: (id: string, itemId: string) => send<Invoice>('DELETE', `/invoices/${id}/items/${itemId}`),
    addPayment: (id: string, input: InvoicePaymentCreate) => send<Invoice>('POST', `/invoices/${id}/payments`, input),
    deletePayment: (id: string, paymentId: string) => send<Invoice>('DELETE', `/invoices/${id}/payments/${paymentId}`),
    invoicePdfUrl: (id: string, download = false) => `/api/admin/invoices/${id}/invoice.pdf${download ? '?download=1' : ''}`,
    invoiceSettings: () => send<InvoiceSettings>('GET', '/invoice-settings'),
    putInvoiceSettings: (input: InvoiceSettingsPut) => send<InvoiceSettings>('PUT', '/invoice-settings', input),

    linkArtwork: (artworkId: string, input: ArtworkLinkInput) => send<Artwork>('POST', `/artworks/${artworkId}/link`, input),
};
