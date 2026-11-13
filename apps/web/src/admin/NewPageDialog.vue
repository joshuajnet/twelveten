<script setup lang="ts">
import { reactive, watch } from 'vue';
import { useRouter } from 'vue-router';
import { exhibitionPath, todayIso, type ExhibitionKind } from '@twelveten/shared';
import Dialog from './ui/Dialog.vue';
import Field from './ui/Field.vue';
import DateRangePicker from './DateRangePicker.vue';
import { adminApi, errorMessage } from './api';
import { editMode, toast } from './state';
import { btnOutline, btnPrimary } from './ui/buttons';

const props = defineProps<{ kind: ExhibitionKind }>();
const open = defineModel<boolean>('open', { required: true });
const router = useRouter();

const plusDays = (iso: string, days: number) => new Date(new Date(`${iso}T12:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
const form = reactive({ title: '' as string | null, artists: '' as string | null, startsOn: todayIso(), endsOn: plusDays(todayIso(), 42), busy: false });
watch(open, (o) => o && Object.assign(form, { title: '', artists: '', startsOn: todayIso(), endsOn: plusDays(todayIso(), props.kind === 'fair' ? 4 : 42) }));

async function create() {
    if (!form.title) return;
    form.busy = true;
    try {
        const e = await adminApi.createExhibition({ kind: props.kind, title: form.title, artists: form.artists ?? '', startsOn: form.startsOn, endsOn: form.endsOn });
        open.value = false;
        editMode.editing = true;
        await router.push(exhibitionPath(e));
        toast('Draft created — it stays hidden until you publish it', 'success');
    } catch (e) {
        toast(errorMessage(e), 'error');
    } finally {
        form.busy = false;
    }
}
</script>

<template>
    <Dialog v-model:open="open" :title="kind === 'fair' ? 'New fair' : 'New exhibition'" description="Starts as an unpublished draft using the standard page template.">
        <Field v-model="form.title" label="Title" />
        <Field v-model="form.artists" label="Artists (one per line)" multiline />
        <div class="py-1.5 text-sm">
            <span class="block text-xs font-medium text-slate-600">Dates</span>
            <DateRangePicker v-model:start="form.startsOn" v-model:end="form.endsOn" />
        </div>
        <template #footer>
            <button type="button" :class="btnOutline" @click="open = false">Cancel</button>
            <button type="button" :class="btnPrimary" :disabled="!form.title || form.busy" @click="create">Create draft</button>
        </template>
    </Dialog>
</template>
