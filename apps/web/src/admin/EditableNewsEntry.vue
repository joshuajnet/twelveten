<script setup lang="ts">
import { computed, ref } from 'vue';
import { formatDate, todayIso, zonedToIso, type NewsPost } from '@twelveten/shared';
import { htmlToRichBrowser, type RichDoc } from '@twelveten/shared/rich';
import InlineText from './InlineText.vue';
import RichEditor from './RichEditor.vue';
import DatePicker from './DatePicker.vue';
import Switch from './ui/Switch.vue';
import Dialog from './ui/Dialog.vue';
import HistoryDialog from './HistoryDialog.vue';
import { adminApi, conflictCurrent, errorMessage } from './api';
import { askConflict, toast, useUnsavedGuard } from './state';
import { btnDanger, btnGhost, btnOutline, btnPrimary } from './ui/buttons';

/** A news post edited in place: title, date and body; saved on its own. */
const props = defineProps<{ post: NewsPost }>();
const emit = defineEmits<{ updated: [NewsPost]; deleted: [string] }>();

const title = ref<string | null>(props.post.title);
const day = ref(todayIso(undefined, new Date(props.post.publishedAt)));
const doc = ref<RichDoc>(htmlToRichBrowser(props.post.bodyHtml || '<p></p>', { news: true }));
const html = ref(props.post.bodyHtml);
const bodyTouched = ref(false);
const saving = ref(false);
const confirmDelete = ref(false);
const historyOpen = ref(false);

const originalDay = computed(() => todayIso(undefined, new Date(props.post.publishedAt)));
const dirty = computed(() => title.value !== props.post.title || day.value !== originalDay.value || bodyTouched.value);
useUnsavedGuard(dirty);

function onBody(v: string | undefined) {
    html.value = v ?? '';
    bodyTouched.value = true;
}

async function save(version = props.post.updatedAt): Promise<void> {
    if (!title.value) return void toast('A post needs a title', 'error');
    saving.value = true;
    try {
        const updated = await adminApi.patchNews(props.post.id, {
            updatedAt: version,
            title: title.value,
            ...(day.value !== originalDay.value ? { publishedAt: zonedToIso(`${day.value} 12:00`) } : {}),
            ...(bodyTouched.value ? { bodyHtml: html.value } : {}),
        });
        bodyTouched.value = false;
        emit('updated', updated);
        toast('Post saved', 'success', 1500);
    } catch (e) {
        const current = conflictCurrent<NewsPost>(e);
        if (current) {
            if ((await askConflict()) === 'overwrite') return save(current.updatedAt);
            emit('updated', current);
        } else toast(errorMessage(e), 'error');
    } finally {
        saving.value = false;
    }
}

async function setPublished(on: boolean) {
    try {
        emit('updated', await adminApi.patchNews(props.post.id, { updatedAt: props.post.updatedAt, published: on }));
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}

async function remove() {
    try {
        await adminApi.deleteNews(props.post.id);
        emit('deleted', props.post.id);
        toast('Post deleted', 'success', 1500);
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}
</script>

<template>
    <div class="border-t py-3" :class="{ 'bg-amber-50/60': !post.published }">
        <div class="admin-ui mb-2 flex flex-wrap items-center gap-2 text-xs">
            <span v-if="!post.published" class="rounded bg-amber-100 px-1.5 text-amber-900">Draft</span>
            <div class="w-32"><Switch :model-value="post.published" label="Published" @update:model-value="setPublished" /></div>
            <span class="flex-1" />
            <button type="button" :class="btnGhost" @click="historyOpen = true">History</button>
            <button type="button" :class="btnDanger" @click="confirmDelete = true">Delete</button>
            <button type="button" :class="btnPrimary" :disabled="!dirty || saving" @click="save()">{{ saving ? 'Saving…' : 'Save post' }}</button>
        </div>
        <h3 class="text-lg font-medium text-sky-900"><InlineText v-model="title" placeholder="Title" /></h3>
        <h4 class="mb-3 italic"><DatePicker v-model="day" :display="formatDate(day)" /></h4>
        <RichEditor v-model="doc" news placeholder="Write the post…" @update:html="onBody" />
        <Dialog v-model:open="confirmDelete" title="Delete this post?" description="It can be restored from History.">
            <template #footer>
                <button type="button" :class="btnOutline" @click="confirmDelete = false">Cancel</button>
                <button type="button" :class="btnDanger" class="!bg-red-700 !text-white" @click="remove">Delete</button>
            </template>
        </Dialog>
        <HistoryDialog v-model:open="historyOpen" entity="news_post" :id="post.id" @restored="emit('deleted', '__reload__')" />
    </div>
</template>
