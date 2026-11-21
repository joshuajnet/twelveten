<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { type InvoiceSettings, type ShippingLabelSource } from '@twelveten/shared';
import Dialog from '@/admin/ui/Dialog.vue';
import Field from '@/admin/ui/Field.vue';
import { errorMessage } from '@/admin/api';
import { toast } from '@/admin/state';
import { btnGhost, btnOutline, btnPrimary } from '@/admin/ui/buttons';
import { boApi } from './api';

/**
 * Shipping labels for some works: one Letter page per work, with a typed ship-to address and the
 * gallery's return address (or another one typed in). The PDF is made on request and not stored.
 */
const props = defineProps<{ source: ShippingLabelSource; summary: string }>();
const open = defineModel<boolean>('open', { required: true });

// The last addresses typed are kept for this browser session, for a run of shipments to one place.
const KEY = 'twelveten.shippingLabel';
type Saved = { destination: string; returnMode: 'gallery' | 'other'; returnAddress: string };
function loadSaved(): Partial<Saved> {
    try {
        return JSON.parse(sessionStorage.getItem(KEY) ?? '{}') as Partial<Saved>;
    } catch {
        return {};
    }
}
const saved = loadSaved();
const destination = ref<string | null>(saved.destination ?? null);
const returnMode = ref<'gallery' | 'other'>(saved.returnMode ?? 'gallery');
const returnAddress = ref<string | null>(saved.returnAddress ?? null);

const gallery = ref<InvoiceSettings | null>(null);
watch(
    open,
    async (o) => {
        if (!o || gallery.value) return;
        try {
            gallery.value = await boApi.invoiceSettings();
        } catch {
            // The preview is only a reminder; the server fills in the gallery address itself.
        }
    },
    { immediate: true },
);
const galleryLines = computed(() => (gallery.value ? [gallery.value.galleryName, ...gallery.value.address.split('\n')].map((l) => l.trim()).filter(Boolean) : []));

const ready = computed(() => Boolean(destination.value?.trim()) && (returnMode.value === 'gallery' || Boolean(returnAddress.value?.trim())));

// The made PDF, until anything changes.
const file = ref<{ url: string; name: string } | null>(null);
const clearFile = () => {
    if (file.value) URL.revokeObjectURL(file.value.url);
    file.value = null;
};
watch([destination, returnMode, returnAddress, () => JSON.stringify(props.source)], clearFile);
watch(open, (o) => !o && clearFile());
onBeforeUnmount(clearFile);

const making = ref(false);
async function make() {
    if (!ready.value) return;
    making.value = true;
    try {
        const out = await boApi.shippingLabels({
            source: props.source,
            destination: destination.value!,
            returnAddress: returnMode.value === 'other' ? returnAddress.value : null,
        });
        try {
            sessionStorage.setItem(KEY, JSON.stringify({ destination: destination.value ?? '', returnMode: returnMode.value, returnAddress: returnAddress.value ?? '' } satisfies Saved));
        } catch {
            // Not remembered; nothing else depends on it.
        }
        clearFile();
        file.value = { url: URL.createObjectURL(out.blob), name: out.filename ?? 'Shipping labels.pdf' };
    } catch (e) {
        toast(errorMessage(e), 'error');
    } finally {
        making.value = false;
    }
}
</script>

<template>
    <Dialog v-model:open="open" title="Shipping labels" :description="summary">
        <form class="space-y-3" @submit.prevent="make">
            <Field v-model="destination" label="Ship to" multiline placeholder="Name&#10;Street&#10;City, State ZIP" data-testid="label-destination" />
            <fieldset>
                <legend class="text-xs font-medium text-slate-600">Return address</legend>
                <label class="mt-1 flex items-start gap-2 text-sm">
                    <input v-model="returnMode" type="radio" value="gallery" class="mt-1" data-testid="label-return-gallery" />
                    <span>
                        Gallery address
                        <span v-if="galleryLines.length" class="block whitespace-pre-line text-xs text-slate-500">{{ galleryLines.join('\n') }}</span>
                    </span>
                </label>
                <label class="mt-1 flex items-center gap-2 text-sm">
                    <input v-model="returnMode" type="radio" value="other" data-testid="label-return-other" />
                    Other
                </label>
                <Field v-if="returnMode === 'other'" v-model="returnAddress" label="Other return address" multiline data-testid="label-return-address" />
            </fieldset>
            <button type="submit" class="sr-only" tabindex="-1">Make PDF</button>
        </form>
        <template #footer>
            <template v-if="file">
                <a :href="file.url" target="_blank" rel="noopener" :class="btnOutline" data-testid="label-open"><i class="las la-external-link-alt" aria-hidden="true" /> Open PDF</a>
                <a :href="file.url" :download="file.name" :class="btnPrimary" data-testid="label-download"><i class="las la-download" aria-hidden="true" /> Download</a>
            </template>
            <template v-else>
                <button type="button" :class="btnGhost" @click="open = false">Cancel</button>
                <button type="button" :class="btnPrimary" :disabled="!ready || making" data-testid="label-make" @click="make">
                    <i class="las la-shipping-fast" aria-hidden="true" /> {{ making ? 'Making…' : 'Make PDF' }}
                </button>
            </template>
        </template>
    </Dialog>
</template>
