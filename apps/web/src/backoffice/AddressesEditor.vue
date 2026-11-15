<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { formatAddress, type AddressEntity, type AddressLink } from '@twelveten/shared';
import Dialog from '@/admin/ui/Dialog.vue';
import Field from '@/admin/ui/Field.vue';
import SelectField from '@/admin/ui/SelectField.vue';
import { errorMessage, isConflict } from '@/admin/api';
import { toast } from '@/admin/state';
import { btnDanger, btnGhost, btnOutline, btnPrimary } from '@/admin/ui/buttons';
import { boApi } from './api';
import { COUNTRIES } from './countries';

/**
 * Structured addresses attached to any entity (people today). Each change saves immediately.
 * Reusable: pass the owner's `entity` and `entityId`.
 */
const props = defineProps<{ entity: AddressEntity; entityId: string; initial?: AddressLink[] }>();
const emit = defineEmits<{ changed: [items: AddressLink[]] }>();
const items = ref<AddressLink[]>(props.initial ?? []);

onMounted(async () => {
    if (!props.initial) items.value = await boApi.addresses(props.entity, props.entityId).catch(() => []);
});

const countryOptions = COUNTRIES.map((c) => ({ value: c.code, label: c.name }));

const set = (next: AddressLink[]) => {
    items.value = next;
    emit('changed', next);
};

// Add / edit dialog
type Form = { label: string | null; line1: string | null; line2: string | null; city: string | null; region: string | null; postalCode: string | null; country: string | null; notes: string | null; isPrimary: boolean };
const blank = (): Form => ({ label: null, line1: null, line2: null, city: null, region: null, postalCode: null, country: 'US', notes: null, isPrimary: false });
const dialog = reactive<{ open: boolean; editing: AddressLink | null; busy: boolean; form: Form }>({ open: false, editing: null, busy: false, form: blank() });

function openAdd() {
    Object.assign(dialog, { open: true, editing: null, busy: false, form: { ...blank(), isPrimary: items.value.length === 0 } });
}
function openEdit(link: AddressLink) {
    const a = link.address;
    Object.assign(dialog, {
        open: true,
        editing: link,
        busy: false,
        form: { label: link.label, line1: a.line1 || null, line2: a.line2, city: a.city, region: a.region, postalCode: a.postalCode, country: a.country, notes: a.notes, isPrimary: link.isPrimary },
    });
}

async function save() {
    const f = dialog.form;
    const address = { line1: f.line1 ?? '', line2: f.line2, city: f.city, region: f.region, postalCode: f.postalCode, country: f.country || 'US', notes: f.notes };
    dialog.busy = true;
    try {
        if (dialog.editing) {
            const link = dialog.editing;
            await boApi.patchAddress(link.address.id, { ...address, updatedAt: link.address.updatedAt });
            set(await boApi.patchAddressLink(link.linkId, { label: f.label, ...(f.isPrimary && !link.isPrimary ? { isPrimary: true } : {}) }));
        } else {
            set(await boApi.attachAddress({ entity: props.entity, entityId: props.entityId, label: f.label, isPrimary: f.isPrimary, address }));
        }
        dialog.open = false;
        toast('Address saved', 'success', 1500);
    } catch (e) {
        if (isConflict(e)) {
            toast('This address was changed elsewhere — reloaded', 'error');
            set(await boApi.addresses(props.entity, props.entityId));
            dialog.open = false;
        } else toast(errorMessage(e), 'error');
    } finally {
        dialog.busy = false;
    }
}

async function makePrimary(link: AddressLink) {
    try {
        set(await boApi.patchAddressLink(link.linkId, { isPrimary: true }));
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}
async function move(link: AddressLink, delta: number) {
    const index = items.value.indexOf(link);
    try {
        set(await boApi.patchAddressLink(link.linkId, { position: Math.max(0, index + delta) }));
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}
const confirmDetach = ref<AddressLink | null>(null);
async function detach(link: AddressLink) {
    confirmDetach.value = null;
    try {
        set(await boApi.detachAddress(link.linkId));
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}
</script>

<template>
    <div>
        <ul v-if="items.length" class="grid gap-3 sm:grid-cols-2">
            <li v-for="(link, i) in items" :key="link.linkId" class="rounded-md border border-slate-200 bg-white p-3 text-sm" data-testid="address-card">
                <div class="mb-1 flex items-center gap-2">
                    <span class="font-medium">{{ link.label || 'Address' }}</span>
                    <span v-if="link.isPrimary" class="rounded bg-sky-50 px-1.5 text-[11px] font-medium text-sky-900 ring-1 ring-inset ring-sky-700/20">Primary</span>
                    <span v-if="link.sharedWith > 1" class="text-[11px] text-slate-500" :title="`Shared with ${link.sharedWith - 1} other record(s); edits apply to all`">Shared</span>
                </div>
                <address class="not-italic leading-snug text-slate-700">
                    <div v-for="line in formatAddress(link.address)" :key="line">{{ line }}</div>
                </address>
                <p v-if="link.address.notes" class="mt-1 text-xs text-slate-500">{{ link.address.notes }}</p>
                <div class="mt-2 flex flex-wrap gap-x-3 text-xs">
                    <button type="button" class="text-sky-800 hover:underline" @click="openEdit(link)">Edit</button>
                    <button v-if="!link.isPrimary" type="button" class="text-sky-800 hover:underline" @click="makePrimary(link)">Make primary</button>
                    <button v-if="i > 0" type="button" class="text-slate-600 hover:underline" aria-label="Move up" @click="move(link, -1)">↑</button>
                    <button v-if="i < items.length - 1" type="button" class="text-slate-600 hover:underline" aria-label="Move down" @click="move(link, 1)">↓</button>
                    <button type="button" class="text-red-700 hover:underline" @click="confirmDetach = link">Remove</button>
                </div>
            </li>
        </ul>
        <p v-else class="text-sm text-slate-500">No addresses yet.</p>
        <button type="button" :class="btnOutline" class="mt-3" @click="openAdd">+ Add address</button>

        <Dialog v-model:open="dialog.open" :title="dialog.editing ? 'Edit address' : 'Add address'" wide>
            <form id="address-form" class="grid gap-x-4 sm:grid-cols-2" @submit.prevent="save">
                <div class="sm:col-span-2"><Field v-model="dialog.form.label" label="Label" placeholder="Studio, Home, Shipping…" /></div>
                <div class="sm:col-span-2"><Field v-model="dialog.form.line1" label="Street address" /></div>
                <div class="sm:col-span-2"><Field v-model="dialog.form.line2" label="Apartment, suite, etc." /></div>
                <Field v-model="dialog.form.city" label="City" />
                <Field v-model="dialog.form.region" label="State / province / region" />
                <Field v-model="dialog.form.postalCode" label="Postal code" />
                <SelectField v-model="dialog.form.country" label="Country" :options="countryOptions" />
                <div class="sm:col-span-2"><Field v-model="dialog.form.notes" label="Notes" multiline /></div>
                <label v-if="!dialog.editing?.isPrimary" class="flex items-center gap-2 py-1 text-sm sm:col-span-2">
                    <input v-model="dialog.form.isPrimary" type="checkbox" class="h-4 w-4" />
                    Primary address
                </label>
                <p v-if="dialog.editing && dialog.editing.sharedWith > 1" class="text-xs text-amber-800 sm:col-span-2">
                    This address is shared with {{ dialog.editing.sharedWith - 1 }} other record(s). Changes apply to all of them.
                </p>
            </form>
            <template #footer>
                <button type="button" :class="btnGhost" @click="dialog.open = false">Cancel</button>
                <button type="submit" form="address-form" :class="btnPrimary" :disabled="dialog.busy">Save address</button>
            </template>
        </Dialog>

        <Dialog :open="Boolean(confirmDetach)" title="Remove this address?" description="It is removed from this record only." @update:open="(o) => !o && (confirmDetach = null)">
            <template #footer>
                <button type="button" :class="btnOutline" @click="confirmDetach = null">Cancel</button>
                <button type="button" :class="btnDanger" class="!bg-red-700 !text-white" @click="detach(confirmDetach!)">Remove</button>
            </template>
        </Dialog>
    </div>
</template>
