<script setup lang="ts">
import { ref, watch } from 'vue';
import type { RevisionEntityName, RevisionSummary } from '@twelveten/shared';
import Dialog from './ui/Dialog.vue';
import { adminApi, errorMessage } from './api';
import { toast } from './state';
import { btnOutline } from './ui/buttons';
import { dateTime as fmt } from '@/backoffice/format';

const props = defineProps<{ entity: RevisionEntityName; id: string | null }>();
const emit = defineEmits<{ restored: [] }>();
const open = defineModel<boolean>('open', { required: true });
const items = ref<RevisionSummary[]>([]);
const loading = ref(false);

watch(open, async (o) => {
    if (!o) return;
    loading.value = true;
    try {
        items.value = await adminApi.revisions(props.entity, props.id);
    } catch (e) {
        toast(errorMessage(e), 'error');
    } finally {
        loading.value = false;
    }
});

const ACTION = { create: 'Created', update: 'Saved', delete: 'Deleted', restore: 'Restored' } as const;

async function restore(r: RevisionSummary) {
    try {
        await adminApi.restore(r.id);
        toast(`Restored the version from ${fmt(r.createdAt)}`, 'success');
        open.value = false;
        emit('restored');
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}
</script>

<template>
    <Dialog v-model:open="open" title="History" description="Each save is kept. Restoring creates a new version; nothing is lost.">
        <p v-if="loading" class="text-sm text-slate-500">Loading…</p>
        <p v-else-if="!items.length" class="text-sm text-slate-500">No history yet.</p>
        <ol v-else class="divide-y divide-slate-100 text-sm">
            <li v-for="(r, i) in items" :key="r.id" class="flex items-center justify-between gap-3 py-2">
                <span>
                    <span class="font-medium">{{ ACTION[r.action] }}</span>
                    <span class="text-slate-500"> · {{ fmt(r.createdAt) }}<template v-if="r.userName"> · {{ r.userName }}</template></span>
                    <span v-if="i === 0" class="ml-1 rounded bg-slate-100 px-1 text-xs">current</span>
                </span>
                <button v-if="i > 0 || r.action === 'delete'" type="button" :class="btnOutline" @click="restore(r)">Restore</button>
            </li>
        </ol>
    </Dialog>
</template>
