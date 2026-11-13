<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { formatDate, type ExhibitionSummary, type PressItem, type PressPatch } from '@twelveten/shared';
import InlineText from './InlineText.vue';
import DatePicker from './DatePicker.vue';
import Switch from './ui/Switch.vue';
import Field from './ui/Field.vue';
import Dialog from './ui/Dialog.vue';
import { adminApi, conflictCurrent, errorMessage } from './api';
import { askConflict, toast, useUnsavedGuard } from './state';
import { btnDanger, btnOutline, btnPrimary } from './ui/buttons';

/**
 * A press item edited in place, with its link and the exhibition it covers.
 * With `isNew`, nothing exists yet: Save creates it, Discard drops the form.
 */
const props = defineProps<{ item: PressItem; exhibitions: ExhibitionSummary[]; isNew?: boolean }>();
const emit = defineEmits<{ updated: [PressItem]; deleted: [string]; created: [PressItem]; discarded: [] }>();

const form = reactive({
    outlet: props.item.outlet as string | null,
    title: props.item.title as string | null,
    url: props.item.url as string | null,
    publishedOn: props.item.publishedOn,
    issueLabel: props.item.issueLabel,
    byline: props.item.byline,
    exhibitionId: props.item.exhibitionId,
});
const saving = ref(false);
const confirmDelete = ref(false);
const linkOpen = ref(false);

const KEYS = ['outlet', 'title', 'url', 'publishedOn', 'issueLabel', 'byline', 'exhibitionId'] as const;
const dirty = computed(() => KEYS.some((k) => form[k] !== props.item[k]));
const publishOnCreate = ref(false);
useUnsavedGuard(dirty);
const missing = computed(() => [!form.outlet && 'publication', !form.title && 'title', !form.url && 'article link'].filter(Boolean) as string[]);

async function create() {
    if (missing.value.length) {
        if (!form.url) linkOpen.value = true;
        return void toast(`Add the ${missing.value.join(', ')} first`, 'error');
    }
    saving.value = true;
    try {
        const created = await adminApi.createPress({
            outlet: form.outlet!,
            title: form.title!,
            url: form.url!,
            publishedOn: form.publishedOn,
            issueLabel: form.issueLabel || null,
            byline: form.byline || null,
            exhibitionId: form.exhibitionId,
            published: publishOnCreate.value,
        });
        emit('created', created);
        toast('Press item added', 'success', 1500);
    } catch (e) {
        toast(errorMessage(e), 'error');
    } finally {
        saving.value = false;
    }
}

async function save(version = props.item.updatedAt): Promise<void> {
    if (props.isNew) return create();
    if (!form.outlet || !form.title || !form.url) return void toast('Outlet, title and link are required', 'error');
    saving.value = true;
    try {
        const patch: Record<string, unknown> = { updatedAt: version };
        for (const k of KEYS) if (form[k] !== props.item[k]) patch[k] = form[k];
        emit('updated', await adminApi.patchPress(props.item.id, patch as PressPatch));
        toast('Press item saved', 'success', 1500);
    } catch (e) {
        const current = conflictCurrent<PressItem>(e);
        if (current) {
            if ((await askConflict()) === 'overwrite') return save(current.updatedAt);
            emit('updated', current);
            Object.assign(form, Object.fromEntries(KEYS.map((k) => [k, current[k]])));
        } else toast(errorMessage(e), 'error');
    } finally {
        saving.value = false;
    }
}

async function setPublished(on: boolean) {
    if (props.isNew) return void (publishOnCreate.value = on);
    try {
        emit('updated', await adminApi.patchPress(props.item.id, { updatedAt: props.item.updatedAt, published: on }));
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}

async function remove() {
    try {
        await adminApi.deletePress(props.item.id);
        emit('deleted', props.item.id);
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}
</script>

<template>
    <div class="mb-6" :class="isNew ? 'bg-sky-50/70' : { 'bg-amber-50/60': !item.published }" :data-new="isNew || undefined">
        <div class="admin-ui mb-1 flex flex-wrap items-center gap-2 text-xs">
            <span v-if="isNew" class="rounded bg-sky-100 px-1.5 text-sky-900">New — not saved yet</span>
            <span v-else-if="!item.published" class="rounded bg-amber-100 px-1.5 text-amber-900">Draft</span>
            <div class="w-32">
                <Switch :model-value="isNew ? publishOnCreate : item.published" :label="isNew ? 'Publish on save' : 'Published'" @update:model-value="setPublished" />
            </div>
            <span class="flex-1" />
            <button v-if="isNew" type="button" :class="btnOutline" @click="emit('discarded')">Discard</button>
            <button v-else type="button" :class="btnDanger" @click="confirmDelete = true">Delete</button>
            <button type="button" :class="btnPrimary" :disabled="(!isNew && !dirty) || saving" @click="save()">Save</button>
        </div>
        <h3 class="text-lg italic"><InlineText v-model="form.outlet" placeholder="Publication" /></h3>
        <h3 class="text-lg font-medium text-sky-900"><InlineText v-model="form.title" placeholder="Article title" /></h3>
        <h4 class="italic">
            <template v-if="form.issueLabel"><InlineText v-model="form.issueLabel" placeholder="Issue" /></template>
            <DatePicker v-else v-model="form.publishedOn" />
        </h4>
        <p><InlineText v-model="form.byline" placeholder="by … (optional)" /></p>
        <div class="admin-ui mt-1 flex flex-wrap items-center gap-2 text-xs">
            <button type="button" class="text-sky-800 underline" @click="linkOpen = true">Link & details</button>
            <select v-model="form.exhibitionId" class="max-w-56 rounded border border-slate-300 px-1 py-0.5" aria-label="About exhibition">
                <option :value="null">Not linked to an exhibition</option>
                <option v-for="e in exhibitions" :key="e.id" :value="e.id">{{ e.title }}</option>
            </select>
        </div>
        <Dialog v-model:open="linkOpen" title="Press item details">
            <Field v-model="form.url" label="Article link" type="url" />
            <Field v-model="form.issueLabel" label="Issue label (journals)" hint="Shown instead of the date, e.g. “Volume 8, Number 1 Spring 2025”." />
            <p class="py-1.5 text-xs text-slate-600">Date (used for ordering): {{ formatDate(form.publishedOn) }} — <DatePicker v-model="form.publishedOn" display="change" /></p>
            <template #footer>
                <button type="button" :class="btnPrimary" @click="linkOpen = false">Done</button>
            </template>
        </Dialog>
        <Dialog v-model:open="confirmDelete" title="Delete this press item?" description="It can be restored from History.">
            <template #footer>
                <button type="button" :class="btnOutline" @click="confirmDelete = false">Cancel</button>
                <button type="button" :class="btnDanger" class="!bg-red-700 !text-white" @click="remove">Delete</button>
            </template>
        </Dialog>
    </div>
</template>
