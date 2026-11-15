<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { formatDate, formatPrice, isUnpaid, parsePercent, type Person } from '@twelveten/shared';
import Field from '@/admin/ui/Field.vue';
import Dialog from '@/admin/ui/Dialog.vue';
import { errorMessage, isConflict } from '@/admin/api';
import { askConflict, toast } from '@/admin/state';
import { btnDanger, btnOutline, btnPrimary } from '@/admin/ui/buttons';
import { boApi } from '../api';
import { money } from '../format';
import StatusBadge from '../StatusBadge.vue';
import EngagementDots from '../rooms/EngagementDots.vue';
import { duration, when } from '../rooms/time';

/** Collector profile: their collection grouped by artist, their invoices, and private notes. */
const props = defineProps<{ person: Person }>();
const emit = defineEmits<{ update: [person: Person] }>();
const dirty = defineModel<boolean>('dirty', { default: false });
const router = useRouter();

const profile = computed(() => props.person.collectorProfile!);
const notes = ref<string | null>(profile.value.notes);
watch(
    () => profile.value.notes,
    (n) => (notes.value = n),
);
watch(notes, (n) => (dirty.value = (n || null) !== (profile.value.notes || null)), { immediate: true });

const saving = ref(false);
async function save(overwrite = false): Promise<void> {
    saving.value = true;
    try {
        const base = overwrite ? (await boApi.person(props.person.id)).collectorProfile! : profile.value;
        emit('update', await boApi.putCollectorProfile(props.person.id, { updatedAt: base.updatedAt, notes: notes.value || null }));
        toast('Collector notes saved', 'success', 1500);
    } catch (e) {
        if (isConflict(e)) {
            const choice = await askConflict();
            if (choice === 'overwrite') return save(true);
            emit('update', await boApi.person(props.person.id));
            toast('Reloaded the latest version', 'info');
        } else toast(errorMessage(e), 'error');
    } finally {
        saving.value = false;
    }
}

const workCount = computed(() => profile.value.collection.reduce((n, g) => n + g.works.length, 0));
const artistLink = (artistId: string) => ({ name: 'bo-person', params: { id: artistId, profile: 'artist' } });

// ---- New invoice ----
const onHold = computed(() => profile.value.collection.flatMap((g) => g.works.filter((w) => w.status === 'on_hold')));
/** Works already on one of this collector's unpaid invoices. */
const invoiced = ref(new Set<string>());
const creating = ref({ open: false, workIds: [] as string[], discount: '' as string | null, busy: false });
async function openNewInvoice() {
    const unpaid = profile.value.invoices.filter((i) => isUnpaid(i.status));
    const items = await Promise.all(unpaid.map((i) => boApi.invoice(i.id).catch(() => null)));
    invoiced.value = new Set(items.flatMap((inv) => inv?.items.map((it) => it.workId ?? '') ?? []));
    creating.value = { open: true, workIds: onHold.value.filter((w) => !invoiced.value.has(w.id)).map((w) => w.id), discount: '', busy: false };
}
async function createInvoice() {
    const discountBps = parsePercent(creating.value.discount ?? '');
    if (Number.isNaN(discountBps)) return void toast('Discount must be a percentage, e.g. 10', 'error');
    creating.value.busy = true;
    try {
        const inv = await boApi.createInvoice({ personId: props.person.id, workIds: creating.value.workIds, discountBps });
        creating.value.open = false;
        await router.push({ name: 'bo-invoice', params: { id: inv.id } });
    } catch (e) {
        toast(errorMessage(e), 'error');
    } finally {
        creating.value.busy = false;
    }
}

// ---- Remove profile ----
const confirmRemove = ref(false);
async function removeProfile() {
    confirmRemove.value = false;
    try {
        const p = await boApi.deleteCollectorProfile(props.person.id);
        emit('update', p);
        await router.replace({ name: 'bo-person', params: { id: p.id } });
        toast('Collector profile removed', 'success');
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}
</script>

<template>
    <div class="space-y-6">
        <!-- Artists collected -->
        <section aria-labelledby="artists-h" class="rounded-md border border-slate-200 bg-white p-4">
            <h3 id="artists-h" class="mb-2 text-sm font-semibold">Artists collected ({{ profile.collection.length }})</h3>
            <ul v-if="profile.collection.length" class="flex flex-wrap gap-2" data-testid="collected-artists">
                <li v-for="g in profile.collection" :key="g.artistId">
                    <RouterLink
                        :to="artistLink(g.artistId)"
                        class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-sky-900 hover:border-sky-700 hover:bg-sky-50"
                    >
                        {{ g.name }} <span class="text-xs text-slate-500">{{ g.works.length }}</span>
                    </RouterLink>
                </li>
            </ul>
            <p v-else class="text-sm text-slate-500">No works yet. A work counts once it is on hold for, or sold to, {{ person.name }}.</p>
        </section>

        <!-- Collection by artist -->
        <section aria-labelledby="collection-h">
            <h3 id="collection-h" class="mb-3 text-sm font-semibold">Collection ({{ workCount }})</h3>
            <div v-for="g in profile.collection" :key="g.artistId" class="mb-6" :data-testid="`collection-${g.artistId}`">
                <h4 class="mb-2 flex items-baseline gap-2 border-b border-slate-200 pb-1">
                    <RouterLink :to="artistLink(g.artistId)" class="text-base font-medium text-sky-900 hover:underline">{{ g.name }}</RouterLink>
                    <span class="text-xs text-slate-500">{{ g.works.length }} {{ g.works.length === 1 ? 'work' : 'works' }}</span>
                </h4>
                <ul class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                    <li v-for="w in g.works" :key="w.id">
                        <RouterLink
                            :to="{ name: 'bo-work', params: { id: w.id } }"
                            class="group block overflow-hidden rounded-md border border-slate-200 bg-white hover:border-sky-700 focus-visible:outline-2 focus-visible:outline-sky-700"
                        >
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
            </div>
        </section>

        <!-- Invoices -->
        <section aria-labelledby="invoices-h" class="rounded-md border border-slate-200 bg-white p-4">
            <div class="mb-2 flex flex-wrap items-center gap-2">
                <h3 id="invoices-h" class="text-sm font-semibold">Invoices ({{ profile.invoices.length }})</h3>
                <span class="flex-1" />
                <button type="button" :class="btnPrimary" :disabled="!onHold.length" :title="onHold.length ? '' : 'Put a work on hold for this collector first'" @click="openNewInvoice">
                    + New invoice
                </button>
            </div>
            <div v-if="profile.invoices.length" class="overflow-x-auto">
                <table class="w-full min-w-[32rem] text-left text-sm">
                    <thead class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th scope="col" class="py-1.5 pr-3 font-medium">Invoice</th>
                            <th scope="col" class="py-1.5 pr-3 font-medium">Date</th>
                            <th scope="col" class="py-1.5 pr-3 font-medium">Works</th>
                            <th scope="col" class="py-1.5 pr-3 text-right font-medium">Total</th>
                            <th scope="col" class="py-1.5 pr-3 text-right font-medium">Balance</th>
                            <th scope="col" class="py-1.5 font-medium">Status</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        <tr v-for="i in profile.invoices" :key="i.id">
                            <td class="py-1.5 pr-3">
                                <RouterLink :to="{ name: 'bo-invoice', params: { id: i.id } }" class="font-medium text-sky-900 hover:underline">{{ i.number }}</RouterLink>
                            </td>
                            <td class="py-1.5 pr-3 text-slate-600">{{ formatDate(i.issuedOn) }}</td>
                            <td class="max-w-56 truncate py-1.5 pr-3 italic">{{ i.titles }}</td>
                            <td class="py-1.5 pr-3 text-right tabular-nums">{{ money(i.totalCents, i.currency) }}</td>
                            <td class="py-1.5 pr-3 text-right tabular-nums">{{ i.balanceCents ? money(i.balanceCents, i.currency) : '—' }}</td>
                            <td class="py-1.5"><StatusBadge :status="i.status" /></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p v-else class="text-sm text-slate-500">No invoices yet.</p>
        </section>

        <!-- Viewing rooms -->
        <section aria-labelledby="rooms-h" class="rounded-md border border-slate-200 bg-white p-4" data-testid="collector-rooms">
            <h3 id="rooms-h" class="mb-2 text-sm font-semibold">Viewing rooms ({{ profile.viewingRooms.length }})</h3>
            <div v-if="profile.viewingRooms.length" class="overflow-x-auto">
                <table class="w-full min-w-[36rem] text-left text-sm">
                    <thead class="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                            <th scope="col" class="py-1.5 pr-3 font-medium">Room</th>
                            <th scope="col" class="py-1.5 pr-3 font-medium">Last visit</th>
                            <th scope="col" class="py-1.5 pr-3 text-right font-medium">Visits</th>
                            <th scope="col" class="py-1.5 pr-3 text-right font-medium">Time</th>
                            <th scope="col" class="py-1.5 pr-3 text-right font-medium">Works seen</th>
                            <th scope="col" class="py-1.5 font-medium">Engagement</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        <tr v-for="v in profile.viewingRooms" :key="v.id">
                            <td class="py-1.5 pr-3">
                                <RouterLink :to="{ name: 'bo-room-visitor', params: { id: v.roomId, visitorId: v.id } }" class="font-medium text-sky-900 hover:underline">{{ v.roomTitle }}</RouterLink>
                                <span v-if="v.inquiries" class="ml-1.5 rounded bg-rose-50 px-1 text-[11px] font-medium text-rose-800">Inquired</span>
                                <span v-if="v.enteredName !== person.name || v.enteredEmail !== (person.email || '').toLowerCase()" class="block text-xs text-slate-500" title="What they typed at the gate (not verified)">as {{ v.enteredName }} · {{ v.enteredEmail }}</span>
                            </td>
                            <td class="py-1.5 pr-3 text-slate-600">{{ when(v.lastSeenAt) }}</td>
                            <td class="py-1.5 pr-3 text-right tabular-nums">{{ v.visits }}</td>
                            <td class="py-1.5 pr-3 text-right tabular-nums">{{ duration(v.activeMs) }}</td>
                            <td class="py-1.5 pr-3 text-right tabular-nums">{{ v.worksViewed }} / {{ v.worksTotal }}</td>
                            <td class="py-1.5"><EngagementDots :score="v.engagement" /></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p v-else class="text-sm text-slate-500">{{ person.name }} hasn’t visited a viewing room.</p>

            <div v-if="profile.topWorks.length" class="mt-4">
                <h4 class="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Works they looked at most</h4>
                <ul class="grid grid-cols-3 gap-3 sm:grid-cols-6">
                    <li v-for="w in profile.topWorks" :key="w.workId">
                        <RouterLink
                            :to="w.roomId && w.visitorId ? { name: 'bo-room-visitor', params: { id: w.roomId, visitorId: w.visitorId }, hash: `#work-${w.workId}` } : { name: 'bo-work', params: { id: w.workId } }"
                            class="group block"
                            :title="`${w.artistName}, ${w.title} — interest ${w.interest}/100`"
                        >
                            <div class="flex aspect-square items-center justify-center overflow-hidden rounded bg-slate-100">
                                <img v-if="w.image" :src="w.image" alt="" class="h-full w-full object-contain" loading="lazy" />
                            </div>
                            <div class="mt-1 truncate text-xs italic text-slate-800 group-hover:text-sky-900">{{ w.title || 'Untitled' }}</div>
                            <div class="truncate text-[11px] text-slate-500">{{ w.artistName }}</div>
                            <div class="mt-0.5 h-1 rounded bg-slate-100"><div class="h-1 rounded bg-sky-700" :style="{ width: `${w.interest}%` }" /></div>
                        </RouterLink>
                    </li>
                </ul>
            </div>
        </section>

        <!-- Notes -->
        <section aria-labelledby="cnotes-h" class="rounded-md border border-slate-200 bg-white p-4">
            <div class="mb-1 flex items-center gap-2">
                <h3 id="cnotes-h" class="text-sm font-semibold">Collector notes <span class="font-normal text-slate-500">(private)</span></h3>
                <span class="flex-1" />
                <span v-if="dirty" class="text-xs text-amber-700">● Unsaved</span>
                <button type="button" :class="btnPrimary" :disabled="!dirty || saving" @click="save()">{{ saving ? 'Saving…' : 'Save notes' }}</button>
            </div>
            <Field v-model="notes" label="Notes" multiline hint="Interests, advisors, shipping preferences…" />
        </section>

        <div class="border-t border-slate-200 pt-4">
            <button type="button" :class="btnDanger" :disabled="profile.invoices.length > 0" @click="confirmRemove = true">Remove collector profile…</button>
            <span v-if="profile.invoices.length" class="ml-2 text-xs text-slate-500">Collectors with invoices keep their profile.</span>
        </div>

        <Dialog v-model:open="creating.open" title="New invoice" :description="`Bill ${person.name} for works on hold for them.`">
            <form id="new-invoice" class="space-y-3" @submit.prevent="createInvoice">
                <fieldset class="space-y-1.5 text-sm">
                    <legend class="mb-1 text-xs font-medium text-slate-600">Works</legend>
                    <label v-for="w in onHold" :key="w.id" class="flex items-center gap-2">
                        <input v-model="creating.workIds" type="checkbox" :value="w.id" class="h-4 w-4" />
                        <img v-if="w.image" :src="w.image.url" alt="" class="h-8 w-8 rounded object-cover" />
                        <span>
                            <span class="italic">{{ w.title || 'Untitled' }}</span>, {{ w.artistName }}
                            <span class="text-slate-500">· {{ formatPrice(w.priceCents, w.currency) || 'no price' }}</span>
                            <span v-if="invoiced.has(w.id)" class="text-xs text-amber-700"> (already on an unpaid invoice)</span>
                        </span>
                    </label>
                </fieldset>
                <Field v-model="creating.discount" label="Discount (%)" placeholder="0" />
                <p class="text-xs text-slate-500">Sales tax, terms and the “To” block come from the invoice settings and this person’s details; you can change them on the invoice.</p>
            </form>
            <template #footer>
                <button type="button" :class="btnOutline" @click="creating.open = false">Cancel</button>
                <button type="submit" form="new-invoice" :class="btnPrimary" :disabled="creating.busy || !creating.workIds.length">Create invoice</button>
            </template>
        </Dialog>

        <Dialog v-model:open="confirmRemove" title="Remove the collector profile?" description="Their works stay on hold for or sold to them; only the profile is removed.">
            <template #footer>
                <button type="button" :class="btnOutline" @click="confirmRemove = false">Cancel</button>
                <button type="button" :class="btnDanger" class="!bg-red-700 !text-white" @click="removeProfile">Remove</button>
            </template>
        </Dialog>
    </div>
</template>
