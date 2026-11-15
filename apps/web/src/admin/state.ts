import { reactive, ref, shallowReactive, onBeforeUnmount, watch, type Ref } from 'vue';
import type { RevisionEntityName } from '@twelveten/shared';

/** What the admin bar can do for the page currently on screen. */
export interface PageEditor {
    label: Ref<string> | string;
    dirty: Ref<boolean>;
    save: () => Promise<void>;
    discard?: () => void;
    published?: Ref<boolean | null>;
    setPublished?: (on: boolean) => Promise<void>;
    history?: { entity: RevisionEntityName; id: string | null };
    onRestored?: () => Promise<void> | void;
    openSettings?: () => void;
    remove?: () => Promise<void>;
}

const EDITING_KEY = 'tt-editing';
function storedEditing(): boolean {
    try {
        return sessionStorage.getItem(EDITING_KEY) === '1';
    } catch {
        return false;
    }
}

export const editMode = shallowReactive<{ editing: boolean; saving: boolean; page: PageEditor | null; request: 'new-news' | 'new-press' | null }>({
    // Edit mode survives reloads within the browser tab.
    editing: storedEditing(),
    saving: false,
    page: null,
    /** One-off actions handed to the page that owns them (e.g. "new news post" on /news). */
    request: null,
});

watch(
    () => editMode.editing,
    (on) => {
        try {
            if (on) sessionStorage.setItem(EDITING_KEY, '1');
            else sessionStorage.removeItem(EDITING_KEY);
        } catch {
            // storage unavailable
        }
    },
);

/** Register the current page's editing handlers with the admin bar. */
export function useEditablePage(editor: PageEditor) {
    editMode.page = editor;
    onBeforeUnmount(() => {
        if (editMode.page === editor) editMode.page = null;
    });
    return editor;
}

export interface Toast {
    id: number;
    kind: 'info' | 'error' | 'success';
    message: string;
}
export const toasts = ref<Toast[]>([]);
let toastId = 0;
export function toast(message: string, kind: Toast['kind'] = 'info', ms = 4000) {
    const id = ++toastId;
    toasts.value.push({ id, kind, message });
    setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), ms);
}

/** Conflict dialog: resolved with 'reload' or 'overwrite'. */
export const conflict = reactive<{ open: boolean; resolve: ((choice: 'reload' | 'overwrite') => void) | null }>({ open: false, resolve: null });
export function askConflict(): Promise<'reload' | 'overwrite'> {
    return new Promise((resolve) => {
        conflict.open = true;
        conflict.resolve = (choice) => {
            conflict.open = false;
            resolve(choice);
        };
    });
}

/** Deep-clone plain JSON data (drafts are edited copies of API objects). */
export function clone<T>(v: T): T {
    return JSON.parse(JSON.stringify(v)) as T;
}

/** Keys whose values differ between `a` and `b` (JSON comparison). */
export function changedKeys<T extends object>(a: T, b: T, keys: (keyof T)[]): (keyof T)[] {
    return keys.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}

/** Warn before leaving the page with unsaved edits. */
export function useUnsavedGuard(dirty: Ref<boolean>) {
    const handler = (e: BeforeUnloadEvent) => {
        if (dirty.value) e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    onBeforeUnmount(() => window.removeEventListener('beforeunload', handler));
}
