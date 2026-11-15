<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import {
    formatDate,
    formatPercent,
    INVOICE_STATUSES,
    invoiceTotals,
    parsePercent,
    parsePrice,
    todayIso,
    type Invoice,
    type InvoicePatch,
    type InvoiceStatus,
    type WorkSummary,
} from '@twelveten/shared';
import Field from '@/admin/ui/Field.vue';
import Dialog from '@/admin/ui/Dialog.vue';
import { ApiError } from '@/api/client';
import { errorMessage, isConflict } from '@/admin/api';
import { askConflict, toast } from '@/admin/state';
import { btnDanger, btnGhost, btnOutline, btnPrimary } from '@/admin/ui/buttons';
import { boApi } from './api';
import { useUnsavedGuard } from './guard';
import { amountInput, money, percentInput } from './format';
import StatusBadge from './StatusBadge.vue';

/** One invoice: the printed fields, its line items, payments, and the PDF. */
const route = useRoute();
const router = useRouter();
const id = computed(() => String(route.params.id));

const invoice = ref<Invoice | null>(null);
const inv = computed(() => invoice.value as Invoice);
const notFound = ref(false);

const form = reactive({
    number: '' as string | null,
    issuedOn: '' as string | null,
    status: 'open' as InvoiceStatus,
    billTo: '' as string | null,
    discount: '' as string | null,
    tax: '' as string | null,
    shipping: '' as string | null,
    terms: '' as string | null,
    notes: null as string | null,
});
const baseline = ref('');
function reset(i: Invoice) {
    invoice.value = i;
    Object.assign(form, {
        number: i.number,
        issuedOn: i.issuedOn,
        status: i.status,
        billTo: i.billTo,
        discount: percentInput(i.discountBps),
        tax: percentInput(i.taxRateBps),
        shipping: i.shippingCents ? amountInput(i.shippingCents) : '',
        terms: i.terms,
        notes: i.notes,
    });
    baseline.value = JSON.stringify(form);
}
const dirty = computed(() => Boolean(invoice.value) && JSON.stringify(form) !== baseline.value);
useUnsavedGuard(dirty);

async function load() {
    notFound.value = false;
    try {
        reset(await boApi.invoice(id.value));
    } catch (e) {
        if (e instanceof ApiError && e.status === 404) notFound.value = true;
        else toast(errorMessage(e), 'error');
    }
}
watch(id, () => void load(), { immediate: true });

// Values as typed, parsed.
const discountBps = computed(() => parsePercent(form.discount ?? ''));
const taxBps = computed(() => parsePercent(form.tax ?? ''));
const shippingCents = computed(() => parsePrice(form.shipping ?? '') ?? 0);
const invalid = computed(() => {
    if (Number.isNaN(discountBps.value)) return 'Discount must be a percentage, e.g. 10';
    if (Number.isNaN(taxBps.value)) return 'Sales tax must be a percentage, e.g. 10.25';
    if (Number.isNaN(shippingCents.value)) return 'Shipping must be an amount, e.g. 150';
    if (!form.number?.trim()) return 'The invoice needs a number';
    if (!form.issuedOn) return 'The invoice needs a date';
    return '';
});

/** Totals as they will be once saved. */
const preview = computed(() =>
    invoice.value && !invalid.value ? invoiceTotals(inv.value.items.map((i) => i.priceCents), discountBps.value, taxBps.value, shippingCents.value) : null,
);

const saving = ref(false);
async function save(overwrite = false): Promise<void> {
    if (!invoice.value || (!dirty.value && !overwrite)) return;
    if (invalid.value) return void toast(invalid.value, 'error');
    saving.value = true;
    try {
        const base = overwrite ? await boApi.invoice(id.value) : inv.value;
        const patch: InvoicePatch = {
            updatedAt: base.updatedAt,
            number: form.number!.trim(),
            issuedOn: form.issuedOn!,
            billTo: form.billTo ?? '',
            discountBps: discountBps.value,
            taxRateBps: taxBps.value,
            shippingCents: shippingCents.value,
            terms: form.terms ?? '',
            notes: form.notes || null,
            ...(form.status !== base.status ? { status: form.status } : {}),
        };
        reset(await boApi.patchInvoice(base.id, patch));
        toast('Invoice saved', 'success', 1500);
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
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

/** Item and payment changes save straight away; keep unsaved field edits. */
function takeServer(i: Invoice) {
    const edits = dirty.value ? JSON.stringify(form) : null;
    reset(i);
    if (edits) Object.assign(form, { ...JSON.parse(edits), status: i.status });
}
async function run(fn: () => Promise<Invoice>, done?: string) {
    try {
        takeServer(await fn());
        if (done) toast(done, 'success', 1500);
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}

// ---- Items ----
async function setItemPrice(itemId: string, value: string) {
    const c = parsePrice(value);
    if (c === null || Number.isNaN(c)) return void toast('Enter a price, e.g. 2400', 'error');
    await run(() => boApi.patchInvoiceItem(id.value, itemId, { priceCents: c }), 'Price updated');
}
const removeItem = (itemId: string) => run(() => boApi.deleteInvoiceItem(id.value, itemId), 'Removed from the invoice');

/** The collector's on-hold works not on this invoice yet. */
const addable = ref<WorkSummary[]>([]);
const toAdd = ref('');
watch(
    () => invoice.value?.personId,
    async (personId) => {
        if (!personId) return;
        const p = await boApi.person(personId).catch(() => null);
        addable.value = p?.collectorProfile?.collection.flatMap((g) => g.works.filter((w) => w.status === 'on_hold')) ?? [];
    },
    { immediate: true },
);
const addOptions = computed(() => addable.value.filter((w) => !invoice.value?.items.some((i) => i.workId === w.id)));
async function addItem() {
    if (!toAdd.value) return;
    await run(() => boApi.addInvoiceItem(id.value, toAdd.value), 'Added to the invoice');
    toAdd.value = '';
}

// ---- Payments ----
const METHODS = ['Zelle', 'Wire transfer', 'Check', 'Card', 'Cash', 'Other'];
const pay = reactive({ amount: '' as string | null, paidOn: todayIso() as string | null, method: 'Zelle', note: null as string | null, busy: false });
async function addPayment(full = false) {
    const amountCents = full ? inv.value.balanceCents : parsePrice(pay.amount ?? '');
    if (!amountCents || Number.isNaN(amountCents)) return void toast('Enter the amount received', 'error');
    if (!pay.paidOn) return void toast('Enter the date it was received', 'error');
    pay.busy = true;
    await run(() => boApi.addPayment(id.value, { amountCents, paidOn: pay.paidOn!, method: pay.method, note: pay.note }), 'Payment recorded');
    Object.assign(pay, { amount: '', note: null, busy: false });
}
const removePayment = (paymentId: string) => run(() => boApi.deletePayment(id.value, paymentId), 'Payment removed');

// ---- Delete ----
const confirmDelete = ref(false);
async function remove() {
    confirmDelete.value = false;
    try {
        await boApi.deleteInvoice(id.value);
        baseline.value = JSON.stringify(form);
        toast('Invoice deleted', 'success');
        await router.push({ name: 'bo-invoices' });
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}

const statusHint = computed(() => {
    const was = invoice.value?.status;
    if (form.status === 'paid' && was !== 'paid') return 'Saving as Paid records the works as sold to this collector.';
    if (form.status === 'cancelled' && was !== 'cancelled') return 'Cancelled: the buyer didn’t pay. Saving removes its works from their collection and puts them back on sale.';
    if (was === 'cancelled' && form.status !== 'cancelled') return 'Reopening holds its works for this collector again (if still available).';
    if (was === 'paid' && form.status !== 'paid') return 'No longer paid: saving puts its works back on hold for this collector instead of sold.';
    return 'Recording payments sets Open / Partial payment / Paid automatically.';
});
</script>

<template>
    <div v-if="notFound" class="py-16 text-center">
        <p class="mb-4 text-slate-600">This invoice doesn’t exist (it may have been deleted).</p>
        <RouterLink :to="{ name: 'bo-invoices' }" :class="btnOutline">Back to invoices</RouterLink>
    </div>
    <div v-else-if="!invoice" class="py-16 text-center text-sm text-slate-500">Loading…</div>
    <div v-else class="space-y-6">
        <RouterLink :to="{ name: 'bo-invoices' }" class="text-sm text-sky-800 hover:underline">← Invoices</RouterLink>

        <div class="flex flex-wrap items-center gap-3">
            <h1 class="text-2xl font-semibold">Invoice {{ inv.number }}</h1>
            <StatusBadge :status="inv.status" />
            <RouterLink :to="{ name: 'bo-person', params: { id: inv.personId, profile: 'collector' } }" class="text-sm text-sky-900 hover:underline">{{ inv.personName }}</RouterLink>
            <span class="flex-1" />
            <span v-if="dirty" class="text-xs text-amber-700">● Unsaved changes</span>
            <a :href="boApi.invoicePdfUrl(inv.id)" target="_blank" rel="noopener" :class="btnOutline" :title="dirty ? 'The PDF shows the saved invoice' : ''">View PDF</a>
            <a :href="boApi.invoicePdfUrl(inv.id, true)" :class="btnOutline" download>Download PDF</a>
            <button type="button" :class="btnPrimary" :disabled="!dirty || saving" title="Save (Ctrl+S)" @click="save()">{{ saving ? 'Saving…' : 'Save' }}</button>
        </div>

        <div class="grid gap-6 lg:grid-cols-[1fr_20rem]">
            <div class="space-y-6">
                <!-- Items -->
                <section aria-labelledby="items-h" class="rounded-md border border-slate-200 bg-white p-4">
                    <h2 id="items-h" class="mb-2 text-sm font-semibold">Items</h2>
                    <ul class="divide-y divide-slate-100" data-testid="invoice-items">
                        <li v-for="it in inv.items" :key="it.id" class="flex flex-wrap items-start gap-3 py-3">
                            <div class="flex h-16 w-20 shrink-0 items-center justify-center bg-slate-100">
                                <img v-if="it.imageUrl" :src="it.imageUrl" alt="" class="max-h-full max-w-full object-contain" />
                            </div>
                            <div class="min-w-0 flex-1 text-sm leading-snug">
                                <div>{{ it.artistName }}</div>
                                <div class="italic">
                                    <RouterLink v-if="it.workId" :to="{ name: 'bo-work', params: { id: it.workId } }" class="text-sky-900 hover:underline">{{ it.title || 'Untitled' }}</RouterLink>
                                    <span v-else>{{ it.title || 'Untitled' }}</span>
                                </div>
                                <div class="text-xs text-slate-600">{{ [it.dateText, it.medium, it.dimensions].filter(Boolean).join(' · ') }}</div>
                            </div>
                            <label class="w-32 text-right">
                                <span class="sr-only">Price of {{ it.title }}</span>
                                <input
                                    :value="amountInput(it.priceCents)"
                                    inputmode="decimal"
                                    :disabled="inv.status === 'paid'"
                                    class="w-full rounded border border-slate-300 px-2 py-1 text-right text-sm tabular-nums focus:border-sky-700 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500"
                                    @change="setItemPrice(it.id, ($event.target as HTMLInputElement).value)"
                                />
                            </label>
                            <button
                                v-if="inv.status !== 'paid'"
                                type="button"
                                class="text-xs text-red-700 hover:underline"
                                :disabled="inv.items.length === 1"
                                :title="inv.items.length === 1 ? 'An invoice needs at least one item' : ''"
                                @click="removeItem(it.id)"
                            >
                                Remove
                            </button>
                        </li>
                    </ul>
                    <div v-if="addOptions.length && inv.status !== 'paid'" class="mt-2 flex flex-wrap items-center gap-2">
                        <select v-model="toAdd" aria-label="Add a work" class="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm">
                            <option value="">Add another work on hold for {{ inv.personName }}…</option>
                            <option v-for="w in addOptions" :key="w.id" :value="w.id">{{ w.artistName }} — {{ w.title || 'Untitled' }}</option>
                        </select>
                        <button type="button" :class="btnOutline" :disabled="!toAdd" @click="addItem">Add</button>
                    </div>
                    <p v-if="inv.status === 'paid'" class="mt-2 text-xs text-slate-500">This invoice is paid, so its works and prices are fixed. Reopen it or remove a payment to change them.</p>
                    <p class="mt-2 text-xs text-slate-500">Line items keep the caption and price as invoiced; changing the work later doesn’t change this invoice.</p>
                </section>

                <!-- Printed fields -->
                <section aria-labelledby="fields-h" class="rounded-md border border-slate-200 bg-white p-4">
                    <h2 id="fields-h" class="mb-1 text-sm font-semibold">Invoice</h2>
                    <form class="grid gap-x-4 sm:grid-cols-2" @submit.prevent="save()">
                        <Field v-model="form.number" label="Number" />
                        <Field v-model="form.issuedOn" label="Date" type="date" />
                        <div class="sm:col-span-2">
                            <Field v-model="form.billTo" label="To" multiline hint="One line per line: name first, then ℅, address, phone, email." />
                        </div>
                        <Field v-model="form.discount" label="Discount (%)" placeholder="0" />
                        <Field v-model="form.tax" label="Sales tax (%)" placeholder="0" hint="Illinois sales: 10.25. Leave empty for out-of-state." />
                        <Field v-model="form.shipping" label="Shipping" placeholder="0.00" />
                        <label class="block py-1.5">
                            <span class="block text-xs font-medium text-slate-600">Status</span>
                            <select v-model="form.status" class="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm">
                                <option v-for="(label, key) in INVOICE_STATUSES" :key="key" :value="key">{{ label }}</option>
                            </select>
                            <span class="mt-0.5 block text-xs text-slate-500">{{ statusHint }}</span>
                        </label>
                        <div class="sm:col-span-2">
                            <Field v-model="form.terms" label="Terms" multiline />
                            <Field v-model="form.notes" label="Private notes (not printed)" multiline />
                        </div>
                        <p v-if="invalid && dirty" class="text-sm text-red-700 sm:col-span-2">{{ invalid }}</p>
                        <button type="submit" class="hidden" />
                    </form>
                </section>
            </div>

            <div class="space-y-6">
                <!-- Totals -->
                <section aria-labelledby="totals-h" class="rounded-md border border-slate-200 bg-white p-4 text-sm">
                    <h2 id="totals-h" class="mb-2 font-semibold">Totals</h2>
                    <dl v-if="preview" class="space-y-1 tabular-nums" data-testid="invoice-totals">
                        <div class="flex justify-between"><dt>Subtotal</dt><dd>{{ money(preview.subtotalCents, inv.currency) }}</dd></div>
                        <div v-if="preview.discountCents" class="flex justify-between">
                            <dt>Discount ({{ formatPercent(discountBps) }})</dt><dd>−{{ money(preview.discountCents, inv.currency) }}</dd>
                        </div>
                        <div v-if="preview.taxCents" class="flex justify-between"><dt>Sales tax ({{ formatPercent(taxBps) }})</dt><dd>{{ money(preview.taxCents, inv.currency) }}</dd></div>
                        <div v-if="shippingCents" class="flex justify-between"><dt>Shipping</dt><dd>{{ money(shippingCents, inv.currency) }}</dd></div>
                        <div class="flex justify-between border-t border-slate-200 pt-1 text-base font-semibold"><dt>Total</dt><dd>{{ money(preview.totalCents, inv.currency) }}</dd></div>
                        <div class="flex justify-between text-slate-600"><dt>Paid</dt><dd>{{ money(inv.paidCents, inv.currency) }}</dd></div>
                        <div class="flex justify-between font-medium"><dt>Balance</dt><dd>{{ money(Math.max(0, preview.totalCents - inv.paidCents), inv.currency) }}</dd></div>
                    </dl>
                    <p v-if="dirty" class="mt-2 text-xs text-amber-700">Showing unsaved changes.</p>
                </section>

                <!-- Payments -->
                <section aria-labelledby="pay-h" class="rounded-md border border-slate-200 bg-white p-4 text-sm">
                    <h2 id="pay-h" class="mb-2 font-semibold">Payments</h2>
                    <ul v-if="inv.payments.length" class="mb-3 divide-y divide-slate-100" data-testid="invoice-payments">
                        <li v-for="p in inv.payments" :key="p.id" class="flex items-start gap-2 py-1.5">
                            <div class="flex-1">
                                <div class="font-medium tabular-nums">{{ money(p.amountCents, inv.currency) }}</div>
                                <div class="text-xs text-slate-500">{{ formatDate(p.paidOn) }}<span v-if="p.method"> · {{ p.method }}</span><span v-if="p.note"> · {{ p.note }}</span></div>
                            </div>
                            <button type="button" class="text-xs text-red-700 hover:underline" @click="removePayment(p.id)">Remove</button>
                        </li>
                    </ul>
                    <p v-else class="mb-3 text-slate-500">No payments recorded.</p>
                    <form v-if="inv.balanceCents > 0" class="space-y-1 border-t border-slate-100 pt-2" @submit.prevent="addPayment()">
                        <div class="grid grid-cols-2 gap-x-2">
                            <Field v-model="pay.amount" label="Amount" :placeholder="amountInput(inv.balanceCents)" />
                            <Field v-model="pay.paidOn" label="Received" type="date" />
                        </div>
                        <label class="block py-1">
                            <span class="block text-xs font-medium text-slate-600">Method</span>
                            <select v-model="pay.method" class="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm">
                                <option v-for="m in METHODS" :key="m" :value="m">{{ m }}</option>
                            </select>
                        </label>
                        <Field v-model="pay.note" label="Note" />
                        <div class="flex flex-wrap gap-2 pt-1">
                            <button type="submit" :class="btnPrimary" :disabled="pay.busy">Record payment</button>
                            <button type="button" :class="btnGhost" :disabled="pay.busy" @click="addPayment(true)">Paid in full ({{ money(inv.balanceCents, inv.currency) }})</button>
                        </div>
                    </form>
                </section>

                <div class="border-t border-slate-200 pt-4">
                    <button type="button" :class="btnDanger" :disabled="inv.payments.length > 0 || inv.status === 'paid'" @click="confirmDelete = true">Delete invoice…</button>
                    <p v-if="inv.payments.length" class="mt-1 text-xs text-slate-500">Invoices with payments can’t be deleted.</p>
                    <p v-else-if="inv.status === 'paid'" class="mt-1 text-xs text-slate-500">A paid invoice can’t be deleted; reopen it first.</p>
                </div>
            </div>
        </div>

        <Dialog v-model:open="confirmDelete" title="Delete this invoice?" description="Its works go back on sale (unless another open invoice for this collector lists them). This can’t be undone.">
            <template #footer>
                <button type="button" :class="btnOutline" @click="confirmDelete = false">Cancel</button>
                <button type="button" :class="btnDanger" class="!bg-red-700 !text-white" @click="remove">Delete</button>
            </template>
        </Dialog>
    </div>
</template>
