<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { formatDate, MERGE_FIELDS, type MergeField, type Person, type PersonSummary } from '@twelveten/shared';
import Dialog from '@/admin/ui/Dialog.vue';
import { errorMessage } from '@/admin/api';
import { toast } from '@/admin/state';
import { btnOutline, btnPrimary } from '@/admin/ui/buttons';
import { boApi } from './api';
import PersonPicker from './PersonPicker.vue';

/**
 * Merge two people who are the same person. Pick which record to keep and, for each detail that
 * differs, whose value to keep; everything else (addresses, emails, works, invoices, viewing rooms)
 * moves to the kept person and the other record is deleted.
 */
const props = defineProps<{ firstId: string | null; secondId?: string | null }>();
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ merged: [person: Person] }>();
const router = useRouter();

const LABELS: Record<MergeField, string> = {
    name: 'Name',
    sortName: 'Sort name',
    birthDate: 'Date of birth',
    birthPlace: 'Place of birth',
    email: 'Email',
    phone: 'Phone',
    website: 'Website',
    portrait: 'Photo',
};

const people = ref<[Person, Person] | null>(null);
const keepIndex = ref<0 | 1>(0);
const picks = ref<Partial<Record<MergeField, 0 | 1>>>({});
const loading = ref(false);
const busy = ref(false);

const keep = computed(() => people.value?.[keepIndex.value] ?? null);
const drop = computed(() => people.value?.[keepIndex.value === 0 ? 1 : 0] ?? null);
const artistIndex = computed(() => people.value?.findIndex((p) => p.profiles.includes('artist')) ?? -1);
const bothArtists = computed(() => Boolean(people.value?.every((p) => p.profiles.includes('artist'))));
const differing = computed(() => (people.value ? MERGE_FIELDS.filter((f) => (people.value![0][f] || null) !== (people.value![1][f] || null)) : []));

async function loadPair(a: string, b: string) {
    loading.value = true;
    try {
        const [x, y] = await Promise.all([boApi.person(a), boApi.person(b)]);
        people.value = [x, y];
        // Keep the artist if there is one (artists can't be merged away), else the older record.
        keepIndex.value = x.profiles.includes('artist') ? 0 : y.profiles.includes('artist') ? 1 : 0;
        resetPicks();
    } catch (e) {
        toast(errorMessage(e), 'error');
    } finally {
        loading.value = false;
    }
}

/** Default to the kept person's value, or the other's when the kept one is empty. */
function resetPicks() {
    if (!people.value) return;
    const out: Partial<Record<MergeField, 0 | 1>> = {};
    for (const f of differing.value) out[f] = people.value[keepIndex.value][f] ? keepIndex.value : keepIndex.value === 0 ? 1 : 0;
    picks.value = out;
}
watch(keepIndex, resetPicks);

watch(
    [open, () => props.firstId, () => props.secondId],
    ([o]) => {
        if (!o) return;
        people.value = null;
        if (props.firstId && props.secondId) void loadPair(props.firstId, props.secondId);
    },
    { immediate: true },
);

function picked(p: PersonSummary) {
    if (!props.firstId) return;
    if (p.id === props.firstId) return void toast('Pick a different person', 'error');
    void loadPair(props.firstId, p.id);
}

const display = (p: Person, f: MergeField) => {
    const v = p[f];
    if (!v) return '—';
    return f === 'birthDate' ? formatDate(v) : v;
};

const moving = computed(() => {
    const d = drop.value;
    if (!d) return [];
    const c = d.collectorProfile;
    return [
        d.addresses.length && `${d.addresses.length} address${d.addresses.length === 1 ? '' : 'es'}`,
        [d.email, ...d.emails].filter(Boolean).length && `their email${[d.email, ...d.emails].filter(Boolean).length === 1 ? '' : 's'} (kept as other emails)`,
        c && c.collection.reduce((n, g) => n + g.works.length, 0) && `${c.collection.reduce((n, g) => n + g.works.length, 0)} collected work(s)`,
        d.purchases.length && `${d.purchases.length} purchase(s)`,
        c?.invoices.length && `${c.invoices.length} invoice(s)`,
        c?.viewingRooms.length && `${c.viewingRooms.length} viewing room visit(s)`,
        c && 'the collector profile and notes',
        d.notes && 'private notes (added to theirs)',
    ].filter(Boolean) as string[];
});

async function merge() {
    if (!keep.value || !drop.value) return;
    busy.value = true;
    try {
        const fields: Partial<Record<MergeField, 'source' | 'target'>> = {};
        for (const [f, i] of Object.entries(picks.value) as [MergeField, 0 | 1][]) fields[f] = i === keepIndex.value ? 'target' : 'source';
        const merged = await boApi.mergePerson(drop.value.id, {
            intoId: keep.value.id,
            fields,
            updatedAt: drop.value.updatedAt,
            intoUpdatedAt: keep.value.updatedAt,
        });
        open.value = false;
        toast(`Merged into ${merged.name}`, 'success');
        emit('merged', merged);
        await router.push({ name: 'bo-person', params: { id: merged.id } });
    } catch (e) {
        toast(errorMessage(e), 'error');
    } finally {
        busy.value = false;
    }
}
</script>

<template>
    <Dialog v-model:open="open" title="Merge people" description="Combine two records of the same person. This can’t be undone." wide>
        <div v-if="!secondId && !people" class="space-y-2">
            <PersonPicker label="The other record" :allow-create="false" placeholder="Search by name or email…" @select="picked" />
        </div>
        <p v-if="loading" class="py-6 text-center text-sm text-slate-500">Loading…</p>

        <div v-if="people && !loading" class="space-y-4 text-sm">
            <p v-if="bothArtists" class="rounded bg-red-50 px-3 py-2 text-red-800">Both are artists. Artist profiles can’t be merged; remove one artist profile first.</p>

            <fieldset>
                <legend class="mb-1 text-xs font-medium text-slate-600">Keep this record</legend>
                <div class="grid gap-2 sm:grid-cols-2">
                    <label
                        v-for="(p, i) in people"
                        :key="p.id"
                        class="flex cursor-pointer items-start gap-2 rounded border p-2"
                        :class="[keepIndex === i ? 'border-sky-700 bg-sky-50' : 'border-slate-200', artistIndex >= 0 && artistIndex !== i ? 'cursor-not-allowed opacity-60' : '']"
                    >
                        <input v-model="keepIndex" type="radio" :value="i" class="mt-1" :disabled="artistIndex >= 0 && artistIndex !== i" />
                        <span>
                            <span class="block font-medium">{{ p.name }}</span>
                            <span class="block text-xs text-slate-500">{{ p.email || 'No email' }} · {{ p.profiles.join(', ') || 'no profiles' }}</span>
                        </span>
                    </label>
                </div>
                <p v-if="artistIndex >= 0 && !bothArtists" class="mt-1 text-xs text-slate-500">The artist record is kept.</p>
            </fieldset>

            <div v-if="differing.length">
                <h3 class="mb-1 text-xs font-medium text-slate-600">Where they differ, keep…</h3>
                <table class="w-full text-left">
                    <tbody class="divide-y divide-slate-100">
                        <tr v-for="f in differing" :key="f">
                            <th scope="row" class="py-1.5 pr-3 align-top text-xs font-medium text-slate-600">{{ LABELS[f] }}</th>
                            <td v-for="(p, i) in people" :key="p.id" class="py-1.5 pr-3 align-top">
                                <label class="flex cursor-pointer items-start gap-1.5">
                                    <input v-model="picks[f]" type="radio" :name="`merge-${f}`" :value="i" class="mt-1" />
                                    <span class="break-all" :class="{ 'text-slate-400': !p[f] }">{{ display(p, f) }}</span>
                                </label>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p v-else class="text-slate-600">Their details are the same.</p>

            <div v-if="drop" class="rounded bg-slate-50 px-3 py-2">
                <p class="font-medium">{{ drop.name }} will be removed. Moving to {{ keep?.name }}:</p>
                <ul v-if="moving.length" class="mt-1 list-disc pl-5 text-slate-700">
                    <li v-for="m in moving" :key="m">{{ m }}</li>
                </ul>
                <p v-else class="mt-1 text-slate-600">Nothing else to move.</p>
            </div>
        </div>

        <template #footer>
            <button type="button" :class="btnOutline" @click="open = false">Cancel</button>
            <button type="button" :class="btnPrimary" :disabled="!people || busy || bothArtists" data-testid="confirm-merge" @click="merge">
                {{ busy ? 'Merging…' : 'Merge' }}
            </button>
        </template>
    </Dialog>
</template>
