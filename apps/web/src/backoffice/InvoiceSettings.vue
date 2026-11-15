<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { parsePercent, type InvoiceSettings } from '@twelveten/shared';
import Field from '@/admin/ui/Field.vue';
import { errorMessage, isConflict } from '@/admin/api';
import { askConflict, toast } from '@/admin/state';
import { btnPrimary } from '@/admin/ui/buttons';
import { boApi } from './api';
import { percentInput } from './format';
import { useUnsavedGuard } from './guard';

/** What every invoice prints: gallery details, default tax and terms. Payment details are read-only (server env). */
const settings = ref<InvoiceSettings | null>(null);
const form = reactive({
    galleryName: '' as string | null,
    address: '' as string | null,
    email: '' as string | null,
    phone: '' as string | null,
    defaultTerms: '' as string | null,
    tax: '' as string | null,
    numberPrefix: '' as string | null,
});
const baseline = ref('');
function reset(s: InvoiceSettings) {
    settings.value = s;
    Object.assign(form, {
        galleryName: s.galleryName,
        address: s.address,
        email: s.email,
        phone: s.phone,
        defaultTerms: s.defaultTerms,
        tax: percentInput(s.defaultTaxRateBps),
        numberPrefix: s.numberPrefix,
    });
    baseline.value = JSON.stringify(form);
}
const dirty = computed(() => Boolean(settings.value) && JSON.stringify(form) !== baseline.value);
useUnsavedGuard(dirty);
boApi.invoiceSettings().then(reset, (e) => toast(errorMessage(e), 'error'));

const saving = ref(false);
async function save(overwrite = false): Promise<void> {
    const tax = parsePercent(form.tax ?? '');
    if (Number.isNaN(tax)) return void toast('Sales tax must be a percentage, e.g. 10.25', 'error');
    if (!form.galleryName?.trim()) return void toast('The gallery name is required', 'error');
    saving.value = true;
    try {
        const base = overwrite ? await boApi.invoiceSettings() : settings.value!;
        reset(
            await boApi.putInvoiceSettings({
                updatedAt: base.updatedAt,
                galleryName: form.galleryName!,
                address: form.address ?? '',
                email: form.email ?? '',
                phone: form.phone ?? '',
                defaultTerms: form.defaultTerms ?? '',
                defaultTaxRateBps: tax,
                numberPrefix: form.numberPrefix ?? '',
            }),
        );
        toast('Invoice settings saved', 'success', 1500);
    } catch (e) {
        if (isConflict(e)) {
            const choice = await askConflict();
            if (choice === 'overwrite') return save(true);
            reset(await boApi.invoiceSettings());
        } else toast(errorMessage(e), 'error');
    } finally {
        saving.value = false;
    }
}

const payRows = computed(() => {
    const p = settings.value?.payment;
    return p
        ? [
              ['Zelle', p.zelle, 'INVOICE_ZELLE'],
              ['Wire routing', p.wireRouting, 'INVOICE_WIRE_ROUTING'],
              ['Wire account', p.wireAccount, 'INVOICE_WIRE_ACCOUNT'],
              ['Checks payable to', p.checksPayableTo, 'INVOICE_CHECKS_PAYABLE_TO'],
          ]
        : [];
});
</script>

<template>
    <div class="max-w-3xl space-y-6">
        <RouterLink :to="{ name: 'bo-invoices' }" class="text-sm text-sky-800 hover:underline">← Invoices</RouterLink>
        <div class="flex items-center gap-3">
            <h1 class="text-xl font-semibold">Invoice settings</h1>
            <span class="flex-1" />
            <span v-if="dirty" class="text-xs text-amber-700">● Unsaved changes</span>
            <button type="button" :class="btnPrimary" :disabled="!dirty || saving" @click="save()">{{ saving ? 'Saving…' : 'Save' }}</button>
        </div>

        <form v-if="settings" class="rounded-md border border-slate-200 bg-white p-4" @submit.prevent="save()">
            <h2 class="mb-1 text-sm font-semibold">Printed on every invoice</h2>
            <div class="grid gap-x-4 sm:grid-cols-2">
                <Field v-model="form.galleryName" label="Gallery name" />
                <Field v-model="form.numberPrefix" label="Invoice number prefix" hint="Numbers look like INV-2026-001." />
                <Field v-model="form.address" label="Address" multiline />
                <div>
                    <Field v-model="form.email" label="Email" type="email" />
                    <Field v-model="form.phone" label="Phone" type="tel" />
                </div>
            </div>
            <h2 class="mb-1 mt-3 text-sm font-semibold">Defaults for new invoices</h2>
            <Field v-model="form.tax" label="Sales tax (%)" hint="Change it on each invoice for out-of-state or resale buyers." />
            <Field v-model="form.defaultTerms" label="Terms" multiline />
            <button type="submit" class="hidden" />
        </form>

        <section v-if="settings" aria-labelledby="pay-h" class="rounded-md border border-slate-200 bg-white p-4 text-sm">
            <h2 id="pay-h" class="mb-1 font-semibold">Payment details</h2>
            <p class="mb-2 text-slate-600">
                Bank and payment details are set in the server environment, not here, so they never sit in the database. Lines that aren’t set are left off the invoice.
            </p>
            <dl class="divide-y divide-slate-100">
                <div v-for="[label, value, env] in payRows" :key="env!" class="flex flex-wrap gap-x-3 py-1.5">
                    <dt class="w-40 text-slate-600">{{ label }}</dt>
                    <dd class="flex-1" :class="value ? 'font-mono' : 'text-slate-400'">{{ value ?? 'Not set' }}</dd>
                    <dd class="font-mono text-xs text-slate-400">{{ env }}</dd>
                </div>
            </dl>
        </section>
    </div>
</template>
