<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { INQUIRY_NOTE_MAX, type InquiryItem } from '@twelveten/shared';
import { api, ApiError } from '@/api/client';
import { useVisitor } from '@/composables/useVisitor';
import ArtImage from './ArtImage.vue';

/**
 * Inquire about a work or an exhibition. Known visitors (room gate or an earlier inquiry) only write
 * a note; others give their name and email too. The gallery sees it on their collector profile.
 */
export type InquiryTarget =
    | { kind: 'slide'; artworkId: string }
    | { kind: 'exhibition'; exhibitionId: string }
    | { kind: 'room'; token: string; workId: string; viewerName: string | null };

const props = defineProps<{ item: InquiryItem | null; target: InquiryTarget | null; preview?: boolean }>();
const open = defineModel<boolean>('open', { default: false });

const dialog = ref<HTMLDialogElement>();
const noteEl = ref<HTMLTextAreaElement>();
const visitor = useVisitor();
const form = ref({ name: '', email: '', note: '', website: '' });
const state = ref<'form' | 'sending' | 'sent'>('form');
const error = ref('');
const fieldErrors = ref<Record<string, string>>({});

const inRoom = computed(() => props.target?.kind === 'room');
/** Who they are, when we already know. */
const knownName = computed(() => (props.target?.kind === 'room' ? props.target.viewerName : visitor.name.value));
const askIdentity = computed(() => !inRoom.value && !knownName.value);
const remaining = computed(() => INQUIRY_NOTE_MAX - form.value.note.length);

watch(open, async (o) => {
    if (o) {
        state.value = 'form';
        error.value = '';
        fieldErrors.value = {};
        form.value.note = '';
        if (!inRoom.value) await visitor.load();
        dialog.value?.showModal();
        await nextTick();
        (askIdentity.value ? dialog.value?.querySelector<HTMLInputElement>('input[name=name]') : noteEl.value)?.focus();
    } else if (dialog.value?.open) dialog.value.close();
});

async function notYou() {
    await visitor.forget();
    await nextTick();
    dialog.value?.querySelector<HTMLInputElement>('input[name=name]')?.focus();
}

async function submit() {
    if (!props.target) return;
    if (props.preview) return void (error.value = 'This is a preview: inquiries aren’t sent.');
    error.value = '';
    fieldErrors.value = {};
    state.value = 'sending';
    try {
        const t = props.target;
        if (t.kind === 'room') await api.roomInquire(t.token, { workId: t.workId, note: form.value.note });
        else {
            const r = await api.inquire({
                item: t.kind === 'slide' ? { kind: 'slide', artworkId: t.artworkId } : { kind: 'exhibition', exhibitionId: t.exhibitionId },
                note: form.value.note,
                ...(askIdentity.value ? { name: form.value.name, email: form.value.email } : {}),
                pageUrl: location.pathname,
                website: form.value.website || undefined,
            });
            visitor.set(r.name);
        }
        state.value = 'sent';
    } catch (e) {
        state.value = 'form';
        if (e instanceof ApiError && e.status === 400 && Array.isArray(e.details)) {
            fieldErrors.value = Object.fromEntries((e.details as { path: string; message: string }[]).map((d) => [d.path, d.message]));
            error.value = fieldErrors.value.note ?? (Object.keys(fieldErrors.value).length ? '' : e.message);
        } else if (e instanceof ApiError && e.status === 429) error.value = 'Too many inquiries just now. Please try again in a few minutes.';
        else if (e instanceof ApiError && (e.status === 400 || e.status === 404)) error.value = e.message === 'Not found' ? 'This item is no longer available.' : e.message;
        else error.value = 'Something went wrong. Please try again.';
    }
}

const caption = computed(() => {
    const i = props.item;
    if (!i) return '';
    return [i.artist, [i.title, i.date].filter(Boolean).join(', ')].filter(Boolean).join(' — ');
});
</script>

<template>
    <dialog
        ref="dialog"
        class="inquiry-dialog m-auto w-[calc(100vw-2rem)] max-w-lg bg-white p-0 font-gentium-book text-slate-900 shadow-xl backdrop:bg-black/40"
        aria-labelledby="inquiry-title"
        data-testid="inquiry-dialog"
        @close="open = false"
        @cancel="open = false"
    >
        <div class="max-h-[90vh] overflow-y-auto p-5 sm:p-6">
            <div class="mb-4 flex items-start justify-between gap-4">
                <h2 id="inquiry-title" class="text-2xl">Inquire</h2>
                <button type="button" class="-mr-2 -mt-1 px-2 text-2xl leading-none text-slate-400 hover:text-sky-900" aria-label="Close" @click="open = false">×</button>
            </div>

            <div v-if="item" class="mb-5 flex gap-3 border-y border-zinc-100 py-3" data-testid="inquiry-item">
                <div v-if="item.image" class="flex h-20 w-20 shrink-0 items-center justify-center bg-slate-50">
                    <ArtImage :src="item.image" alt="" sizes="80px" class="max-h-full max-w-full object-contain" />
                </div>
                <div class="min-w-0 text-sm leading-snug">
                    <div v-if="item.artist">{{ item.artist }}</div>
                    <div><span class="italic">{{ item.title }}</span><span v-if="item.date">, {{ item.date }}</span></div>
                    <div v-if="item.medium" class="text-slate-600">{{ item.medium }}</div>
                    <div v-if="item.dimensions" class="text-slate-600">{{ item.dimensions }}</div>
                    <div v-if="item.price" class="mt-0.5">{{ item.price }}</div>
                    <div v-if="item.context" class="mt-0.5 font-roboto text-xs font-light text-slate-500">{{ item.context }}</div>
                </div>
            </div>

            <div v-if="state === 'sent'" role="status" class="py-6 text-center" data-testid="inquiry-sent">
                <p class="mb-2 text-xl">Thank you{{ knownName ? `, ${knownName.split(' ')[0]}` : '' }}.</p>
                <p class="text-slate-600">We’ve received your inquiry and will be in touch.</p>
                <button type="button" class="mt-5 border border-sky-900 px-4 py-2 font-roboto font-light text-sky-900 hover:bg-sky-50" @click="open = false">Close</button>
            </div>

            <form v-else novalidate @submit.prevent="submit">
                <p v-if="!askIdentity" class="mb-4 font-roboto text-sm font-light text-slate-600" data-testid="inquiry-known">
                    Inquiring as <strong class="font-normal text-slate-900">{{ knownName }}</strong>
                    <template v-if="!inRoom">
                        · <button type="button" class="text-sky-900 underline hover:text-slate-900" @click="notYou">Not you?</button>
                    </template>
                </p>
                <template v-else>
                    <label class="mb-3 block">
                        <span class="mb-1 block font-roboto text-sm font-light text-slate-600">Name</span>
                        <input v-model="form.name" name="name" type="text" autocomplete="name" required maxlength="200" class="inq-input" :aria-invalid="Boolean(fieldErrors.name)" />
                        <span v-if="fieldErrors.name" class="mt-1 block font-roboto text-xs text-red-700">{{ fieldErrors.name }}</span>
                    </label>
                    <label class="mb-3 block">
                        <span class="mb-1 block font-roboto text-sm font-light text-slate-600">Email</span>
                        <input v-model="form.email" name="email" type="email" autocomplete="email" inputmode="email" required class="inq-input" :aria-invalid="Boolean(fieldErrors.email)" />
                        <span v-if="fieldErrors.email" class="mt-1 block font-roboto text-xs text-red-700">{{ fieldErrors.email }}</span>
                    </label>
                </template>
                <label class="block">
                    <span class="mb-1 block font-roboto text-sm font-light text-slate-600">Note <span class="text-slate-400">(optional)</span></span>
                    <textarea ref="noteEl" v-model="form.note" name="note" rows="4" :maxlength="INQUIRY_NOTE_MAX" class="inq-input resize-y" placeholder="Add a message (optional)" />
                    <span class="mt-0.5 block text-right font-roboto text-xs font-light tabular-nums text-slate-400" aria-live="polite">{{ remaining }} characters left</span>
                </label>
                <!-- Honeypot: hidden from people and screen readers. -->
                <div class="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
                    <label>Website <input v-model="form.website" name="website" type="text" tabindex="-1" autocomplete="off" /></label>
                </div>
                <p v-if="error" class="mt-2 font-roboto text-sm text-red-700" role="alert">{{ error }}</p>
                <p v-if="askIdentity" class="mt-3 font-roboto text-xs font-light text-slate-500">The gallery will reply by email. We’ll remember you in this browser for future inquiries.</p>
                <div class="mt-4 flex justify-end gap-2 font-roboto font-light">
                    <button type="button" class="px-4 py-2 text-slate-600 hover:text-sky-900" @click="open = false">Cancel</button>
                    <button type="submit" class="border border-sky-900 bg-sky-900 px-4 py-2 text-white hover:bg-sky-800 disabled:opacity-50" :disabled="state === 'sending' || !target">
                        {{ state === 'sending' ? 'Sending…' : 'Send inquiry' }}
                    </button>
                </div>
            </form>
        </div>
    </dialog>
</template>

<style scoped>
@reference "@/style.css";
.inq-input {
    @apply w-full border border-slate-300 bg-white px-3 py-2 font-roboto font-light text-slate-900 outline-none transition-colors focus:border-sky-900 focus:ring-1 focus:ring-sky-900;
}
</style>
