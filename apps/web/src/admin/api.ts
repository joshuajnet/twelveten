import type {
    Artwork,
    ArtworkCreate,
    ArtworkPatch,
    EventInput,
    Exhibition,
    ExhibitionCreate,
    ExhibitionPatch,
    HomePage,
    HomePatch,
    NewsCreate,
    NewsPatch,
    NewsPost,
    PressCreate,
    PressItem,
    PressPatch,
    RevisionEntityName,
    RevisionSummary,
    UploadRequest,
    UploadTicket,
} from '@twelveten/shared';
import { adminSend as send, api, ApiError, qs } from '@/api/client';

export const adminApi = {
    exhibition: (id: string) => send<Exhibition>('GET', `/exhibitions/${id}`),
    createExhibition: (input: ExhibitionCreate) => send<Exhibition>('POST', '/exhibitions', input),
    patchExhibition: (id: string, patch: ExhibitionPatch) => send<Exhibition>('PATCH', `/exhibitions/${id}`, patch),
    deleteExhibition: (id: string) => send<void>('DELETE', `/exhibitions/${id}`),
    putEvents: (id: string, events: EventInput[]) => send<Exhibition>('PUT', `/exhibitions/${id}/events`, { events }),
    addArtwork: (exhibitionId: string, input: ArtworkCreate) => send<Artwork>('POST', `/exhibitions/${exhibitionId}/artworks`, input),
    patchArtwork: (id: string, patch: ArtworkPatch) => send<Artwork>('PATCH', `/artworks/${id}`, patch),
    deleteArtwork: (id: string) => send<void>('DELETE', `/artworks/${id}`),
    orderArtworks: (exhibitionId: string, ids: string[]) => send<Artwork[]>('PUT', `/exhibitions/${exhibitionId}/artworks/order`, { ids }),
    createNews: (input: NewsCreate) => send<NewsPost>('POST', '/news', input),
    patchNews: (id: string, patch: NewsPatch) => send<NewsPost>('PATCH', `/news/${id}`, patch),
    deleteNews: (id: string) => send<void>('DELETE', `/news/${id}`),
    createPress: (input: PressCreate) => send<PressItem>('POST', '/press', input),
    patchPress: (id: string, patch: PressPatch) => send<PressItem>('PATCH', `/press/${id}`, patch),
    deletePress: (id: string) => send<void>('DELETE', `/press/${id}`),
    patchHome: (patch: HomePatch) => send<HomePage>('PATCH', '/home', patch),
    revisions: (entity: RevisionEntityName, id: string | null) =>
        send<{ items: RevisionSummary[] }>('GET', `/revisions${qs({ entity, id })}`).then((r) => r.items),
    restore: (revisionId: string) => send<{ ok: true }>('POST', `/revisions/${revisionId}/restore`),
    deleted: () =>
        send<{ items: { revisionId: string; entity: string; entityId: string; title: string; detail: string; deletedAt: string; userName: string | null }[] }>('GET', '/deleted').then(
            (r) => r.items,
        ),
    upload: (req: UploadRequest) => send<UploadTicket>('POST', '/uploads', req),
    rebuild: () => send<{ pages: number }>('POST', '/publish/rebuild'),
};

export function isConflict(e: unknown): e is ApiError {
    return e instanceof ApiError && e.status === 409;
}

export function errorMessage(e: unknown): string {
    return e instanceof Error ? e.message : 'Something went wrong';
}

export async function signIn(email: string, password: string) {
    return api.request<{ user: { id: string } }>('/auth/sign-in/email', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export async function signOut() {
    return api.request<unknown>('/auth/sign-out', { method: 'POST', body: '{}' });
}

/** The server's current copy carried by a 409 conflict, if any. */
export function conflictCurrent<T>(e: unknown): T | null {
    return isConflict(e) ? (((e.details as { current?: T } | undefined)?.current ?? null) as T | null) : null;
}
