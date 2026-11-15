<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { exhibitionPath, formatDate, formatDateRange, formatPrice, WORK_STATUSES, type ArtistPress, type ExhibitionSummary, type Person, type RichDoc, type WorkStatus } from '@twelveten/shared';
import Field from '@/admin/ui/Field.vue';
import { adminApi } from '@/admin/api';
import { pickFiles, uploadFile } from '@/admin/upload';
import RichEditor from '@/admin/RichEditor.vue';
import HistoryDialog from '@/admin/HistoryDialog.vue';
import Dialog from '@/admin/ui/Dialog.vue';
import { errorMessage, isConflict } from '@/admin/api';
import { askConflict, clone, toast } from '@/admin/state';
import { btnDanger, btnGhost, btnOutline, btnPrimary } from '@/admin/ui/buttons';
import { api } from '@/api/client';
import { boApi } from '../api';
import StatusBadge from '../StatusBadge.vue';

/** Artist profile: bio, CV (with PDF), exhibitions with us, and the works gallery. */
const props = defineProps<{ person: Person }>();
const emit = defineEmits<{ update: [person: Person] }>();
const dirty = defineModel<boolean>('dirty', { default: false });
const router = useRouter();

const profile = computed(() => props.person.artistProfile!);
const bio = ref<RichDoc>(clone(profile.value.bio));
const cv = ref<RichDoc>(clone(profile.value.cv));
const prefix = ref(profile.value.inventoryPrefix);

// Editors normalise their document on load; compare against what they produced, not the raw copy.
const baseline = ref({ bio: JSON.stringify(bio.value), cv: JSON.stringify(cv.value) });
const settle = () => setTimeout(() => (baseline.value = { bio: JSON.stringify(bio.value), cv: JSON.stringify(cv.value) }), 0);
onMounted(settle);
const bioChanged = computed(() => JSON.stringify(bio.value) !== baseline.value.bio);
const cvChanged = computed(() => JSON.stringify(cv.value) !== baseline.value.cv);
const prefixChanged = computed(() => prefix.value.trim().toUpperCase() !== profile.value.inventoryPrefix);
watch([bioChanged, cvChanged, prefixChanged], ([a, b, c]) => (dirty.value = a || b || c), { immediate: true });

function reset(p: Person) {
    bio.value = clone(p.artistProfile!.bio);
    cv.value = clone(p.artistProfile!.cv);
    prefix.value = p.artistProfile!.inventoryPrefix;
    settle();
}

const saving = ref(false);
async function save(overwrite = false): Promise<void> {
    if (!dirty.value && !overwrite) return;
    saving.value = true;
    try {
        const base = overwrite ? (await boApi.person(props.person.id)).artistProfile! : profile.value;
        const updated = await boApi.putArtistProfile(props.person.id, {
            updatedAt: base.updatedAt,
            ...(bioChanged.value ? { bio: bio.value } : {}),
            ...(cvChanged.value ? { cv: cv.value } : {}),
            ...(prefixChanged.value ? { inventoryPrefix: prefix.value } : {}),
        });
        emit('update', updated);
        reset(updated);
        toast('Artist profile saved', 'success', 1500);
    } catch (e) {
        if (isConflict(e)) {
            const choice = await askConflict();
            if (choice === 'overwrite') return save(true);
            const fresh = await boApi.person(props.person.id);
            emit('update', fresh);
            reset(fresh);
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
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

// ---- Exhibitions ----
const allExhibitions = ref<ExhibitionSummary[]>([]);
const linkedIds = computed(() => new Set(profile.value.exhibitions.map((e) => e.id)));
const available = computed(() => allExhibitions.value.filter((e) => !linkedIds.value.has(e.id)));
const toAdd = ref('');
onMounted(async () => {
    allExhibitions.value = await api.exhibitions().catch(() => []);
});
async function setExhibitions(ids: string[]) {
    try {
        emit('update', await boApi.putArtistExhibitions(props.person.id, ids));
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}
async function addExhibition() {
    if (!toAdd.value) return;
    await setExhibitions([...profile.value.exhibitions.map((e) => e.id), toAdd.value]);
    toAdd.value = '';
}

// ---- Press ----
/** Add (no `editing`) or edit a press item linked straight to this artist. */
const pressDialog = ref(false);
const editing = ref<ArtistPress | null>(null);
const pressForm = ref({ outlet: '', title: '', url: '', publishedOn: '', issueLabel: '', byline: '' });
const pressSaving = ref(false);
const uploading = ref(0);
function openPress(p: ArtistPress | null) {
    editing.value = p;
    pressForm.value = p
        ? { outlet: p.outlet, title: p.title, url: p.url, publishedOn: p.publishedOn, issueLabel: p.issueLabel ?? '', byline: p.byline ?? '' }
        : { outlet: '', title: '', url: '', publishedOn: new Date().toISOString().slice(0, 10), issueLabel: '', byline: '' };
    pressDialog.value = true;
}
async function uploadScan() {
    const [file] = await pickFiles('document');
    if (!file) return;
    uploading.value = 0.01;
    try {
        pressForm.value.url = await uploadFile(file, (f) => (uploading.value = Math.max(0.01, f)));
    } catch (e) {
        toast(errorMessage(e), 'error');
    } finally {
        uploading.value = 0;
    }
}
async function savePress() {
    const f = pressForm.value;
    const fields = { outlet: f.outlet, title: f.title, url: f.url, publishedOn: f.publishedOn, issueLabel: f.issueLabel.trim() || null, byline: f.byline.trim() || null };
    pressSaving.value = true;
    try {
        if (editing.value) {
            await adminApi.patchPress(editing.value.id, { ...fields, updatedAt: editing.value.updatedAt });
            emit('update', await boApi.person(props.person.id));
        } else {
            emit('update', await boApi.addArtistPress(props.person.id, { press: fields }));
        }
        pressDialog.value = false;
        toast(editing.value ? 'Press saved' : 'Press added', 'success', 1500);
    } catch (e) {
        if (isConflict(e)) {
            emit('update', await boApi.person(props.person.id));
            pressDialog.value = false;
            toast('Someone else changed this press item; reloaded it', 'info');
        } else toast(errorMessage(e), 'error');
    } finally {
        pressSaving.value = false;
    }
}
async function removePress(p: ArtistPress) {
    const gone = !p.exhibitionId && !p.published;
    if (!window.confirm(gone ? `Remove “${p.title}”? It isn’t used anywhere else, so it will be deleted (restorable from History).` : `Unlink “${p.title}” from this artist?`)) return;
    try {
        emit('update', await boApi.removeArtistPress(props.person.id, p.id));
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}
const isUpload = (url: string) => url.startsWith('/media/');

// ---- Works ----
const statusFilter = ref<WorkStatus | ''>('');
const works = computed(() => profile.value.works.filter((w) => !statusFilter.value || w.status === statusFilter.value));

// ---- Profile ----
const historyOpen = ref(false);
const confirmRemove = ref(false);
async function removeProfile() {
    confirmRemove.value = false;
    try {
        const updated = await boApi.deleteArtistProfile(props.person.id);
        dirty.value = false;
        emit('update', updated);
        await router.replace({ name: 'bo-person', params: { id: props.person.id } });
        toast('Artist profile removed', 'success');
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}
async function onRestored() {
    const fresh = await boApi.person(props.person.id);
    emit('update', fresh);
    reset(fresh);
}

function downloadCv(e: MouseEvent) {
    if (dirty.value && !window.confirm('The PDF uses the saved CV. Download it without your unsaved changes?')) e.preventDefault();
}
</script>

<template>
    <div class="space-y-6" data-testid="artist-panel">
        <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm text-slate-500">Profile address: <code class="text-xs">{{ profile.slug }}</code></span>
            <label class="flex items-center gap-1.5 text-sm text-slate-500">
                Inventory prefix
                <input
                    v-model="prefix"
                    aria-label="Inventory prefix"
                    maxlength="8"
                    class="w-20 rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-xs uppercase focus:border-sky-700 focus:outline-none"
                />
                <span class="text-xs">next <code>{{ profile.nextInventoryNumber }}</code></span>
            </label>
            <span v-if="dirty" class="text-xs text-amber-700">● Unsaved changes</span>
            <span class="flex-1" />
            <button type="button" :class="btnGhost" @click="historyOpen = true">History</button>
            <button type="button" :class="btnPrimary" :disabled="!dirty || saving" title="Save (Ctrl+S)" @click="save()">{{ saving ? 'Saving…' : 'Save profile' }}</button>
        </div>

        <section aria-labelledby="bio-h" class="rounded-md border border-slate-200 bg-white p-4">
            <h3 id="bio-h" class="mb-2 text-sm font-semibold">Bio</h3>
            <div class="bo-rich"><RichEditor v-model="bio" news placeholder="Write the artist’s bio…" /></div>
        </section>

        <section aria-labelledby="cv-h" class="rounded-md border border-slate-200 bg-white p-4">
            <div class="mb-2 flex items-center gap-2">
                <h3 id="cv-h" class="text-sm font-semibold">CV</h3>
                <span class="text-xs text-slate-500">Use “Large italic” for section headings (e.g. Solo exhibitions) and lists for entries.</span>
                <span class="flex-1" />
                <a :href="boApi.cvPdfUrl(person.id)" :class="btnOutline" download @click="downloadCv">Download PDF</a>
            </div>
            <div class="bo-rich"><RichEditor v-model="cv" news placeholder="Education, exhibitions, collections…" /></div>
        </section>

        <section aria-labelledby="ex-h" class="rounded-md border border-slate-200 bg-white p-4">
            <h3 id="ex-h" class="mb-2 text-sm font-semibold">Exhibitions with Twelve Ten ({{ profile.exhibitions.length }})</h3>
            <ul v-if="profile.exhibitions.length" class="divide-y divide-slate-100 text-sm">
                <li v-for="e in profile.exhibitions" :key="e.id" class="flex items-center gap-3 py-2">
                    <a :href="exhibitionPath(e)" target="_blank" rel="noopener" class="font-medium text-sky-900 hover:underline">{{ e.title }}</a>
                    <span class="text-slate-500">{{ e.kind === 'fair' ? 'Fair' : 'Exhibition' }} · {{ formatDateRange(e.startsOn, e.endsOn) }}</span>
                    <span v-if="!e.published" class="rounded bg-amber-100 px-1.5 text-xs text-amber-900">Draft</span>
                    <span class="flex-1" />
                    <button type="button" class="text-xs text-red-700 hover:underline" :aria-label="`Remove ${e.title}`" @click="setExhibitions(profile.exhibitions.filter((x) => x.id !== e.id).map((x) => x.id))">
                        Remove
                    </button>
                </li>
            </ul>
            <p v-else class="text-sm text-slate-500">Not linked to any exhibitions yet.</p>
            <form class="mt-3 flex flex-wrap items-center gap-2" @submit.prevent="addExhibition">
                <label class="sr-only" for="add-exhibition">Add an exhibition</label>
                <select id="add-exhibition" v-model="toAdd" class="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm sm:max-w-md">
                    <option value="">Add an exhibition or fair…</option>
                    <optgroup label="Exhibitions">
                        <option v-for="e in available.filter((x) => x.kind === 'exhibition')" :key="e.id" :value="e.id">{{ e.title }} ({{ e.startsOn.slice(0, 4) }})</option>
                    </optgroup>
                    <optgroup label="Fairs">
                        <option v-for="e in available.filter((x) => x.kind === 'fair')" :key="e.id" :value="e.id">{{ e.title }} ({{ e.startsOn.slice(0, 4) }})</option>
                    </optgroup>
                </select>
                <button type="submit" :class="btnOutline" :disabled="!toAdd">Add</button>
            </form>
        </section>

        <section aria-labelledby="press-h" class="rounded-md border border-slate-200 bg-white p-4">
            <div class="mb-2 flex flex-wrap items-center gap-2">
                <h3 id="press-h" class="text-sm font-semibold">Press ({{ profile.press.length }})</h3>
                <span class="flex-1" />
                <button type="button" :class="btnOutline" @click="openPress(null)">+ Add press</button>
            </div>
            <ul v-if="profile.press.length" class="divide-y divide-slate-100 text-sm">
                <li v-for="p in profile.press" :key="p.id" class="flex items-start gap-3 py-2">
                    <div class="min-w-0 flex-1">
                        <p>
                            <span class="font-medium">{{ p.outlet }}</span>
                            <span class="text-slate-500"> · {{ p.issueLabel ?? formatDate(p.publishedOn) }}</span>
                            <span v-if="!p.published" class="ml-2 rounded bg-slate-100 px-1.5 text-xs text-slate-700">Not on site</span>
                        </p>
                        <a :href="p.url" target="_blank" rel="noopener" class="text-sky-900 hover:underline">{{ p.title }}</a>
                        <span v-if="isUpload(p.url)" class="ml-1 text-xs text-slate-500">(uploaded file)</span>
                        <p class="text-xs text-slate-500">
                            <template v-if="p.byline">{{ p.byline }} · </template>
                            <template v-if="p.exhibitionTitle">On <em>{{ p.exhibitionTitle }}</em></template>
                            <template v-else>External press</template>
                        </p>
                    </div>
                    <template v-if="p.direct">
                        <button type="button" class="text-xs text-sky-900 hover:underline" :aria-label="`Edit ${p.title}`" @click="openPress(p)">Edit</button>
                        <button type="button" class="text-xs text-red-700 hover:underline" :aria-label="`Remove ${p.title}`" @click="removePress(p)">Remove</button>
                    </template>
                </li>
            </ul>
            <p v-else class="text-sm text-slate-500">No press yet.</p>
            <p class="mt-2 text-xs text-slate-500">
                Press about an exhibition above appears automatically (edit it on the site’s
                <a href="/news" target="_blank" rel="noopener" class="text-sky-900 hover:underline">News page</a>). Use “Add press” for coverage elsewhere: a link or an uploaded PDF or scan. Added press stays private unless it is published from the News page.
            </p>
        </section>

        <section aria-labelledby="works-h">
            <div class="mb-3 flex flex-wrap items-center gap-2">
                <h3 id="works-h" class="text-sm font-semibold">Works ({{ profile.works.length }})</h3>
                <select v-model="statusFilter" aria-label="Filter works by status" class="rounded border border-slate-300 bg-white px-2 py-1 text-sm">
                    <option value="">All statuses</option>
                    <option v-for="(label, key) in WORK_STATUSES" :key="key" :value="key">{{ label }}</option>
                </select>
                <span class="flex-1" />
                <RouterLink :to="{ name: 'bo-work', params: { id: 'new' }, query: { artist: person.id } }" :class="btnPrimary">+ Add work</RouterLink>
            </div>
            <ul v-if="works.length" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                <li v-for="w in works" :key="w.id">
                    <RouterLink :to="{ name: 'bo-work', params: { id: w.id } }" class="group block overflow-hidden rounded-md border border-slate-200 bg-white hover:border-sky-700 focus-visible:outline-2 focus-visible:outline-sky-700">
                        <figure>
                            <div class="flex aspect-square items-center justify-center bg-slate-100">
                                <img v-if="w.image" :src="w.image.url" :alt="w.image.alt" class="h-full w-full object-contain" loading="lazy" />
                                <span v-else class="text-xs text-slate-400">No image</span>
                            </div>
                            <figcaption class="space-y-0.5 p-2 text-xs leading-snug">
                                <div class="flex items-start justify-between gap-1">
                                    <span class="font-medium italic text-slate-900">{{ w.title || 'Untitled' }}<span v-if="w.dateText" class="not-italic">, {{ w.dateText }}</span></span>
                                    <StatusBadge :status="w.status" />
                                </div>
                                <div v-if="w.medium" class="text-slate-600">{{ w.medium }}</div>
                                <div v-if="w.dimensions" class="text-slate-600">{{ w.dimensions }}</div>
                                <div class="flex justify-between pt-0.5 text-slate-500">
                                    <span>{{ w.inventoryNumber }}</span>
                                    <span class="font-medium text-slate-800">{{ formatPrice(w.priceCents, w.currency) }}</span>
                                </div>
                            </figcaption>
                        </figure>
                    </RouterLink>
                </li>
            </ul>
            <p v-else class="rounded-md border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">
                {{ profile.works.length ? 'No works with this status.' : 'No works yet.' }}
            </p>
        </section>

        <div class="border-t border-slate-200 pt-4">
            <button type="button" :class="btnDanger" @click="confirmRemove = true">Remove artist profile…</button>
        </div>

        <HistoryDialog v-model:open="historyOpen" entity="artist_profile" :id="person.id" @restored="onRestored" />
        <Dialog v-model:open="pressDialog" :title="editing ? 'Edit press' : 'Add press'" description="Coverage of this artist, as a link to the article or an uploaded PDF or scan.">
            <form id="press-form" class="space-y-1" @submit.prevent="savePress">
                <Field v-model="pressForm.outlet" label="Outlet" placeholder="Artforum" />
                <Field v-model="pressForm.title" label="Headline" />
                <div class="flex items-end gap-2">
                    <div class="min-w-0 flex-1"><Field v-model="pressForm.url" label="Link" placeholder="https://…" /></div>
                    <button type="button" :class="btnOutline" class="mb-1" :disabled="uploading > 0" @click="uploadScan">
                        {{ uploading ? `Uploading ${Math.round(uploading * 100)}%` : 'Upload PDF or image' }}
                    </button>
                </div>
                <div class="grid gap-x-3 sm:grid-cols-2">
                    <label class="block py-1.5">
                        <span class="block text-xs font-medium text-slate-600">Date</span>
                        <input v-model="pressForm.publishedOn" type="date" aria-label="Date" class="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm" />
                    </label>
                    <Field v-model="pressForm.issueLabel" label="Issue label" hint="Shown instead of the date, for journals" placeholder="Spring 2025" />
                </div>
                <Field v-model="pressForm.byline" label="Byline" placeholder="by …" />
            </form>
            <template #footer>
                <button type="button" :class="btnOutline" @click="pressDialog = false">Cancel</button>
                <button type="submit" form="press-form" :class="btnPrimary" :disabled="pressSaving || uploading > 0 || !pressForm.outlet.trim() || !pressForm.title.trim() || !pressForm.url.trim() || !pressForm.publishedOn">
                    {{ pressSaving ? 'Saving…' : editing ? 'Save' : 'Add press' }}
                </button>
            </template>
        </Dialog>
        <Dialog v-model:open="confirmRemove" title="Remove the artist profile?" description="The person stays; their bio, CV and exhibition links are removed. It can be restored from History. Works must be moved or deleted first.">
            <template #footer>
                <button type="button" :class="btnOutline" @click="confirmRemove = false">Cancel</button>
                <button type="button" :class="btnDanger" class="!bg-red-700 !text-white" @click="removeProfile">Remove profile</button>
            </template>
        </Dialog>
    </div>
</template>

<style scoped>
/* The rich editor's toolbar sticks under the site's editing bar by default; here there is none. */
.bo-rich :deep(.tt-rich > [role='toolbar']) {
    top: 0;
}
.bo-rich :deep(.ProseMirror) {
    min-height: 6rem;
    outline: none;
}
</style>
