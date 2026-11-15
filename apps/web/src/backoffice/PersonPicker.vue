<script setup lang="ts">
import { computed, nextTick, reactive, ref, useId, watch } from 'vue';
import { defaultSortName, PROFILE_TYPES, type PersonSummary, type ProfileType } from '@twelveten/shared';
import Dialog from '@/admin/ui/Dialog.vue';
import Field from '@/admin/ui/Field.vue';
import { errorMessage } from '@/admin/api';
import { toast } from '@/admin/state';
import { btnGhost, btnPrimary } from '@/admin/ui/buttons';
import { boApi } from './api';
import Avatar from './Avatar.vue';
import { bornYear } from './format';

/**
 * Look up a person as you type. `profile` ranks people with that profile first (`strict` shows
 * only them). The last option creates a new person from what was typed.
 */
const props = withDefaults(
    defineProps<{
        label: string;
        profile?: ProfileType;
        strict?: boolean;
        /** Start the search with this text (e.g. a slide's artist caption). */
        initialQuery?: string;
        /** People to list first (e.g. the exhibition's artists). */
        preferIds?: string[];
        placeholder?: string;
        allowCreate?: boolean;
    }>(),
    { allowCreate: true, placeholder: 'Search people…' },
);
const emit = defineEmits<{ select: [person: PersonSummary] }>();

const id = useId();
const query = ref(props.initialQuery ?? '');
const open = ref(false);
const results = ref<PersonSummary[]>([]);
const active = ref(0);
const loading = ref(false);
let seq = 0;

async function search() {
    const mine = ++seq;
    loading.value = true;
    try {
        const page = await boApi.persons({ q: query.value.trim(), profile: props.strict ? props.profile : null, limit: 12 });
        if (mine !== seq) return;
        const rank = (p: PersonSummary) => (props.preferIds?.includes(p.id) ? 0 : props.profile && p.profiles.includes(props.profile) ? 1 : 2);
        results.value = [...page.items].sort((a, b) => rank(a) - rank(b));
        active.value = 0;
    } catch (e) {
        toast(errorMessage(e), 'error');
    } finally {
        if (mine === seq) loading.value = false;
    }
}

let timer: ReturnType<typeof setTimeout> | undefined;
watch(query, () => {
    clearTimeout(timer);
    timer = setTimeout(search, 200);
});

const showCreate = computed(() => props.allowCreate && query.value.trim().length > 0);
const optionCount = computed(() => results.value.length + (showCreate.value ? 1 : 0));

function onFocus() {
    open.value = true;
    if (!results.value.length) void search();
}
function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        open.value = true;
        active.value = Math.min(active.value + 1, optionCount.value - 1);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        active.value = Math.max(active.value - 1, 0);
    } else if (e.key === 'Enter' && open.value) {
        e.preventDefault();
        choose(active.value);
    } else if (e.key === 'Escape') {
        open.value = false;
    }
}
function choose(index: number) {
    const person = results.value[index];
    if (person) {
        open.value = false;
        emit('select', person);
    } else if (showCreate.value) {
        openCreate();
    }
}

// Create a new person inline.
const create = reactive({ open: false, name: '' as string | null, sortName: null as string | null, email: null as string | null, busy: false });
function openCreate() {
    open.value = false;
    const name = query.value.trim();
    Object.assign(create, { open: true, name, sortName: name ? defaultSortName(name) : null, email: null, busy: false });
}
async function submitCreate() {
    if (!create.name?.trim()) return;
    create.busy = true;
    try {
        const p = await boApi.createPerson({ name: create.name.trim(), sortName: create.sortName, email: create.email ?? undefined });
        create.open = false;
        emit('select', {
            id: p.id,
            name: p.name,
            sortName: p.sortName,
            birthDate: p.birthDate,
            email: p.email,
            phone: p.phone,
            portrait: p.portrait,
            city: null,
            profiles: p.profiles,
            artist: null,
            collector: null,
        });
    } catch (e) {
        toast(errorMessage(e), 'error');
    } finally {
        create.busy = false;
    }
}

const profileLabel = (key: string) => PROFILE_TYPES.find((p) => p.key === key)?.label ?? key;
const input = ref<HTMLInputElement | null>(null);
defineExpose({ focus: () => nextTick(() => input.value?.focus()) });
</script>

<template>
    <div class="relative" @focusout="(e) => !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node) && (open = false)">
        <label :for="`${id}-input`" class="block text-xs font-medium text-slate-600">{{ label }}</label>
        <input
            :id="`${id}-input`"
            ref="input"
            v-model="query"
            type="text"
            role="combobox"
            autocomplete="off"
            :aria-expanded="open"
            :aria-controls="`${id}-list`"
            :aria-activedescendant="open && optionCount ? `${id}-opt-${active}` : undefined"
            :placeholder="placeholder"
            class="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-sky-700 focus:outline-none"
            @focus="onFocus"
            @keydown="onKey"
        />
        <ul
            v-show="open"
            :id="`${id}-list`"
            role="listbox"
            class="absolute z-[95] mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
            <li v-if="loading && !results.length" class="px-3 py-2 text-slate-500">Searching…</li>
            <li
                v-for="(p, i) in results"
                :id="`${id}-opt-${i}`"
                :key="p.id"
                role="option"
                tabindex="-1"
                :aria-selected="active === i"
                class="flex cursor-pointer items-center gap-2 px-3 py-1.5"
                :class="active === i ? 'bg-sky-50' : ''"
                @mouseenter="active = i"
                @mousedown.prevent
                @click="choose(i)"
            >
                <Avatar :name="p.name" :src="p.portrait" />
                <span class="flex-1">
                    <span class="font-medium">{{ p.name }}</span>
                    <span v-if="p.birthDate" class="text-slate-500"> · b. {{ bornYear(p.birthDate) }}</span>
                </span>
                <span v-for="k in p.profiles" :key="k" class="rounded bg-sky-50 px-1.5 text-[11px] text-sky-900 ring-1 ring-inset ring-sky-700/20">{{ profileLabel(k) }}</span>
            </li>
            <li v-if="!loading && !results.length && !showCreate" class="px-3 py-2 text-slate-500">Type a name to search.</li>
            <li
                v-if="showCreate"
                :id="`${id}-opt-${results.length}`"
                role="option"
                tabindex="-1"
                :aria-selected="active === results.length"
                class="cursor-pointer border-t border-slate-100 px-3 py-2 text-sky-800"
                :class="active === results.length ? 'bg-sky-50' : ''"
                @mouseenter="active = results.length"
                @mousedown.prevent
                @click="openCreate"
            >
                + Create new person “{{ query.trim() }}”
            </li>
        </ul>

        <Dialog v-model:open="create.open" title="New person">
            <form :id="`${id}-create`" @submit.prevent="submitCreate">
                <Field v-model="create.name" label="Name" />
                <Field v-model="create.sortName" label="Sort name" hint="How the name is alphabetised, e.g. “Africh, Noelle”" />
                <Field v-model="create.email" label="Email" type="email" />
            </form>
            <template #footer>
                <button type="button" :class="btnGhost" @click="create.open = false">Cancel</button>
                <button type="submit" :form="`${id}-create`" :class="btnPrimary" :disabled="create.busy || !create.name?.trim()">Create</button>
            </template>
        </Dialog>
    </div>
</template>
