<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import Sortable from 'sortablejs';
import {
    exhibitionPath,
    formatDate,
    formatPrice,
    parsePrice,
    WORK_CHANGE_FIELDS,
    WORK_LOCATIONS,
    WORK_STATUSES,
    type Person,
    type PersonSummary,
    type Work,
    type WorkChange,
    type WorkLocation,
    type WorkPatch,
    type WorkStatus,
} from '@twelveten/shared';
import Field from '@/admin/ui/Field.vue';
import SelectField from '@/admin/ui/SelectField.vue';
import Dialog from '@/admin/ui/Dialog.vue';
import HistoryDialog from '@/admin/HistoryDialog.vue';
import { ApiError } from '@/api/client';
import { errorMessage, isConflict } from '@/admin/api';
import { askConflict, toast } from '@/admin/state';
import { altFromFilename, useUploadQueue } from '@/admin/upload';
import UploadProgress from '@/admin/ui/UploadProgress.vue';
import { btnDanger, btnGhost, btnOutline, btnPrimary } from '@/admin/ui/buttons';
import { boApi } from './api';
import { useUnsavedGuard } from './guard';
import { dateTime, locationLabel, money, statusLabel } from './format';
import PersonPicker from './PersonPicker.vue';
import ShippingLabelDialog from './ShippingLabelDialog.vue';
import StatusBadge from './StatusBadge.vue';
import ArtImage from '@/components/ArtImage.vue';

/** One inventory work: caption, images, price (with history), status, location and sale. */
const route = useRoute();
const router = useRouter();
const id = computed(() => String(route.params.id));
const isNew = computed(() => id.value === 'new');

const work = ref<Work | null>(null);
const notFound = ref(false);
const history = ref<WorkChange[]>([]);
/** Artist of a new work (from ?artist= or chosen with the picker). */
const newArtist = ref<{ id: string; name: string } | null>(null);
/** Images of a new work (uploaded, saved with the work). */
const pendingImages = ref<{ url: string; alt: string }[]>([]);

interface Form {
    title: string | null;
    dateText: string | null;
    medium: string | null;
    dimensions: string | null;
    edition: string | null;
    credit: string | null;
    inventoryNumber: string | null;
    price: string | null;
    currency: string | null;
    status: WorkStatus;
    location: WorkLocation | '';
    locationNote: string | null;
    consignedOn: string | null;
    consignmentEndsOn: string | null;
    soldOn: string | null;
    salePrice: string | null;
    saleNotes: string | null;
    notes: string | null;
}
const TEXT = ['title', 'dateText', 'medium', 'dimensions', 'edition', 'credit', 'inventoryNumber', 'locationNote', 'consignedOn', 'consignmentEndsOn', 'soldOn', 'saleNotes', 'notes'] as const;
const centsText = (c: number | null) => (c === null ? null : (c / 100).toFixed(c % 100 ? 2 : 0));

function formFrom(w: Work | null): Form {
    return {
        title: w?.title || null,
        dateText: w?.dateText ?? null,
        medium: w?.medium ?? null,
        dimensions: w?.dimensions ?? null,
        edition: w?.edition ?? null,
        credit: w?.credit ?? null,
        inventoryNumber: w?.inventoryNumber ?? null,
        price: centsText(w?.priceCents ?? null),
        currency: w?.currency ?? 'USD',
        status: w?.status ?? 'available',
        location: w?.location ?? '',
        locationNote: w?.locationNote ?? null,
        consignedOn: w?.consignedOn ?? null,
        consignmentEndsOn: w?.consignmentEndsOn ?? null,
        soldOn: w?.soldOn ?? null,
        salePrice: centsText(w?.salePriceCents ?? null),
        saleNotes: w?.saleNotes ?? null,
        notes: w?.notes ?? null,
    };
}
const form = reactive<Form>(formFrom(null));
const baseline = ref(JSON.stringify(form));
const buyer = ref<{ id: string; name: string } | null>(null);
const changeNote = ref<string | null>(null);

function reset(w: Work | null) {
    work.value = w;
    Object.assign(form, formFrom(w));
    buyer.value = w?.buyer ?? null;
    baseline.value = JSON.stringify(form);
    changeNote.value = null;
}

const formDirty = computed(() => JSON.stringify(form) !== baseline.value || (buyer.value?.id ?? null) !== (work.value?.buyer?.id ?? null));
// A new work stays an unsaved form until the first Save.
const dirty = computed(() => (isNew.value ? formDirty.value || pendingImages.value.length > 0 : formDirty.value));
useUnsavedGuard(dirty);

async function load() {
    notFound.value = false;
    pendingImages.value = [];
    if (isNew.value) {
        reset(null);
        const artistId = route.query.artist ? String(route.query.artist) : null;
        newArtist.value = null;
        if (artistId) {
            try {
                const p: Person = await boApi.person(artistId);
                if (p.artistProfile) newArtist.value = { id: p.id, name: p.name };
            } catch {
                // fall back to choosing the artist
            }
        }
        history.value = [];
        return;
    }
    try {
        reset(await boApi.work(id.value));
        history.value = await boApi.workHistory(id.value);
    } catch (e) {
        if (e instanceof ApiError && e.status === 404) notFound.value = true;
        else toast(errorMessage(e), 'error');
    }
}
watch(id, () => void load(), { immediate: true });

const priceError = computed(() => (form.price && Number.isNaN(parsePrice(form.price)) ? 'Enter an amount like 4500 or 4,500.00' : ''));
const salePriceError = computed(() => (form.salePrice && Number.isNaN(parsePrice(form.salePrice)) ? 'Enter an amount like 4500 or 4,500.00' : ''));

function payload() {
    const out: Record<string, unknown> = {};
    for (const k of TEXT) out[k] = form[k] || null;
    out.title = form.title ?? '';
    out.priceCents = parsePrice(form.price ?? '');
    out.salePriceCents = parsePrice(form.salePrice ?? '');
    out.currency = (form.currency || 'USD').toUpperCase();
    out.status = form.status;
    out.location = form.location || null;
    out.buyerId = buyer.value?.id ?? null;
    return out;
}

const saving = ref(false);
async function save(overwrite = false): Promise<void> {
    if (priceError.value || salePriceError.value) return void toast(priceError.value || salePriceError.value, 'error');
    if (form.consignedOn && form.consignmentEndsOn && form.consignmentEndsOn < form.consignedOn) return void toast('Consignment must end after it starts', 'error');
    saving.value = true;
    try {
        if (isNew.value) {
            if (!newArtist.value) return void toast('Choose the artist first', 'error');
            const created = await boApi.createWork({ ...(payload() as object), artistId: newArtist.value.id, images: pendingImages.value });
            pendingImages.value = [];
            reset(created);
            toast('Work added', 'success', 1500);
            await router.replace({ name: 'bo-work', params: { id: created.id } });
            return;
        }
        if (!work.value) return;
        const base = overwrite ? await boApi.work(id.value) : work.value;
        const data = payload();
        const patch: Record<string, unknown> = { updatedAt: base.updatedAt, ...data };
        if (changeNote.value) patch.changeNote = changeNote.value;
        const saved = await boApi.patchWork(base.id, patch as WorkPatch);
        reset(saved);
        history.value = await boApi.workHistory(saved.id);
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
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && dirty.value) {
        e.preventDefault();
        void save();
    }
}
onMounted(() => window.addEventListener('keydown', onKey));

// ---- Images ----
const images = computed(() => (isNew.value ? pendingImages.value.map((img, position) => ({ id: `pending-${position}`, position, ...img })) : (work.value?.images ?? [])));
const { uploads, pickAndUpload } = useUploadQueue();
const addImages = () =>
    pickAndUpload('image', async (url, file) => {
        const alt = altFromFilename(file.name);
        if (isNew.value) pendingImages.value.push({ url, alt });
        else work.value = await boApi.addWorkImage(id.value, url, alt);
    });
async function removeImage(imageId: string, index: number) {
    if (isNew.value) return void pendingImages.value.splice(index, 1);
    try {
        work.value = await boApi.deleteWorkImage(id.value, imageId);
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}
const altDialog = reactive({ open: false, imageId: '', index: 0, alt: '' as string | null });
function editAlt(img: { id: string; alt: string }, index: number) {
    Object.assign(altDialog, { open: true, imageId: img.id, index, alt: img.alt });
}
async function saveAlt() {
    try {
        if (isNew.value) pendingImages.value[altDialog.index]!.alt = altDialog.alt ?? '';
        else work.value = await boApi.patchWorkImage(id.value, altDialog.imageId, altDialog.alt ?? '');
        altDialog.open = false;
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}

const grid = ref<HTMLElement | null>(null);
let sortable: Sortable | null = null;
watch(grid, (el) => {
    sortable?.destroy();
    sortable = null;
    if (!el) return;
    sortable = Sortable.create(el, {
        animation: 150,
        handle: '[data-drag]',
        onEnd: async (evt) => {
            if (evt.oldIndex === undefined || evt.newIndex === undefined || evt.oldIndex === evt.newIndex) return;
            const list = isNew.value ? [...pendingImages.value] : [...(work.value?.images ?? [])];
            const [moved] = list.splice(evt.oldIndex, 1);
            list.splice(evt.newIndex, 0, moved as never);
            // Let Vue re-render from data rather than keep Sortable's DOM move.
            if (isNew.value) {
                pendingImages.value = [];
                await nextTick();
                pendingImages.value = list as { url: string; alt: string }[];
                return;
            }
            const w = work.value!;
            work.value = { ...w, images: [] };
            await nextTick();
            work.value = { ...w, images: list as Work['images'] };
            try {
                work.value = await boApi.orderWorkImages(w.id, (list as Work['images']).map((i) => i.id));
            } catch (e) {
                toast(errorMessage(e), 'error');
            }
        },
    });
});
onBeforeUnmount(() => {
    sortable?.destroy();
    window.removeEventListener('keydown', onKey);
});

// ---- Buyer ----
function chooseBuyer(p: PersonSummary) {
    buyer.value = { id: p.id, name: p.name };
}
function chooseArtist(p: PersonSummary) {
    if (!p.profiles.includes('artist')) return void toast(`${p.name} has no artist profile. Add one on their page first.`, 'error');
    newArtist.value = { id: p.id, name: p.name };
}

// ---- History display ----
type Val = Record<string, unknown> | string | null;
function describe(field: WorkChange['field'], v: Val): string {
    if (v === null || v === undefined) return '—';
    const o = v as Record<string, unknown>;
    switch (field) {
        case 'price':
            return formatPrice(o.cents as number, o.currency as string);
        case 'status':
            return statusLabel(v as WorkStatus);
        case 'location':
            return [locationLabel(o.location as WorkLocation | null), o.note].filter(Boolean).join(' — ') || '—';
        case 'consignment':
            return [o.from ? formatDate(o.from as string) : '…', o.to ? formatDate(o.to as string) : '…'].join(' → ');
        case 'sale':
            return [o.soldOn ? formatDate(o.soldOn as string) : null, o.cents !== null && o.cents !== undefined ? formatPrice(o.cents as number, o.currency as string) : null, o.buyerName]
                .filter(Boolean)
                .join(' · ') || '—';
    }
}

// ---- Delete ----
const revisionsOpen = ref(false);
const confirmDelete = ref(false);
async function remove() {
    confirmDelete.value = false;
    const artistId = work.value?.artistId;
    try {
        await boApi.deleteWork(id.value);
        reset(null);
        toast('Work deleted', 'success');
        await router.push(artistId ? { name: 'bo-person', params: { id: artistId, profile: 'artist' } } : { name: 'bo-inventory' });
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}
async function onRestored() {
    await load();
}

const statusOptions = Object.entries(WORK_STATUSES).map(([value, label]) => ({ value: value as WorkStatus, label }));
const locationOptions = [{ value: '' as const, label: '—' }, ...Object.entries(WORK_LOCATIONS).map(([value, label]) => ({ value: value as WorkLocation, label }))];
const artistLink = computed(() => {
    const a = isNew.value ? newArtist.value : work.value && { id: work.value.artistId, name: work.value.artistName };
    return a ? { ...a, to: { name: 'bo-person', params: { id: a.id, profile: 'artist' } } } : null;
});

// ---- Invoices ----
/** On hold for a buyer and saved: ready to invoice. */
const canInvoice = computed(() => Boolean(work.value && !isNew.value && !formDirty.value && work.value.status === 'on_hold' && work.value.buyer));
const invoicing = ref(false);
const labelOpen = ref(false);
async function createInvoice() {
    if (!work.value?.buyer) return;
    invoicing.value = true;
    try {
        const inv = await boApi.createInvoice({ personId: work.value.buyer.id, workIds: [work.value.id] });
        await router.push({ name: 'bo-invoice', params: { id: inv.id } });
    } catch (e) {
        toast(errorMessage(e), 'error');
    } finally {
        invoicing.value = false;
    }
}
</script>

<template>
    <div v-if="notFound" class="py-16 text-center">
        <p class="mb-4 text-slate-600">This work doesn’t exist (it may have been deleted).</p>
        <RouterLink :to="{ name: 'bo-inventory' }" :class="btnOutline">Inventory</RouterLink>
    </div>
    <div v-else-if="!isNew && !work" class="py-16 text-center text-sm text-slate-500">Loading…</div>
    <form v-else class="space-y-6" @submit.prevent="save()">
        <div class="flex flex-wrap items-center gap-2">
            <RouterLink v-if="artistLink" :to="artistLink.to" class="text-sm text-sky-800 hover:underline">← {{ artistLink.name }}</RouterLink>
            <RouterLink v-else :to="{ name: 'bo-inventory' }" class="text-sm text-sky-800 hover:underline">← Inventory</RouterLink>
        </div>

        <div class="flex flex-wrap items-center gap-3">
            <h1 class="text-2xl font-semibold">
                <template v-if="isNew">New work</template>
                <template v-else><span class="italic">{{ work!.title || 'Untitled' }}</span><span v-if="work!.dateText" class="text-slate-500">, {{ work!.dateText }}</span></template>
            </h1>
            <StatusBadge v-if="work" :status="work.status" />
            <span class="flex-1" />
            <span v-if="dirty" class="text-xs text-amber-700">● Unsaved changes</span>
            <button v-if="!isNew" type="button" :class="btnGhost" :disabled="formDirty" :title="formDirty ? 'Save first: the label is made from the saved work' : ''" data-testid="work-shipping-label" @click="labelOpen = true">
                <i class="las la-shipping-fast" aria-hidden="true" /> Shipping label
            </button>
            <button v-if="!isNew" type="button" :class="btnGhost" @click="revisionsOpen = true">Versions</button>
            <button type="submit" :class="btnPrimary" :disabled="(!dirty && !isNew) || saving" title="Save (Ctrl+S)">{{ saving ? 'Saving…' : isNew ? 'Save work' : 'Save' }}</button>
        </div>

        <div class="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <div class="space-y-6">
                <section class="rounded-md border border-slate-200 bg-white p-4" aria-labelledby="caption-h">
                    <h2 id="caption-h" class="mb-1 text-sm font-semibold">Caption</h2>
                    <div v-if="isNew && !newArtist" class="mb-2">
                        <PersonPicker label="Artist" profile="artist" strict placeholder="Search artists…" :allow-create="false" @select="chooseArtist" />
                    </div>
                    <p v-else-if="artistLink" class="py-1.5 text-sm">
                        <span class="block text-xs font-medium text-slate-600">Artist</span>
                        <RouterLink :to="artistLink.to" class="text-sky-900 hover:underline">{{ artistLink.name }}</RouterLink>
                        <button v-if="isNew" type="button" class="ml-2 text-xs text-slate-500 hover:underline" @click="newArtist = null">Change</button>
                    </p>
                    <Field v-model="form.title" label="Title" />
                    <div class="grid gap-x-3 sm:grid-cols-2">
                        <Field v-model="form.dateText" label="Date" hint="e.g. 2024 or 2023–2024" />
                        <Field v-model="form.inventoryNumber" label="Inventory number" :placeholder="isNew ? 'Assigned on save' : ''" :hint="isNew ? 'Artist initials + next number; type one to override' : undefined" />
                    </div>
                    <Field v-model="form.medium" label="Medium / materials" />
                    <div class="grid gap-x-3 sm:grid-cols-2">
                        <Field v-model="form.dimensions" label="Dimensions" />
                        <Field v-model="form.edition" label="Edition" />
                    </div>
                    <Field v-model="form.credit" label="Credit" />
                </section>

                <section class="rounded-md border border-slate-200 bg-white p-4" aria-labelledby="images-h">
                    <div class="mb-2 flex items-center gap-2">
                        <h2 id="images-h" class="text-sm font-semibold">Images</h2>
                        <span class="text-xs text-slate-500">The first image is the cover · drag ⠿ to reorder{{ isNew ? '' : ' · changes save immediately' }}</span>
                        <span class="flex-1" />
                        <button type="button" :class="btnOutline" @click="addImages">+ Add images</button>
                    </div>
                    <UploadProgress :uploads="uploads" class="mb-2" />
                    <ol v-if="images.length" ref="grid" class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <li v-for="(img, i) in images" :key="img.id" class="overflow-hidden rounded border border-slate-200 bg-white">
                            <div class="relative aspect-square bg-slate-100">
                                <ArtImage sizes="240px" :src="img.url" :alt="img.alt" class="h-full w-full object-contain" />
                                <span data-drag class="absolute left-1 top-1 cursor-grab rounded bg-white/90 px-1 text-sm shadow" title="Drag to reorder">⠿</span>
                                <span v-if="i === 0" class="absolute right-1 top-1 rounded bg-black/70 px-1 text-[10px] text-white">cover</span>
                            </div>
                            <div class="flex gap-3 p-1.5 text-[11px]">
                                <button type="button" class="text-sky-800 hover:underline" @click="editAlt(img, i)">Alt text</button>
                                <button type="button" class="text-red-700 hover:underline" @click="removeImage(img.id, i)">Remove</button>
                            </div>
                        </li>
                    </ol>
                    <p v-else class="py-4 text-center text-sm text-slate-500">No images yet.</p>
                </section>

                <section v-if="work?.slides.length" class="rounded-md border border-slate-200 bg-white p-4" aria-labelledby="slides-h">
                    <h2 id="slides-h" class="mb-2 text-sm font-semibold">Shown in</h2>
                    <ul class="space-y-1 text-sm">
                        <li v-for="s in work.slides" :key="s.artworkId" class="flex items-center gap-2">
                            <ArtImage sizes="240px" fit="cover" v-if="s.image" :src="s.image" alt="" class="h-8 w-8 rounded object-cover" />
                            <a :href="exhibitionPath({ kind: s.exhibitionKind, slug: s.exhibitionSlug })" target="_blank" rel="noopener" class="text-sky-900 hover:underline">{{ s.exhibitionTitle }}</a>
                            <span class="text-xs text-slate-500">slideshow</span>
                        </li>
                    </ul>
                </section>

                <section class="rounded-md border border-slate-200 bg-white p-4" aria-labelledby="notes-h">
                    <h2 id="notes-h" class="mb-1 text-sm font-semibold">Private notes</h2>
                    <Field v-model="form.notes" label="Notes (never shown on the site)" multiline />
                </section>
            </div>

            <div class="space-y-6">
                <section class="rounded-md border border-slate-200 bg-white p-4" aria-labelledby="inv-h">
                    <h2 id="inv-h" class="mb-1 text-sm font-semibold">Price &amp; status <span class="font-normal text-slate-500">(private)</span></h2>
                    <div class="grid grid-cols-[1fr_5rem] gap-x-3">
                        <Field v-model="form.price" label="Price" placeholder="e.g. 4,500" :hint="priceError || (form.price && !priceError ? formatPrice(parsePrice(form.price), form.currency || 'USD') : '')" />
                        <Field v-model="form.currency" label="Currency" mono />
                    </div>
                    <SelectField v-model="form.status" label="Status" :options="statusOptions" />
                    <SelectField v-model="form.location" label="Location" :options="locationOptions" />
                    <Field v-model="form.locationNote" label="Location details" placeholder="e.g. Rack B, crate 4" />
                    <div class="grid grid-cols-2 gap-x-3">
                        <Field v-model="form.consignedOn" label="Consigned" type="date" />
                        <Field v-model="form.consignmentEndsOn" label="Consignment ends" type="date" />
                    </div>
                </section>

                <section class="rounded-md border border-slate-200 bg-white p-4" aria-labelledby="sale-h">
                    <h2 id="sale-h" class="mb-1 text-sm font-semibold">Sale <span class="font-normal text-slate-500">(private)</span></h2>
                    <div class="grid grid-cols-2 gap-x-3">
                        <Field v-model="form.soldOn" label="Sold on" type="date" />
                        <Field v-model="form.salePrice" label="Sale price" :hint="salePriceError" />
                    </div>
                    <div v-if="buyer" class="py-1.5 text-sm">
                        <span class="block text-xs font-medium text-slate-600">Buyer</span>
                        <RouterLink :to="{ name: 'bo-person', params: { id: buyer.id } }" class="text-sky-900 hover:underline">{{ buyer.name }}</RouterLink>
                        <button type="button" class="ml-2 text-xs text-slate-500 hover:underline" @click="buyer = null">Change</button>
                    </div>
                    <div v-else class="py-1.5"><PersonPicker label="Buyer" placeholder="Search people or add a new one…" @select="chooseBuyer" /></div>
                    <Field v-model="form.saleNotes" label="Sale notes" multiline />
                </section>

                <section v-if="!isNew" class="rounded-md border border-slate-200 bg-white p-4" aria-labelledby="invoices-h">
                    <div class="mb-1 flex flex-wrap items-center gap-2">
                        <h2 id="invoices-h" class="text-sm font-semibold">Invoices</h2>
                        <span class="flex-1" />
                        <button v-if="canInvoice" type="button" :class="btnPrimary" :disabled="invoicing" @click="createInvoice">Create invoice for {{ work?.buyer?.name }}</button>
                    </div>
                    <ul v-if="work?.invoices.length" class="divide-y divide-slate-100 text-sm">
                        <li v-for="i in work.invoices" :key="i.id" class="flex flex-wrap items-center gap-2 py-1.5">
                            <RouterLink :to="{ name: 'bo-invoice', params: { id: i.id } }" class="font-medium text-sky-900 hover:underline">{{ i.number }}</RouterLink>
                            <span class="text-slate-600">{{ i.personName }}</span>
                            <StatusBadge :status="i.status" />
                            <span class="ml-auto tabular-nums">{{ money(i.totalCents, i.currency) }}</span>
                        </li>
                    </ul>
                    <p v-else class="text-xs text-slate-500">
                        {{ canInvoice ? '' : 'To invoice this work, set its status to On hold, choose the buyer, and save.' }}
                    </p>
                </section>

                <section v-if="!isNew" class="rounded-md border border-slate-200 bg-white p-4" aria-labelledby="hist-h">
                    <h2 id="hist-h" class="mb-1 text-sm font-semibold">Price &amp; status history</h2>
                    <Field v-model="changeNote" label="Reason for this change (optional)" placeholder="e.g. Raised for the fair" />
                    <ol v-if="history.length" class="mt-2 space-y-2 border-l border-slate-200 pl-3 text-sm" data-testid="work-history">
                        <li v-for="h in history" :key="h.id" class="relative">
                            <span class="absolute -left-[17px] top-1.5 h-2 w-2 rounded-full bg-sky-800" aria-hidden="true" />
                            <div>
                                <span class="font-medium">{{ WORK_CHANGE_FIELDS[h.field] }}</span>:
                                <span class="text-slate-500">{{ describe(h.field, h.oldValue as Val) }}</span>
                                →
                                <span class="font-medium">{{ describe(h.field, h.newValue as Val) }}</span>
                            </div>
                            <div class="text-xs text-slate-500">{{ dateTime(h.createdAt) }}<template v-if="h.userName"> · {{ h.userName }}</template></div>
                            <div v-if="h.note" class="text-xs italic text-slate-600">“{{ h.note }}”</div>
                        </li>
                    </ol>
                    <p v-else class="mt-2 text-sm text-slate-500">No changes recorded yet.</p>
                </section>

                <div v-if="!isNew" class="pt-2">
                    <button type="button" :class="btnDanger" @click="confirmDelete = true">Delete work…</button>
                </div>
            </div>
        </div>

        <Dialog v-model:open="altDialog.open" title="Image description">
            <Field v-model="altDialog.alt" label="Description for screen readers (alt text)" multiline />
            <template #footer>
                <button type="button" :class="btnOutline" @click="altDialog.open = false">Cancel</button>
                <button type="button" :class="btnPrimary" @click="saveAlt">Save</button>
            </template>
        </Dialog>
        <HistoryDialog v-if="work" v-model:open="revisionsOpen" entity="work" :id="work.id" @restored="onRestored" />
        <ShippingLabelDialog v-if="work" v-model:open="labelOpen" :source="{ kind: 'works', workIds: [work.id] }" summary="One page for this work" />
        <Dialog v-model:open="confirmDelete" title="Delete this work?" description="Its images and price history are removed. Slides that showed it stay on their exhibitions, unlinked.">
            <template #footer>
                <button type="button" :class="btnOutline" @click="confirmDelete = false">Cancel</button>
                <button type="button" :class="btnDanger" class="!bg-red-700 !text-white" @click="remove">Delete</button>
            </template>
        </Dialog>
    </form>
</template>
