<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import Sortable from 'sortablejs';
import { formatPrice, ROOM_STATUSES, type RichDoc, type RoomArtistSettings, type RoomStatus, type RoomWorkSettings, type ViewingRoom, type WorkSummary } from '@twelveten/shared';
import Field from '@/admin/ui/Field.vue';
import SelectField from '@/admin/ui/SelectField.vue';
import Switch from '@/admin/ui/Switch.vue';
import Dialog from '@/admin/ui/Dialog.vue';
import RichEditor from '@/admin/RichEditor.vue';
import HistoryDialog from '@/admin/HistoryDialog.vue';
import { ApiError } from '@/api/client';
import { errorMessage, isConflict } from '@/admin/api';
import { askConflict, toast } from '@/admin/state';
import { btnDanger, btnGhost, btnOutline, btnPrimary } from '@/admin/ui/buttons';
import { boApi, roomUrl } from '../api';
import { useUnsavedGuard } from '../guard';
import WorkPicker from '../WorkPicker.vue';
import StatusBadge from '../StatusBadge.vue';
import RoomStatusBadge from './RoomStatusBadge.vue';
import ArtImage from '@/components/ArtImage.vue';

/** Create or edit a viewing room: details, works (from the inventory), artist details, the link. */
const route = useRoute();
const router = useRouter();
const id = computed(() => String(route.params.id));
const isNew = computed(() => id.value === 'new');

const room = ref<ViewingRoom | null>(null);
const notFound = ref(false);
const emptyDoc = (): RichDoc => ({ type: 'doc', content: [] });

const form = reactive({
    title: '' as string | null,
    intro: emptyDoc(),
    status: 'draft' as RoomStatus,
    opensAt: null as string | null,
    closesAt: null as string | null,
    showPrices: false,
    hideUnavailable: false,
});
const works = ref<RoomWorkSettings[]>([]);
const artists = ref<RoomArtistSettings[]>([]);

/** ISO ↔ the value of a datetime-local input (local time). */
const toLocal = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const fromLocal = (v: string | null) => (v ? new Date(v).toISOString() : null);

const fieldsJson = () =>
    JSON.stringify({ ...form, title: form.title?.trim() ?? '', opensAt: fromLocal(form.opensAt), closesAt: fromLocal(form.closesAt) });
const worksJson = () => JSON.stringify(works.value.map((w) => [w.workId, w.showPrice, w.hidden]));
const artistsJson = () => JSON.stringify(artists.value.map((a) => [a.artistId, a.showBio, a.showCv, a.showPress, [...a.hiddenPressIds].sort()]));
const base = reactive({ fields: '', works: '', artists: '' });
const fieldsDirty = computed(() => fieldsJson() !== base.fields);
const worksDirty = computed(() => worksJson() !== base.works);
const artistsDirty = computed(() => artistsJson() !== base.artists);
const dirty = computed(() => isNew.value || fieldsDirty.value || worksDirty.value || artistsDirty.value);
useUnsavedGuard(computed(() => !saving.value && (fieldsDirty.value || worksDirty.value || artistsDirty.value) && !(isNew.value && !form.title && !works.value.length)));

function reset(r: ViewingRoom | null) {
    room.value = r;
    form.title = r?.title ?? '';
    form.intro = r?.intro ?? emptyDoc();
    form.status = r?.status ?? 'draft';
    form.opensAt = toLocal(r?.opensAt ?? null);
    form.closesAt = toLocal(r?.closesAt ?? null);
    form.showPrices = r?.showPrices ?? false;
    form.hideUnavailable = r?.hideUnavailable ?? false;
    works.value = (r?.works ?? []).map((w) => ({ ...w }));
    artists.value = (r?.artists ?? []).map((a) => ({ ...a, hiddenPressIds: [...a.hiddenPressIds] }));
    base.fields = fieldsJson();
    base.works = worksJson();
    base.artists = artistsJson();
}

async function load() {
    notFound.value = false;
    if (isNew.value) return reset(null);
    try {
        reset(await boApi.room(id.value));
    } catch (e) {
        if (e instanceof ApiError && e.status === 404) notFound.value = true;
        else toast(errorMessage(e), 'error');
    }
}
watch(id, () => void load(), { immediate: true });

// ---- Works ----
const picking = ref(false);
const selectedIds = computed(() => works.value.map((w) => w.workId));
function toggleWork(w: WorkSummary) {
    if (selectedIds.value.includes(w.id)) works.value = works.value.filter((x) => x.workId !== w.id);
    else works.value = [...works.value, { workId: w.id, showPrice: null, hidden: false, work: w }];
}
const removeWork = (workId: string) => (works.value = works.value.filter((w) => w.workId !== workId));
const priceShown = (w: RoomWorkSettings) => w.work.status === 'available' && (w.showPrice ?? form.showPrices) && w.work.priceCents !== null;
/** What viewers will see for a work. */
function viewerNote(w: RoomWorkSettings): string {
    if (w.hidden) return 'Hidden from viewers';
    if (w.work.status !== 'available') return form.hideUnavailable ? 'Hidden (unavailable works are hidden)' : `Shown as “${w.work.status === 'sold' ? 'Sold' : w.work.status === 'on_hold' ? 'On hold' : 'Not available'}”, no Inquire`;
    return priceShown(w) ? `Price shown: ${formatPrice(w.work.priceCents, w.work.currency)}` : 'Price hidden';
}
const unavailableCount = computed(() => works.value.filter((w) => w.work.status !== 'available' && !w.hidden).length);

const list = ref<HTMLElement>();
let sortable: Sortable | null = null;
function initSortable() {
    sortable?.destroy();
    if (!list.value) return;
    sortable = Sortable.create(list.value, {
        animation: 150,
        handle: '[data-drag]',
        onEnd: (evt) => {
            const { oldIndex, newIndex, item, from } = evt;
            if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) return;
            // Put the DOM back and let Vue re-render from data.
            from.removeChild(item);
            from.insertBefore(item, from.children[oldIndex] ?? null);
            const next = [...works.value];
            const [moved] = next.splice(oldIndex, 1);
            next.splice(newIndex, 0, moved!);
            works.value = next;
        },
    });
}
watch(list, () => void nextTick(initSortable));
onBeforeUnmount(() => sortable?.destroy());

function moveArtist(i: number, step: number) {
    const next = [...artists.value];
    const j = i + step;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    artists.value = next;
}
const shownPress = (a: RoomArtistSettings) => a.press.filter((p) => !a.hiddenPressIds.includes(p.id)).length;
function togglePress(a: RoomArtistSettings, pressId: string, shown: boolean) {
    a.hiddenPressIds = shown ? a.hiddenPressIds.filter((x) => x !== pressId) : [...a.hiddenPressIds, pressId];
}

// ---- Save ----
const saving = ref(false);
function fields() {
    return {
        title: form.title?.trim() ?? '',
        intro: form.intro,
        status: form.status,
        opensAt: fromLocal(form.opensAt),
        closesAt: fromLocal(form.closesAt),
        showPrices: form.showPrices,
        hideUnavailable: form.hideUnavailable,
    };
}
const worksPayload = () => ({ works: works.value.map((w) => ({ workId: w.workId, showPrice: w.showPrice, hidden: w.hidden })) });

async function save(overwrite = false): Promise<void> {
    if (!form.title?.trim()) return void toast('Give the room a title', 'error');
    saving.value = true;
    try {
        if (isNew.value) {
            let r = await boApi.createRoom({ ...fields(), works: selectedIds.value });
            if (works.value.some((w) => w.showPrice !== null || w.hidden)) r = await boApi.putRoomWorks(r.id, worksPayload());
            reset(r);
            toast('Room created', 'success', 1500);
            await router.replace({ name: 'bo-room', params: { id: r.id } });
            return;
        }
        let r = overwrite ? await boApi.room(id.value) : room.value!;
        if (fieldsDirty.value || overwrite) r = await boApi.patchRoom(r.id, { ...fields(), updatedAt: r.updatedAt });
        if (worksDirty.value) r = await boApi.putRoomWorks(r.id, worksPayload());
        if (artistsDirty.value) {
            // The server's artist list follows the works; keep our settings for artists still there.
            const mine = new Map(artists.value.map((a, i) => [a.artistId, { a, i }]));
            const ordered = [...r.artists].sort((x, y) => (mine.get(x.artistId)?.i ?? 1e6) - (mine.get(y.artistId)?.i ?? 1e6));
            r = await boApi.putRoomArtists(r.id, {
                artists: ordered.map((s) => {
                    const a = mine.get(s.artistId)?.a ?? s;
                    return { artistId: s.artistId, showBio: a.showBio, showCv: a.showCv, showPress: a.showPress, hiddenPressIds: a.hiddenPressIds };
                }),
            });
        }
        reset(r);
        toast('Saved', 'success', 1500);
    } catch (e) {
        if (isConflict(e)) {
            const choice = await askConflict();
            if (choice === 'overwrite') return save(true);
            await load();
            toast('Reloaded the latest version', 'info');
        } else toast(errorMessage(e), 'error');
    } finally {
        saving.value = false;
    }
}
function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (dirty.value) void save();
    }
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

// ---- Link ----
const link = computed(() => (room.value ? roomUrl(room.value.token) : ''));
async function copyLink() {
    try {
        await navigator.clipboard.writeText(link.value);
        toast('Link copied', 'success', 1500);
    } catch {
        toast('Copy the link from the box', 'info');
    }
}
const confirmNewLink = ref(false);
async function newLink() {
    confirmNewLink.value = false;
    try {
        reset(await boApi.newRoomLink(id.value));
        toast('New link made; the old one no longer works', 'success');
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}

// ---- Delete / history ----
const historyOpen = ref(false);
const confirmDelete = ref(false);
async function remove() {
    confirmDelete.value = false;
    try {
        await boApi.deleteRoom(id.value);
        base.fields = fieldsJson();
        base.works = worksJson();
        base.artists = artistsJson();
        toast('Room deleted', 'success');
        await router.push({ name: 'bo-rooms' });
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}

const statusOptions = Object.entries(ROOM_STATUSES).map(([value, label]) => ({ value: value as RoomStatus, label }));
const priceOptions = [
    { value: 'inherit', label: 'Room setting' },
    { value: 'show', label: 'Show price' },
    { value: 'hide', label: 'Hide price' },
];
const priceMode = (w: RoomWorkSettings) => (w.showPrice === null ? 'inherit' : w.showPrice ? 'show' : 'hide');
const setPriceMode = (w: RoomWorkSettings, v: string) => (w.showPrice = v === 'inherit' ? null : v === 'show');
</script>

<template>
    <div v-if="notFound" class="py-16 text-center">
        <p class="mb-4 text-slate-600">This viewing room doesn’t exist (it may have been deleted).</p>
        <RouterLink :to="{ name: 'bo-rooms' }" :class="btnOutline">Back to viewing rooms</RouterLink>
    </div>
    <div v-else-if="!isNew && !room" class="py-16 text-center text-sm text-slate-500">Loading…</div>
    <div v-else class="space-y-6">
        <RouterLink :to="{ name: 'bo-rooms' }" class="text-sm text-sky-800 hover:underline">← Viewing rooms</RouterLink>

        <div class="flex flex-wrap items-center gap-3">
            <h1 class="text-2xl font-semibold">{{ isNew ? 'New viewing room' : room!.title }}</h1>
            <RoomStatusBadge v-if="room" :room="room" />
            <span class="flex-1" />
            <span v-if="dirty && !isNew" class="text-xs text-amber-700">● Unsaved changes</span>
            <template v-if="room">
                <RouterLink :to="{ name: 'bo-room-dashboard', params: { id: room.id } }" :class="btnOutline">Dashboard</RouterLink>
                <button type="button" :class="btnGhost" @click="historyOpen = true">History</button>
            </template>
            <button type="button" :class="btnPrimary" :disabled="saving || !dirty" title="Save (Ctrl+S)" data-testid="save-room" @click="save()">
                {{ saving ? 'Saving…' : isNew ? 'Create room' : 'Save' }}
            </button>
        </div>

        <!-- Link -->
        <section v-if="room" aria-labelledby="link-h" class="rounded-md border border-slate-200 bg-white p-4">
            <h2 id="link-h" class="mb-2 text-sm font-semibold">Link</h2>
            <div class="flex flex-wrap items-center gap-2">
                <input :value="link" readonly aria-label="Room link" class="min-w-0 flex-1 rounded border border-slate-300 bg-slate-50 px-2 py-1.5 font-mono text-xs" data-testid="room-link" @focus="($event.target as HTMLInputElement).select()" />
                <button type="button" :class="btnOutline" @click="copyLink">Copy</button>
                <a :href="`/rooms/${room.token}?preview=1`" target="_blank" rel="noopener" :class="btnOutline">Preview ↗</a>
                <button type="button" :class="btnGhost" @click="confirmNewLink = true">New link…</button>
            </div>
            <p class="mt-1 text-xs text-slate-500">
                Anyone with the link sees a form for their name and email first.
                <template v-if="room.status !== 'live'">The link works once the room is <strong>Live</strong>.</template>
            </p>
        </section>

        <!-- Details -->
        <section aria-labelledby="details-h" class="grid gap-x-6 rounded-md border border-slate-200 bg-white p-4 md:grid-cols-2">
            <div>
                <h2 id="details-h" class="mb-1 text-sm font-semibold">Details</h2>
                <Field v-model="form.title" label="Title" placeholder="e.g. Autumn preview for Pat" />
                <SelectField v-model="form.status" label="Status" :options="statusOptions" hint="Draft and closed rooms can’t be opened with the link." />
                <div class="grid grid-cols-2 gap-x-3">
                    <Field v-model="form.opensAt" label="Opens (optional)" type="datetime-local" />
                    <Field v-model="form.closesAt" label="Closes (optional)" type="datetime-local" />
                </div>
            </div>
            <div>
                <h2 class="mb-1 text-sm font-semibold">Display</h2>
                <Switch v-model="form.showPrices" label="Show prices" hint="For available works; each work can override this." />
                <Switch v-model="form.hideUnavailable" label="Hide unavailable works" hint="Works that are sold, on hold or not for sale disappear, including ones sold after the room is sent. Otherwise they show their status without Inquire." />
                <h3 class="mb-1 mt-3 text-xs font-medium text-slate-600">Introduction (optional)</h3>
                <div class="bo-rich rounded border border-slate-200 p-2"><RichEditor v-model="form.intro" news placeholder="A note for the viewer…" /></div>
            </div>
        </section>

        <!-- Works -->
        <section aria-labelledby="works-h" class="rounded-md border border-slate-200 bg-white p-4">
            <div class="mb-3 flex flex-wrap items-center gap-2">
                <h2 id="works-h" class="text-sm font-semibold">Works ({{ works.length }})</h2>
                <span v-if="unavailableCount" class="text-xs text-amber-700">{{ unavailableCount }} not available</span>
                <span class="flex-1" />
                <button type="button" :class="btnPrimary" data-testid="add-room-works" @click="picking = true">+ Add works</button>
            </div>
            <ol v-if="works.length" ref="list" class="divide-y divide-slate-100" data-testid="room-works">
                <li
                    v-for="w in works"
                    :key="w.workId"
                    class="flex flex-wrap items-center gap-3 py-2"
                    :class="{ 'bg-amber-50/60': w.work.status !== 'available' && !w.hidden, 'opacity-60': w.hidden }"
                >
                    <div class="flex min-w-0 flex-1 basis-64 items-center gap-3">
                    <button type="button" data-drag class="cursor-grab px-1 text-slate-400 hover:text-slate-700" aria-label="Drag to reorder" title="Drag to reorder">⠿</button>
                    <span class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-100">
                        <ArtImage sizes="64px" v-if="w.work.image" :src="w.work.image.url" alt="" class="h-full w-full object-contain" />
                    </span>
                    <div class="min-w-0 flex-1 text-sm">
                        <RouterLink :to="{ name: 'bo-work', params: { id: w.workId } }" class="font-medium italic text-sky-900 hover:underline">{{ w.work.title || 'Untitled' }}</RouterLink>
                        <span v-if="w.work.dateText">, {{ w.work.dateText }}</span>
                        <div class="text-slate-600">{{ w.work.artistName }}</div>
                        <div class="text-xs text-slate-500">{{ viewerNote(w) }}</div>
                    </div>
                    </div>
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-8 sm:pl-0">
                    <StatusBadge :status="w.work.status" />
                    <label class="text-xs">
                        <span class="sr-only">Price for {{ w.work.title }}</span>
                        <select :value="priceMode(w)" class="rounded border border-slate-300 bg-white px-1.5 py-1 text-xs" :disabled="w.work.status !== 'available'" @change="setPriceMode(w, ($event.target as HTMLSelectElement).value)">
                            <option v-for="o in priceOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
                        </select>
                    </label>
                    <label class="flex items-center gap-1 text-xs" :class="w.work.status !== 'available' ? 'font-medium text-amber-900' : 'text-slate-600'">
                        <input v-model="w.hidden" type="checkbox" class="h-3.5 w-3.5" />
                        Hide from viewers
                    </label>
                    <button type="button" class="text-xs text-red-700 hover:underline" :aria-label="`Remove ${w.work.title}`" @click="removeWork(w.workId)">Remove</button>
                    </div>
                </li>
            </ol>
            <p v-else class="rounded border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">No works yet. Add works from the inventory.</p>
        </section>

        <!-- Artists -->
        <section v-if="!isNew" aria-labelledby="artists-h" class="rounded-md border border-slate-200 bg-white p-4">
            <h2 id="artists-h" class="mb-1 text-sm font-semibold">Artists ({{ artists.length }})</h2>
            <p class="mb-3 text-xs text-slate-500">
                Choose what viewers can read about each artist. Bio, CV and press come from the artist’s profile.
                <span v-if="worksDirty" class="text-amber-700">Save to update this list for added or removed works.</span>
            </p>
            <ul class="divide-y divide-slate-200 rounded border border-slate-200">
                <li v-for="(a, i) in artists" :key="a.artistId" class="p-3" data-testid="room-artist-settings">
                    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <RouterLink :to="{ name: 'bo-person', params: { id: a.artistId, profile: 'artist' } }" class="min-w-0 flex-1 truncate font-medium text-sky-900 hover:underline">{{ a.name }}</RouterLink>
                        <fieldset class="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
                            <legend class="sr-only">Show viewers {{ a.name }}’s</legend>
                            <span class="mr-1 text-xs text-slate-500" aria-hidden="true">Show viewers:</span>
                            <label class="artist-opt" :class="{ 'artist-opt-off': !a.hasBio }" :title="a.hasBio ? '' : 'This artist has no bio yet'">
                                <input type="checkbox" class="h-3.5 w-3.5" :checked="Boolean(a.hasBio) && a.showBio" :disabled="!a.hasBio" @change="a.showBio = ($event.target as HTMLInputElement).checked" />
                                Bio<span v-if="!a.hasBio" class="text-[11px]"> (none yet)</span>
                            </label>
                            <label class="artist-opt" :class="{ 'artist-opt-off': !a.hasCv }" :title="a.hasCv ? 'With a PDF download' : 'This artist has no CV yet'">
                                <input type="checkbox" class="h-3.5 w-3.5" :checked="Boolean(a.hasCv) && a.showCv" :disabled="!a.hasCv" @change="a.showCv = ($event.target as HTMLInputElement).checked" />
                                CV<span v-if="!a.hasCv" class="text-[11px]"> (none yet)</span>
                            </label>
                            <label class="artist-opt" :class="{ 'artist-opt-off': !a.press.length }" :title="a.press.length ? '' : 'No press yet'">
                                <input type="checkbox" class="h-3.5 w-3.5" :checked="Boolean(a.press.length) && a.showPress" :disabled="!a.press.length" @change="a.showPress = ($event.target as HTMLInputElement).checked" />
                                Press<span class="text-[11px] tabular-nums"> ({{ a.press.length ? `${shownPress(a)} of ${a.press.length}` : 'none yet' }})</span>
                            </label>
                        </fieldset>
                        <span v-if="artists.length > 1" class="flex">
                            <button type="button" :class="btnGhost" :disabled="i === 0" :aria-label="`Move ${a.name} up`" @click="moveArtist(i, -1)">↑</button>
                            <button type="button" :class="btnGhost" :disabled="i === artists.length - 1" :aria-label="`Move ${a.name} down`" @click="moveArtist(i, 1)">↓</button>
                        </span>
                    </div>
                    <details v-if="a.showPress && a.press.length" class="mt-2 text-sm">
                        <summary class="cursor-pointer text-xs text-sky-800 hover:underline">Choose which press to show</summary>
                        <ul class="mt-1.5 space-y-1 pl-1">
                            <li v-for="p in a.press" :key="p.id">
                                <label class="flex items-start gap-2">
                                    <input type="checkbox" class="mt-1 h-3.5 w-3.5 shrink-0" :checked="!a.hiddenPressIds.includes(p.id)" @change="togglePress(a, p.id, ($event.target as HTMLInputElement).checked)" />
                                    <span class="min-w-0"><span class="italic">{{ p.outlet }}</span> — {{ p.title }} <span class="text-xs text-slate-500">({{ p.issueLabel ?? p.publishedOn.slice(0, 4) }})</span></span>
                                </label>
                            </li>
                        </ul>
                    </details>
                    <p v-if="!a.hasBio || !a.hasCv" class="mt-1.5 text-xs">
                        <RouterLink :to="{ name: 'bo-person', params: { id: a.artistId, profile: 'artist' } }" class="text-sky-800 hover:underline">Add {{ !a.hasBio && !a.hasCv ? 'a bio and CV' : !a.hasBio ? 'a bio' : 'a CV' }} on their profile</RouterLink>
                    </p>
                </li>
            </ul>
            <p v-if="!artists.length" class="text-sm text-slate-500">Add works to list their artists here.</p>
        </section>

        <div v-if="room" class="border-t border-slate-200 pt-4">
            <button v-if="!room.visitors" type="button" :class="btnDanger" @click="confirmDelete = true">Delete room…</button>
            <p v-else class="text-xs text-slate-500">{{ room.visitors }} {{ room.visitors === 1 ? 'person has' : 'people have' }} visited this room, so it can’t be deleted. Set it to Closed to turn the link off.</p>
        </div>

        <Dialog v-model:open="picking" title="Add works" description="Tick works from the inventory. Close when done." wide>
            <WorkPicker :selected-ids="selectedIds" testid="room-work-results" @toggle="toggleWork" />
            <template #footer>
                <button type="button" :class="btnPrimary" @click="picking = false">Done ({{ works.length }})</button>
            </template>
        </Dialog>
        <Dialog v-model:open="confirmNewLink" title="Make a new link?" description="The current link stops working, and everyone who entered the room will need the new link (and to enter their name and email again).">
            <template #footer>
                <button type="button" :class="btnOutline" @click="confirmNewLink = false">Cancel</button>
                <button type="button" :class="btnPrimary" @click="newLink">New link</button>
            </template>
        </Dialog>
        <Dialog v-model:open="confirmDelete" title="Delete this room?" description="It can be restored from Recently deleted.">
            <template #footer>
                <button type="button" :class="btnOutline" @click="confirmDelete = false">Cancel</button>
                <button type="button" :class="btnDanger" class="!bg-red-700 !text-white" @click="remove">Delete</button>
            </template>
        </Dialog>
        <HistoryDialog v-if="room" v-model:open="historyOpen" entity="viewing_room" :id="room.id" @restored="load" />
    </div>
</template>

<style scoped>
@reference "@/style.css";
.artist-opt {
    @apply inline-flex cursor-pointer items-center gap-1.5 rounded border border-slate-300 bg-white px-2 py-1 text-slate-800 hover:border-sky-700;
}
.artist-opt:has(input:checked) {
    @apply border-sky-700 bg-sky-50 text-sky-900;
}
.artist-opt-off {
    @apply cursor-not-allowed border-dashed text-slate-400 hover:border-slate-300;
}
</style>
