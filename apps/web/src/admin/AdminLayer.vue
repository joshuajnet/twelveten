<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, unref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuSeparator, DropdownMenuTrigger } from 'reka-ui';
import type { ExhibitionKind } from '@twelveten/shared';
import './admin.css';
import Toasts from './ui/Toasts.vue';
import Dialog from './ui/Dialog.vue';
import Switch from './ui/Switch.vue';
import HistoryDialog from './HistoryDialog.vue';
import NewPageDialog from './NewPageDialog.vue';
import DeletedDialog from './DeletedDialog.vue';
import { adminApi, errorMessage, signOut } from './api';
import { conflict, editMode, toast } from './state';
import { session, setHint } from '@/session';
import { resetInfiniteList } from '@/composables/useInfiniteList';
import { btnDanger, btnGhost, btnOutline, btnPrimary } from './ui/buttons';

/** Admin bar and global editing dialogs. Loaded only for signed-in admins. */
const router = useRouter();
const page = computed(() => editMode.page);
const dirty = computed(() => Boolean(page.value && unref(page.value.dirty)));
const published = computed(() => (page.value?.published ? unref(page.value.published) : null));
const label = computed(() => (page.value ? unref(page.value.label) : ''));

const historyOpen = ref(false);
const newKind = ref<ExhibitionKind | null>(null);
const confirmDelete = ref(false);
const deletedOpen = ref(false);

async function save() {
    if (!page.value || !dirty.value || editMode.saving) return;
    editMode.saving = true;
    try {
        await page.value.save();
    } finally {
        editMode.saving = false;
    }
}

function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && editMode.editing) {
        e.preventDefault();
        void save();
    }
}

// The body class drives edit affordances and makes room for the bar.
watch(
    () => editMode.editing,
    (on) => document.body.classList.toggle('tt-editing', on),
    { immediate: true },
);
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKey);
    document.body.classList.remove('tt-editing');
});

// Don't lose edits when navigating inside the app.
const removeGuard = router.beforeEach(() => {
    if (dirty.value) return window.confirm('You have unsaved changes. Leave without saving?');
    return true;
});
onBeforeUnmount(removeGuard);

function toggleEditing(on: boolean) {
    if (!on && dirty.value && !window.confirm('Stop editing without saving? Your changes will be discarded.')) return;
    if (!on) page.value?.discard?.();
    editMode.editing = on;
    // Lists cache their items; reload them so drafts appear/disappear correctly.
    resetInfiniteList('news');
    resetInfiniteList('press');
}

async function newsOrPress(kind: 'new-news' | 'new-press') {
    editMode.editing = true;
    editMode.request = kind;
    if (router.currentRoute.value.path !== '/news') await router.push('/news');
}

async function rebuild() {
    try {
        const { pages } = await adminApi.rebuild();
        toast(`Re-published ${pages} pages`, 'success');
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}

async function logout() {
    if (dirty.value && !window.confirm('Sign out without saving?')) return;
    await signOut().catch(() => {});
    setHint(false);
    session.user = null;
    editMode.editing = false;
    resetInfiniteList('news');
    resetInfiniteList('press');
    await router.push('/');
}

async function onRestored() {
    await page.value?.onRestored?.();
}

async function doDelete() {
    confirmDelete.value = false;
    try {
        await page.value?.remove?.();
    } catch (e) {
        toast(errorMessage(e), 'error');
    }
}

const isDraft = computed(() => published.value === false);
function closeNew(o: boolean) {
    if (!o) newKind.value = null;
}
function closeConflict(o: boolean) {
    if (!o) conflict.resolve?.('reload');
}

const menuItem = 'cursor-pointer rounded px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-slate-100';
const menuContent = 'admin-ui z-[85] min-w-48 rounded-md border border-slate-200 bg-white p-1 shadow-lg';
const iconButton = `${btnOutline} h-8 w-8 justify-center px-0!`;
</script>

<template>
    <div class="admin-ui">
        <header
            v-if="editMode.editing"
            class="fixed inset-x-0 top-0 z-[80] flex h-11 items-center gap-2 overflow-x-auto whitespace-nowrap border-b border-slate-200 bg-white/95 px-3 text-sm shadow-sm backdrop-blur"
            style="padding-top: env(safe-area-inset-top, 0px)"
            role="toolbar"
            aria-label="Editing"
        >
            <span class="hidden font-semibold text-sky-900 sm:inline">Editing</span>
            <span v-if="label" class="truncate text-slate-600">{{ label }}</span>
            <span v-if="isDraft" class="rounded bg-amber-100 px-1.5 text-xs text-amber-900">Draft</span>
            <span v-if="dirty" class="text-xs text-amber-700">● Unsaved changes</span>
            <span class="flex-1" />
            <template v-if="page">
                <div v-if="page.setPublished && published !== null" class="w-36">
                    <Switch :model-value="published" label="Published" @update:model-value="(v) => page!.setPublished!(v)" />
                </div>
                <button v-if="page.openSettings" type="button" :class="btnGhost" @click="page.openSettings()">Settings</button>
                <button v-if="page.history" type="button" :class="btnGhost" @click="historyOpen = true">History</button>
                <button v-if="dirty && page.discard" type="button" :class="btnGhost" @click="page.discard()">Discard</button>
                <button type="button" :class="btnPrimary" :disabled="!dirty || editMode.saving" title="Save (Ctrl+S)" @click="save">
                    {{ editMode.saving ? 'Saving…' : 'Save' }}
                </button>
            </template>
            <DropdownMenuRoot>
                <DropdownMenuTrigger :class="iconButton" aria-label="Create new" title="Create new">
                    <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                </DropdownMenuTrigger>
                <DropdownMenuPortal>
                    <DropdownMenuContent :class="menuContent" align="end" :side-offset="4">
                        <DropdownMenuItem :class="menuItem" @select="newKind = 'exhibition'">New exhibition</DropdownMenuItem>
                        <DropdownMenuItem :class="menuItem" @select="newKind = 'fair'">New fair</DropdownMenuItem>
                        <DropdownMenuItem :class="menuItem" @select="newsOrPress('new-news')">New news post</DropdownMenuItem>
                        <DropdownMenuItem :class="menuItem" @select="newsOrPress('new-press')">New press item</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenuPortal>
            </DropdownMenuRoot>
            <DropdownMenuRoot>
                <DropdownMenuTrigger :class="iconButton" aria-label="More options" title="More options">
                    <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path
                            d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
                        />
                        <circle cx="12" cy="12" r="3" />
                    </svg>
                </DropdownMenuTrigger>
                <DropdownMenuPortal>
                    <DropdownMenuContent :class="menuContent" align="end" :side-offset="4">
                        <DropdownMenuItem v-if="page?.remove" :class="[menuItem, 'text-red-700']" @select="confirmDelete = true">Delete this page…</DropdownMenuItem>
                        <DropdownMenuItem :class="menuItem" @select="deletedOpen = true">Recently deleted…</DropdownMenuItem>
                        <DropdownMenuItem :class="menuItem" @select="rebuild">Re-publish all pages</DropdownMenuItem>
                        <DropdownMenuSeparator class="my-1 h-px bg-slate-100" />
                        <DropdownMenuItem :class="menuItem" @select="toggleEditing(false)">Stop editing</DropdownMenuItem>
                        <DropdownMenuItem :class="menuItem" @select="logout">Sign out</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenuPortal>
            </DropdownMenuRoot>
        </header>

        <button
            v-if="!editMode.editing"
            type="button"
            class="fixed left-0 top-1/2 z-[80] flex h-9 w-9 -translate-y-1/2 items-center justify-center bg-sky-900 text-white shadow-lg hover:bg-sky-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-900"
            aria-label="Edit site"
            title="Edit site"
            @click="toggleEditing(true)"
        >
            <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
        </button>

        <HistoryDialog v-if="page?.history" v-model:open="historyOpen" :entity="page.history.entity" :id="page.history.id" @restored="onRestored" />
        <DeletedDialog v-model:open="deletedOpen" />
        <NewPageDialog :open="newKind !== null" :kind="newKind ?? 'exhibition'" @update:open="closeNew" />

        <Dialog :open="conflict.open" title="Someone else changed this" description="Another save happened since you opened this page." @update:open="closeConflict">
            <p class="text-sm">Reload to see their version (your unsaved edits are dropped), or overwrite it with yours.</p>
            <template #footer>
                <button type="button" :class="btnOutline" @click="conflict.resolve?.('reload')">Reload theirs</button>
                <button type="button" :class="btnDanger" @click="conflict.resolve?.('overwrite')">Overwrite with mine</button>
            </template>
        </Dialog>

        <Dialog v-model:open="confirmDelete" title="Delete this page?" description="It disappears from the site. It can be restored from History.">
            <template #footer>
                <button type="button" :class="btnOutline" @click="confirmDelete = false">Cancel</button>
                <button type="button" :class="btnDanger" class="!bg-red-700 !text-white" @click="doDelete">Delete</button>
            </template>
        </Dialog>

        <Toasts />
    </div>
</template>
