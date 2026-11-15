<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { formatPercent, invoiceTotals, parsePercent, todayIso, type PersonSummary, type WorkSummary } from '@twelveten/shared';
import Field from '@/admin/ui/Field.vue';
import { errorMessage } from '@/admin/api';
import { toast } from '@/admin/state';
import { btnPrimary } from '@/admin/ui/buttons';
import { boApi } from './api';
import { money, percentInput } from './format';
import PersonPicker from './PersonPicker.vue';
import WorkPicker from './WorkPicker.vue';

/**
 * Start an invoice from scratch: choose the buyer, then any works from the inventory (any artists).
 * Creating it puts available works on hold for the buyer.
 */
const router = useRouter();

const buyer = ref<PersonSummary | null>(null);
const selected = ref<WorkSummary[]>([]);
const form = reactive({ issuedOn: todayIso() as string | null, discount: '' as string | null, tax: '' as string | null });
boApi.invoiceSettings().then(
    (s) => (form.tax = percentInput(s.defaultTaxRateBps)),
    () => {},
);

/** Why a work can't go on this buyer's invoice, or '' when it can. */
function blocked(w: WorkSummary): string {
    const mine = buyer.value && w.buyerId === buyer.value.id;
    if (w.status === 'available') return '';
    if (w.status === 'on_hold') return !w.buyerId || mine ? '' : 'On hold for someone else';
    if (w.status === 'sold') return mine ? '' : 'Sold';
    return w.status === 'nfs' ? 'Not for sale' : 'Returned to artist';
}
const isSelected = (w: WorkSummary) => selected.value.some((s) => s.id === w.id);
const selectedIds = computed(() => selected.value.map((w) => w.id));
function toggle(w: WorkSummary) {
    if (isSelected(w)) selected.value = selected.value.filter((s) => s.id !== w.id);
    else if (!blocked(w)) selected.value = [...selected.value, w];
}
// Changing the buyer can make chosen works ineligible (held for someone else).
watch(buyer, () => (selected.value = selected.value.filter((w) => !blocked(w))));

const discountBps = computed(() => parsePercent(form.discount ?? ''));
const taxBps = computed(() => parsePercent(form.tax ?? ''));
const totals = computed(() =>
    Number.isNaN(discountBps.value) || Number.isNaN(taxBps.value) ? null : invoiceTotals(selected.value.map((w) => w.priceCents ?? 0), discountBps.value, taxBps.value, 0),
);
const unpriced = computed(() => selected.value.filter((w) => w.priceCents === null));
const currencies = computed(() => new Set(selected.value.map((w) => w.currency)));

const busy = ref(false);
async function create() {
    if (!buyer.value) return void toast('Choose who the invoice is for', 'error');
    if (!selected.value.length) return void toast('Choose at least one work', 'error');
    if (!totals.value) return void toast('Discount and sales tax must be percentages, e.g. 10.25', 'error');
    busy.value = true;
    try {
        const inv = await boApi.createInvoice({
            personId: buyer.value.id,
            workIds: selected.value.map((w) => w.id),
            issuedOn: form.issuedOn || undefined,
            discountBps: discountBps.value,
            taxRateBps: taxBps.value,
        });
        toast(`Invoice ${inv.number} created`, 'success', 2000);
        await router.push({ name: 'bo-invoice', params: { id: inv.id } });
    } catch (e) {
        toast(errorMessage(e), 'error');
    } finally {
        busy.value = false;
    }
}
</script>

<template>
    <div class="space-y-6">
        <RouterLink :to="{ name: 'bo-invoices' }" class="text-sm text-sky-800 hover:underline">← Invoices</RouterLink>
        <h1 class="text-2xl font-semibold">New invoice</h1>

        <div class="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <div class="space-y-6">
                <!-- 1. Buyer -->
                <section aria-labelledby="buyer-h" class="rounded-md border border-slate-200 bg-white p-4">
                    <h2 id="buyer-h" class="mb-1 text-sm font-semibold">1. Bill to</h2>
                    <div v-if="buyer" class="flex flex-wrap items-center gap-2 text-sm">
                        <span class="font-medium" data-testid="invoice-buyer">{{ buyer.name }}</span>
                        <span v-if="buyer.email" class="text-slate-500">{{ buyer.email }}</span>
                        <button type="button" class="text-xs text-slate-500 hover:underline" @click="buyer = null">Change</button>
                    </div>
                    <PersonPicker v-else label="Buyer" profile="collector" placeholder="Search people or add a new one…" @select="(p) => (buyer = p)" />
                    <p class="mt-1 text-xs text-slate-500">The “To” block is filled from their name, primary address, phone and email; you can edit it after.</p>
                </section>

                <!-- 2. Works -->
                <section aria-labelledby="works-h" class="rounded-md border border-slate-200 bg-white p-4">
                    <h2 id="works-h" class="mb-2 text-sm font-semibold">2. Works <span class="font-normal text-slate-500">(any artists)</span></h2>
                    <WorkPicker :selected-ids="selectedIds" :blocked="blocked" testid="invoice-work-results" @toggle="toggle" />
                </section>
            </div>

            <!-- Summary -->
            <aside class="space-y-4 lg:sticky lg:top-4 lg:self-start">
                <section aria-labelledby="sel-h" class="rounded-md border border-slate-200 bg-white p-4 text-sm">
                    <h2 id="sel-h" class="mb-2 font-semibold">Invoice ({{ selected.length }} {{ selected.length === 1 ? 'work' : 'works' }})</h2>
                    <ul v-if="selected.length" class="mb-3 divide-y divide-slate-100" data-testid="invoice-selected">
                        <li v-for="w in selected" :key="w.id" class="flex items-start gap-2 py-1.5">
                            <div class="min-w-0 flex-1">
                                <div class="truncate text-slate-600">{{ w.artistName }}</div>
                                <div class="truncate italic">{{ w.title || 'Untitled' }}</div>
                            </div>
                            <span class="tabular-nums">{{ w.priceCents === null ? '—' : money(w.priceCents, w.currency) }}</span>
                            <button type="button" class="text-xs text-red-700 hover:underline" :aria-label="`Remove ${w.title}`" @click="toggle(w)">×</button>
                        </li>
                    </ul>
                    <p v-else class="mb-3 text-slate-500">Tick works on the left to add them.</p>

                    <div class="grid grid-cols-2 gap-x-2">
                        <Field v-model="form.discount" label="Discount (%)" placeholder="0" />
                        <Field v-model="form.tax" label="Sales tax (%)" placeholder="0" />
                    </div>
                    <Field v-model="form.issuedOn" label="Date" type="date" />

                    <dl v-if="totals && selected.length" class="mt-2 space-y-1 border-t border-slate-200 pt-2 tabular-nums" data-testid="invoice-new-totals">
                        <div class="flex justify-between"><dt>Subtotal</dt><dd>{{ money(totals.subtotalCents) }}</dd></div>
                        <div v-if="totals.discountCents" class="flex justify-between">
                            <dt>Discount ({{ formatPercent(discountBps) }})</dt><dd>−{{ money(totals.discountCents) }}</dd>
                        </div>
                        <div v-if="totals.taxCents" class="flex justify-between"><dt>Sales tax ({{ formatPercent(taxBps) }})</dt><dd>{{ money(totals.taxCents) }}</dd></div>
                        <div class="flex justify-between font-semibold"><dt>Total</dt><dd>{{ money(totals.totalCents) }}</dd></div>
                    </dl>
                    <p v-if="unpriced.length" class="mt-2 text-xs text-amber-700">{{ unpriced.length }} {{ unpriced.length === 1 ? 'work has' : 'works have' }} no price; set it on the invoice.</p>
                    <p v-if="currencies.size > 1" class="mt-2 text-xs text-amber-700">These works are priced in different currencies; the invoice is in USD.</p>
                    <p class="mt-2 text-xs text-slate-500">Creating the invoice puts available works on hold for the buyer.</p>
                    <button type="button" :class="btnPrimary" class="mt-3 w-full justify-center" :disabled="busy || !buyer || !selected.length" @click="create">
                        {{ busy ? 'Creating…' : 'Create invoice' }}
                    </button>
                </section>
            </aside>
        </div>
    </div>
</template>
