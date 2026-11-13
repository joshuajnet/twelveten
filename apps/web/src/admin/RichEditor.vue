<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { EditorContent, useEditor } from '@tiptap/vue-3';
import { BubbleMenu } from '@tiptap/vue-3/menus';
import { Placeholder } from '@tiptap/extensions';
import { richExtensions, type ParagraphVariant, type RichDoc } from '@twelveten/shared/rich';
import Dialog from './ui/Dialog.vue';
import Field from './ui/Field.vue';
import { btnGhost, btnOutline, btnPrimary } from './ui/buttons';
import { pickFiles, uploadFile } from './upload';
import { errorMessage } from './api';
import { toast } from './state';

/**
 * WYSIWYG editor for exhibition bodies (and news posts in `news` mode). It renders with the
 * same schema and classes as the public page, so what you see while editing is what publishes.
 */
const props = defineProps<{ news?: boolean; placeholder?: string }>();
const doc = defineModel<RichDoc>({ required: true });
const html = defineModel<string>('html');

const editor = useEditor({
    extensions: [...richExtensions({ news: props.news }), Placeholder.configure({ placeholder: props.placeholder ?? 'Write here…' })],
    content: doc.value,
    editorProps: { attributes: { class: 'rich-content' } },
    onUpdate: ({ editor: e }) => {
        doc.value = e.getJSON() as RichDoc;
        if (html.value !== undefined) html.value = e.getHTML();
    },
});

// Replace the content when the document changes from outside (reload, restore).
watch(doc, (next) => {
    const e = editor.value;
    if (e && JSON.stringify(e.getJSON()) !== JSON.stringify(next)) e.commands.setContent(next, { emitUpdate: false });
});

onBeforeUnmount(() => editor.value?.destroy());

const variant = computed<ParagraphVariant>(() => (editor.value?.getAttributes('paragraph').variant as ParagraphVariant) ?? 'default');
const setVariant = (v: ParagraphVariant) => editor.value?.chain().focus().updateAttributes('paragraph', { variant: v }).run();

// ---- Links ----
const linkDialog = reactive({ open: false, href: '' as string | null });
function openLink() {
    linkDialog.href = (editor.value?.getAttributes('link').href as string | undefined) ?? '';
    linkDialog.open = true;
}
function applyLink() {
    const href = (linkDialog.href ?? '').trim();
    const chain = editor.value?.chain().focus().extendMarkRange('link');
    if (!href) chain?.unsetLink().run();
    else chain?.setLink({ href: /^(https?:|mailto:|\/)/i.test(href) ? href : `https://${href}` }).run();
    linkDialog.open = false;
}

// ---- Images (figure) ----
const figureDialog = reactive({ open: false, src: '', alt: '' as string | null, caption: '' as string | null, editing: false });
const uploading = ref<number | null>(null);
async function insertImage() {
    const [file] = await pickFiles('image');
    if (!file) return;
    try {
        uploading.value = 0;
        const src = await uploadFile(file, (f) => (uploading.value = f));
        Object.assign(figureDialog, { open: true, src, alt: '', caption: '', editing: false });
    } catch (e) {
        toast(errorMessage(e), 'error');
    } finally {
        uploading.value = null;
    }
}
const selectedFigure = computed(() => editor.value?.isActive('figure') ?? false);
function editFigure() {
    const a = editor.value?.getAttributes('figure') ?? {};
    Object.assign(figureDialog, { open: true, src: a.src ?? '', alt: a.alt ?? '', caption: a.caption ?? '', editing: true });
}
function applyFigure() {
    const attrs = { src: figureDialog.src, alt: figureDialog.alt ?? '', caption: figureDialog.caption ?? '' };
    const chain = editor.value?.chain().focus();
    if (figureDialog.editing) chain?.updateAttributes('figure', attrs).run();
    else chain?.insertContent({ type: 'figure', attrs }).run();
    figureDialog.open = false;
}

// ---- Video ----
const videoDialog = reactive({ open: false, url: '' as string | null });
function youtubeId(input: string): string | null {
    const s = input.trim();
    if (/^[A-Za-z0-9_-]{6,20}$/.test(s)) return s;
    const m = /(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{6,20})/.exec(s);
    return m?.[1] ?? null;
}
function applyVideo() {
    const id = youtubeId(videoDialog.url ?? '');
    if (!id) return toast('That doesn’t look like a YouTube link', 'error');
    editor.value?.chain().focus().insertContent({ type: 'video', attrs: { youtubeId: id } }).run();
    videoDialog.open = false;
}

function insertBio() {
    editor.value
        ?.chain()
        .focus()
        .insertContent({ type: 'bio', content: [{ type: 'paragraph', attrs: { variant: 'italic' } }] })
        .run();
}
function insertPressList() {
    editor.value?.chain().focus().insertContent({ type: 'pressList' }).run();
}

const tb = (active: boolean) => [btnGhost, '!px-2 !py-0.5', active ? '!bg-slate-200' : ''];
</script>

<template>
    <div class="tt-rich relative">
        <div
            v-if="editor"
            class="admin-ui sticky top-12 z-30 mb-3 flex flex-wrap items-center gap-0.5 rounded border border-slate-200 bg-white/95 p-1 text-xs shadow-sm backdrop-blur"
            role="toolbar"
            aria-label="Formatting"
        >
            <button type="button" :class="tb(editor.isActive('bold'))" title="Bold (Ctrl+B)" @click="editor.chain().focus().toggleBold().run()"><b>B</b></button>
            <button type="button" :class="tb(editor.isActive('italic'))" title="Italic (Ctrl+I)" @click="editor.chain().focus().toggleItalic().run()"><i>I</i></button>
            <button type="button" :class="tb(editor.isActive('link'))" title="Link" @click="openLink">Link</button>
            <span class="mx-1 h-4 w-px bg-slate-200" />
            <select
                class="rounded border border-slate-200 bg-white px-1 py-0.5"
                :value="variant"
                aria-label="Paragraph style"
                @change="setVariant(($event.target as HTMLSelectElement).value as ParagraphVariant)"
            >
                <option value="default">Normal</option>
                <option value="italic">Italic</option>
                <option value="lead">Large italic</option>
            </select>
            <button type="button" :class="tb(editor.isActive('bulletList'))" @click="editor.chain().focus().toggleBulletList().run()">• List</button>
            <button type="button" :class="tb(editor.isActive('orderedList'))" @click="editor.chain().focus().toggleOrderedList().run()">1. List</button>
            <span class="mx-1 h-4 w-px bg-slate-200" />
            <button type="button" :class="tb(false)" :disabled="uploading !== null" @click="insertImage">
                {{ uploading !== null ? `Uploading ${Math.round(uploading * 100)}%` : '+ Image' }}
            </button>
            <button v-if="selectedFigure" type="button" :class="tb(false)" @click="editFigure">Edit image</button>
            <template v-if="!news">
                <button type="button" :class="tb(false)" @click="Object.assign(videoDialog, { open: true, url: '' })">+ Video</button>
                <button type="button" :class="tb(false)" @click="insertBio">+ Bio</button>
                <button type="button" :class="tb(false)" @click="insertPressList">+ Press list</button>
            </template>
            <span class="mx-1 h-4 w-px bg-slate-200" />
            <button type="button" :class="tb(false)" title="Undo (Ctrl+Z)" :disabled="!editor.can().undo()" @click="editor.chain().focus().undo().run()">↶</button>
            <button type="button" :class="tb(false)" title="Redo (Ctrl+Shift+Z)" :disabled="!editor.can().redo()" @click="editor.chain().focus().redo().run()">↷</button>
        </div>

        <BubbleMenu v-if="editor" :editor="editor" :should-show="({ editor: e, from, to }) => from !== to && !e.isActive('figure')">
            <div class="admin-ui flex gap-0.5 rounded bg-slate-900 p-1 text-xs text-white shadow-lg">
                <button type="button" class="rounded px-2 py-0.5 hover:bg-slate-700" @click="editor.chain().focus().toggleBold().run()"><b>B</b></button>
                <button type="button" class="rounded px-2 py-0.5 hover:bg-slate-700" @click="editor.chain().focus().toggleItalic().run()"><i>I</i></button>
                <button type="button" class="rounded px-2 py-0.5 hover:bg-slate-700" @click="openLink">Link</button>
            </div>
        </BubbleMenu>

        <EditorContent :editor="editor" class="tt-editable" />

        <Dialog v-model:open="linkDialog.open" title="Link">
            <Field v-model="linkDialog.href" label="Address" placeholder="https://… or /exhibitions/…" hint="Leave empty to remove the link." />
            <template #footer>
                <button type="button" :class="btnOutline" @click="linkDialog.open = false">Cancel</button>
                <button type="button" :class="btnPrimary" @click="applyLink">Apply</button>
            </template>
        </Dialog>

        <Dialog v-model:open="figureDialog.open" title="Image">
            <img :src="figureDialog.src" alt="" class="mb-3 max-h-48 rounded" />
            <Field v-model="figureDialog.alt" label="Description for screen readers (alt text)" multiline />
            <Field v-model="figureDialog.caption" label="Caption" multiline />
            <template #footer>
                <button type="button" :class="btnOutline" @click="figureDialog.open = false">Cancel</button>
                <button type="button" :class="btnPrimary" :disabled="!figureDialog.alt" @click="applyFigure">
                    {{ figureDialog.editing ? 'Update' : 'Insert' }}
                </button>
            </template>
        </Dialog>

        <Dialog v-model:open="videoDialog.open" title="YouTube video">
            <Field v-model="videoDialog.url" label="YouTube link" placeholder="https://www.youtube.com/watch?v=…" />
            <template #footer>
                <button type="button" :class="btnOutline" @click="videoDialog.open = false">Cancel</button>
                <button type="button" :class="btnPrimary" @click="applyVideo">Insert</button>
            </template>
        </Dialog>
    </div>
</template>
