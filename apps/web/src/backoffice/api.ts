import type {
    ArtistPressAdd,
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
    PersonDuplicate,
    PersonMerge,
    PointerData,
    RoomArtistsPut,
    RoomCreate,
    RoomDashboard,
    RoomPatch,
    RoomStatus,
    RoomSummary,
    RoomWorksPut,
    ViewingRoom,
    RoomPdfStatus,
    VisitorDashboard,
    InquirySummary,
    ShippingLabelsInput,
} from '@twelveten/shared';
import { adminSend as send, adminSendBlob, qs } from '@/api/client';

/** Back-office (people, profiles, addresses, inventory, invoices) API client. Admin-only endpoints. */

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
    /** Only these statuses; empty or absent lists every work. */
    statuses?: WorkStatus[];
    location?: string | null;
    page?: number;
    limit?: number;
}

/** A list filter as the API takes it: comma-separated, or nothing. */
const csv = (values?: readonly string[]) => (values?.length ? values.join(',') : null);

export interface InvoiceQuery {
    q?: string;
    /** Only these statuses; empty or absent lists every invoice. */
    statuses?: InvoiceStatus[];
    person?: string | null;
    page?: number;
    limit?: number;
}

export interface RoomQuery {
    q?: string;
    /** Only these statuses; empty or absent lists every room. */
    statuses?: RoomStatus[];
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
    addArtistPress: (id: string, input: ArtistPressAdd) => send<Person>('POST', `/persons/${id}/artist-profile/press`, input),
    removeArtistPress: (id: string, pressId: string) => send<Person>('DELETE', `/persons/${id}/artist-profile/press/${pressId}`),
    cvPdfUrl: (id: string) => `/api/admin/persons/${id}/artist-profile/cv.pdf`,

    addresses: (entity: AddressEntity, id: string) => send<{ items: AddressLink[] }>('GET', `/addresses${qs({ entity, id })}`).then((r) => r.items),
    attachAddress: (input: AddressAttach) => send<{ items: AddressLink[] }>('POST', '/addresses', input).then((r) => r.items),
    patchAddress: (id: string, patch: AddressPatch) => send<Address>('PATCH', `/addresses/${id}`, patch),
    patchAddressLink: (linkId: string, patch: AddressLinkPatch) => send<{ items: AddressLink[] }>('PATCH', `/address-links/${linkId}`, patch).then((r) => r.items),
    detachAddress: (linkId: string) => send<{ items: AddressLink[] }>('DELETE', `/address-links/${linkId}`).then((r) => r.items),

    works: ({ statuses, ...p }: WorkQuery = {}) => send<NumberedPage<WorkSummary>>('GET', `/works${qs({ ...p, status: csv(statuses) })}`),
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

    invoices: ({ statuses, ...p }: InvoiceQuery = {}) => send<NumberedPage<InvoiceSummary>>('GET', `/invoices${qs({ ...p, status: csv(statuses) })}`),
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

    duplicates: (page = 1) => send<NumberedPage<PersonDuplicate>>('GET', `/persons/duplicates${qs({ page })}`),
    duplicateCount: () => send<{ count: number }>('GET', '/persons/duplicates/count').then((r) => r.count),
    duplicatesOf: (id: string) => send<{ items: PersonDuplicate[] }>('GET', `/persons/${id}/duplicates`).then((r) => r.items),
    dismissDuplicate: (aId: string, bId: string) => send<void>('POST', '/persons/duplicates/dismiss', { aId, bId }),
    mergePerson: (id: string, input: PersonMerge) => send<Person>('POST', `/persons/${id}/merge`, input),
    putPersonEmails: (id: string, emails: string[]) => send<Person>('PUT', `/persons/${id}/emails`, { emails }),

    rooms: ({ statuses, ...p }: RoomQuery = {}) => send<NumberedPage<RoomSummary>>('GET', `/rooms${qs({ ...p, status: csv(statuses) })}`),
    duplicateRoom: (id: string) => send<ViewingRoom>('POST', `/rooms/${id}/duplicate`),
    room: (id: string) => send<ViewingRoom>('GET', `/rooms/${id}`),
    createRoom: (input: RoomCreate) => send<ViewingRoom>('POST', '/rooms', input),
    patchRoom: (id: string, patch: RoomPatch) => send<ViewingRoom>('PATCH', `/rooms/${id}`, patch),
    deleteRoom: (id: string) => send<void>('DELETE', `/rooms/${id}`),
    putRoomWorks: (id: string, input: RoomWorksPut) => send<ViewingRoom>('PUT', `/rooms/${id}/works`, input),
    putRoomArtists: (id: string, input: RoomArtistsPut) => send<ViewingRoom>('PUT', `/rooms/${id}/artists`, input),
    roomPdfUrl: (id: string) => `/api/admin/rooms/${id}/room.pdf`,
    /** Shipping labels PDF (a POST: the addresses stay out of URLs). */
    shippingLabels: (input: ShippingLabelsInput) => adminSendBlob('POST', '/shipping-labels.pdf', input),
    roomPdf: (id: string) => send<RoomPdfStatus | null>('GET', `/rooms/${id}/pdf`),
    generateRoomPdf: (id: string) => send<RoomPdfStatus>('POST', `/rooms/${id}/pdf`),
    removeRoomPdf: (id: string) => send<void>('DELETE', `/rooms/${id}/pdf`),
    newRoomLink: (id: string) => send<ViewingRoom>('POST', `/rooms/${id}/token`),
    roomDashboard: (id: string) => send<RoomDashboard>('GET', `/rooms/${id}/dashboard`),
    visitorDashboard: (roomId: string, visitorId: string) => send<VisitorDashboard>('GET', `/rooms/${roomId}/visitors/${visitorId}`),
    inquiries: (p: { status?: 'new' | 'all'; q?: string; page?: number; limit?: number } = {}) => send<NumberedPage<InquirySummary>>('GET', `/inquiries${qs({ ...p })}`),
    unseenInquiries: () => send<{ count: number; items: InquirySummary[] }>('GET', '/inquiries/unseen'),
    dismissInquiry: (id: string) => send<InquirySummary>('POST', `/inquiries/${id}/seen`),
    dismissAllInquiries: () => send<{ dismissed: number }>('POST', '/inquiries/seen'),
    deleteInquiry: (id: string) => send<void>('DELETE', `/inquiries/${id}`),
    deleteVisitor: (roomId: string, visitorId: string) => send<void>('DELETE', `/rooms/${roomId}/visitors/${visitorId}`),
    visitorPointer: (roomId: string, visitorId: string, workId?: string) =>
        send<{ items: PointerData[] }>('GET', `/rooms/${roomId}/visitors/${visitorId}/pointer${qs({ work: workId })}`).then((r) => r.items),
};

/** The public link of a viewing room. */
export const roomUrl = (token: string) => `${location.origin}/rooms/${token}`;
