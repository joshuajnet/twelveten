<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger, TabsList, TabsRoot, TabsTrigger } from 'reka-ui';
import { formatPrice, PROFILE_TYPES, type Person, type PersonPatch, type ProfileType } from '@twelveten/shared';
import Field from '@/admin/ui/Field.vue';
import Dialog from '@/admin/ui/Dialog.vue';
import HistoryDialog from '@/admin/HistoryDialog.vue';
import MediaButton from '@/admin/MediaButton.vue';
import { ApiError } from '@/api/client';
import { errorMessage, isConflict } from '@/admin/api';
import { askConflict, toast } from '@/admin/state';
import { btnDanger, btnGhost, btnOutline, btnPrimary } from '@/admin/ui/buttons';
import { boApi } from './api';
import { peopleListQuery } from './nav';
import { useUnsavedGuard } from './guard';
import { born } from './format';
import { PROFILE_PANELS } from './profiles';
import Avatar from './Avatar.vue';
import AddressesEditor from './AddressesEditor.vue';
import StatusBadge from './StatusBadge.vue';

/** One person: their details first, then the management panel of one of their profiles. */
const route = useRoute();
const router = useRouter();
const id = computed(() => String(route.params.id));
const activeProfile = computed(() => (route.params.profile ? (String(route.params.profile) as ProfileType) : null));

const person = ref<Person | null>(null);
const notFound = ref(false);
/** Non-null view of `person` for the template (only rendered once it's loaded). */
const p = computed(() => person.value as Person);

const FIELDS = ['name', 'sortName', 'birthDate', 'birthPlace', 'email', 'phone', 'website', 'portrait', 'notes'] as const;
type FieldKey = (typeof FIELDS)[number];
const form = reactive<Record<FieldKey, string | null>>({ name: '', sortName: null, birthDate: null, birthPlace: null, email: null, phone: null, website: null, portrait: null, notes: null });
const changed = computed(() => (person.value ? FIELDS.filter((k) => (form[k] || null) !== (person.value![k] || null)) : []));
const detailsDirty = computed(() => changed.value.length > 0);
const panelDirty = ref(false);
useUnsavedGuard(detailsDirty, panelDirty);

function reset(p: Person) {
    person.value = p;
    for (const k of FIELDS) form[k] = p[k] ?? null;
}

async function load() {
    notFound.value = false;
    try {
        reset(await boApi.person(id.value));
    } catch (e) {
        if (e instanceof ApiError && e.status === 404) notFound.value = true;
        else toast(errorMessage(e), 'error');
    }
}
watch(id, () => void load(), { immediate: true });

// Open a profile tab when the URL names none (or one the person doesn't have).
watch([person, activeProfile], ([p, active]) => {
    if (!p || p.id !== id.value) return;
    if (active && !p.profiles.includes(active)) void router.replace({ name: 'bo-person', params: { id: p.id } });
    else if (!active && p.profiles[0]) void router.replace({ name: 'bo-person', params: { id: p.id, profile: p.profiles[0] } });
});

const saving = ref(false);
async function save(overwrite = false): Promise<void> {
    if (!person.value || (!detailsDirty.value && !overwrite)) return;
    if (!form.name?.trim()) return void toast('Name is required', 'error');
    saving.value = true;
    try {
        const base = overwrite ? await boApi.person(id.value) : person.value;
        const patch: Record<string, unknown> = { updatedAt: base.updatedAt };
        for (const k of changed.value) patch[k] = form[k] || null;
        const updated = await boApi.patchPerson(base.id, patch as PersonPatch);
        reset(updated);
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
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && detailsDirty.value) {
        e.preventDefault();
        void save();
    }
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

/** The panel saved something: take the server copy without touching unsaved detail edits. */
function onPanelUpdate(p: Person) {
    const edits = Object.fromEntries(changed.value.map((k) => [k, form[k]]));
    reset(p);
    Object.assign(form, edits);
}

// Profiles
const profileLabel = (key: string) => PROFILE_TYPES.find((p) => p.key === key)?.label ?? key;
const missingProfiles = computed(() => PROFILE_TYPES.filter((t) => !person.value?.profiles.includes(t.key)));
async function addProfile(key: ProfileType) {
    try {
        if (key === 'artist') reset(await boApi.putArtistProfile(id.value, {}));
        if (key === 'collector') reset(await boApi.putCollectorProfile(id.value, {}));
        await router.replace({ name: 'bo-person', params: { id: id.value, profile: key } });
        toast(`${profileLabel(key)} profile added`, 'success');
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}
function selectTab(key: string | number) {
    void router.replace({ name: 'bo-person', params: { id: id.value, profile: String(key) } });
}

// History / delete
const historyOpen = ref(false);
const confirmDelete = ref(false);
async function remove() {
    confirmDelete.value = false;
    try {
        await boApi.deletePerson(id.value);
        form.name = person.value?.name ?? '';
        person.value = null;
        toast('Deleted', 'success');
        await router.push({ name: 'bo-people', query: peopleListQuery.value });
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}

const backTo = computed(() => ({ name: 'bo-people', query: peopleListQuery.value }));
</script>

<template>
    <div v-if="notFound" class="py-16 text-center">
        <p class="mb-4 text-slate-600">This person doesn’t exist (it may have been deleted).</p>
        <RouterLink :to="backTo" :class="btnOutline">Back to people</RouterLink>
    </div>
    <div v-else-if="!person" class="py-16 text-center text-sm text-slate-500">Loading…</div>
    <div v-else class="space-y-6">
        <RouterLink :to="backTo" class="text-sm text-sky-800 hover:underline">← Back to people</RouterLink>

        <!-- 1. Details -->
        <section aria-labelledby="person-name" class="rounded-md border border-slate-200 bg-white">
            <div class="flex flex-wrap items-center gap-4 border-b border-slate-200 p-4">
                <div class="flex flex-col items-center gap-1">
                    <Avatar :name="p.name" :src="form.portrait" size="lg" />
                    <MediaButton kind="image" :label="form.portrait ? 'Replace' : 'Add photo'" class="!text-xs !shadow-none" @uploaded="(url) => (form.portrait = url)" />
                    <button v-if="form.portrait" type="button" class="text-[11px] text-red-700 hover:underline" @click="form.portrait = null">Remove</button>
                </div>
                <div class="min-w-0 flex-1">
                    <h1 id="person-name" class="text-2xl font-semibold">{{ p.name }}</h1>
                    <p v-if="p.birthDate || p.birthPlace" class="text-sm text-slate-600">b. {{ born(p.birthDate, p.birthPlace) }}</p>
                    <div class="mt-1 flex flex-wrap gap-1">
                        <span v-for="k in p.profiles" :key="k" class="rounded bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-900 ring-1 ring-inset ring-sky-700/20">{{ profileLabel(k) }}</span>
                    </div>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <span v-if="detailsDirty" class="text-xs text-amber-700">● Unsaved changes</span>
                    <button type="button" :class="btnGhost" @click="historyOpen = true">History</button>
                    <button type="button" :class="btnPrimary" :disabled="!detailsDirty || saving" title="Save (Ctrl+S)" @click="save()">{{ saving ? 'Saving…' : 'Save details' }}</button>
                </div>
            </div>

            <form class="grid gap-x-6 p-4 md:grid-cols-2" @submit.prevent="save()">
                <div>
                    <h2 class="mb-1 text-sm font-semibold">Details</h2>
                    <Field v-model="form.name" label="Name" />
                    <Field v-model="form.sortName" label="Sort name" hint="How the name is alphabetised, e.g. “Africh, Noelle”" />
                    <div class="grid grid-cols-2 gap-x-3">
                        <Field v-model="form.birthDate" label="Date of birth" type="date" />
                        <Field v-model="form.birthPlace" label="Place of birth" />
                    </div>
                    <Field v-model="form.website" label="Website" type="url" placeholder="https://" />
                    <Field v-model="form.notes" label="Private notes" multiline />
                </div>
                <div>
                    <h2 class="mb-1 text-sm font-semibold">Contact</h2>
                    <Field v-model="form.email" label="Email" type="email" />
                    <Field v-model="form.phone" label="Phone" type="tel" />
                    <p v-if="p.email || p.phone" class="mb-2 flex gap-4 text-xs">
                        <a v-if="p.email" :href="`mailto:${p.email}`" class="text-sky-800 hover:underline">Email {{ p.name.split(' ')[0] }}</a>
                        <a v-if="p.phone" :href="`tel:${p.phone.replace(/[^+\d]/g, '')}`" class="text-sky-800 hover:underline">Call</a>
                    </p>
                    <h3 class="mb-2 mt-3 text-xs font-medium text-slate-600">Addresses</h3>
                    <AddressesEditor :key="p.id" entity="person" :entity-id="p.id" :initial="p.addresses" />
                </div>
                <button type="submit" class="hidden" />
            </form>

            <div v-if="p.purchases.length && !p.collectorProfile" class="border-t border-slate-200 p-4">
                <h2 class="mb-2 text-sm font-semibold">Purchases</h2>
                <ul class="divide-y divide-slate-100 text-sm">
                    <li v-for="w in p.purchases" :key="w.id" class="flex flex-wrap items-center gap-2 py-1.5">
                        <RouterLink :to="{ name: 'bo-work', params: { id: w.id } }" class="font-medium italic text-sky-900 hover:underline">{{ w.title || 'Untitled' }}</RouterLink>
                        <span class="text-slate-600">{{ w.artistName }}</span>
                        <StatusBadge :status="w.status" />
                        <span class="ml-auto tabular-nums">{{ formatPrice(w.priceCents, w.currency) }}</span>
                    </li>
                </ul>
            </div>
        </section>

        <!-- 2. Profile management -->
        <section aria-label="Profiles">
            <TabsRoot :model-value="activeProfile ?? undefined" @update:model-value="selectTab">
                <div class="mb-4 flex flex-wrap items-center gap-2 border-b border-slate-200">
                    <TabsList class="flex gap-1" aria-label="Profiles">
                        <TabsTrigger
                            v-for="k in p.profiles"
                            :key="k"
                            :value="k"
                            class="-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 data-[state=active]:border-sky-800 data-[state=active]:text-sky-900"
                        >
                            {{ profileLabel(k) }}
                        </TabsTrigger>
                    </TabsList>
                    <DropdownMenuRoot v-if="missingProfiles.length">
                        <DropdownMenuTrigger :class="btnGhost" class="mb-1 ml-auto">+ Add profile</DropdownMenuTrigger>
                        <DropdownMenuPortal>
                            <DropdownMenuContent class="admin-ui z-[85] min-w-40 rounded-md border border-slate-200 bg-white p-1 shadow-lg" align="end" :side-offset="4">
                                <DropdownMenuItem
                                    v-for="t in missingProfiles"
                                    :key="t.key"
                                    class="cursor-pointer rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-slate-100"
                                    @select="addProfile(t.key)"
                                >
                                    {{ t.label }}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenuPortal>
                    </DropdownMenuRoot>
                </div>
            </TabsRoot>

            <component
                :is="PROFILE_PANELS[activeProfile]"
                v-if="activeProfile && p.profiles.includes(activeProfile)"
                :key="`${p.id}:${activeProfile}`"
                v-model:dirty="panelDirty"
                :person="p"
                @update="onPanelUpdate"
            />
            <div v-else-if="!p.profiles.length" class="rounded-md border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
                <p>{{ p.name }} has no profiles yet.</p>
                <p class="mt-1">Add an Artist profile to manage their bio, CV, exhibitions and works, or a Collector profile for their collection and invoices.</p>
                <div class="mt-3 flex justify-center gap-2">
                    <button v-for="t in missingProfiles" :key="t.key" type="button" :class="btnOutline" @click="addProfile(t.key)">+ {{ t.label }} profile</button>
                </div>
            </div>
        </section>

        <div v-if="!p.profiles.length" class="border-t border-slate-200 pt-4">
            <button type="button" :class="btnDanger" @click="confirmDelete = true">Delete person…</button>
        </div>

        <HistoryDialog v-model:open="historyOpen" entity="person" :id="p.id" @restored="load" />
        <Dialog v-model:open="confirmDelete" title="Delete this person?" description="Their contact details and addresses are removed. It can be restored from History.">
            <template #footer>
                <button type="button" :class="btnOutline" @click="confirmDelete = false">Cancel</button>
                <button type="button" :class="btnDanger" class="!bg-red-700 !text-white" @click="remove">Delete</button>
            </template>
        </Dialog>
    </div>
</template>
