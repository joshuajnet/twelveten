<script setup lang="ts">
import { ref } from 'vue';
import type { PublicRoom } from '@twelveten/shared';
import { api, ApiError } from '@/api/client';

/** Name and email before the room opens. The API remembers this browser afterwards. */
const props = defineProps<{ token: string; title: string; subtitle?: string | null }>();
const emit = defineEmits<{ entered: [room: PublicRoom] }>();

const name = ref('');
const email = ref('');
const busy = ref(false);
const error = ref('');

async function submit() {
    error.value = '';
    busy.value = true;
    try {
        emit('entered', await api.enterRoom(props.token, { name: name.value, email: email.value }));
    } catch (e) {
        if (e instanceof ApiError && e.status === 400) {
            const details = (e.details as { path: string; message: string }[] | undefined) ?? [];
            error.value = details.map((d) => d.message).join('. ') || 'Please check your name and email.';
        } else if (e instanceof ApiError && e.status === 429) error.value = 'Too many attempts. Please wait a minute and try again.';
        else if (e instanceof ApiError && e.status === 404) error.value = 'This viewing room is no longer available.';
        else error.value = 'Something went wrong. Please try again.';
    } finally {
        busy.value = false;
    }
}
</script>

<template>
    <div class="flex grow items-center justify-center px-4 py-16">
        <form class="w-full max-w-sm" novalidate data-testid="room-gate" @submit.prevent="submit">
            <p class="mb-1 font-roboto text-xs font-light uppercase tracking-widest text-slate-500">Viewing room</p>
            <h1 class="text-3xl leading-tight" :class="subtitle ? 'mb-1' : 'mb-6'">{{ title }}</h1>
            <p v-if="subtitle" class="mb-6 text-lg text-slate-600">{{ subtitle }}</p>
            <p class="mb-5 text-slate-600">Please introduce yourself to view the works.</p>
            <label class="mb-4 block">
                <span class="mb-1 block font-roboto text-sm font-light text-slate-600">Name</span>
                <input v-model="name" type="text" name="name" autocomplete="name" required class="gate-input" />
            </label>
            <label class="mb-5 block">
                <span class="mb-1 block font-roboto text-sm font-light text-slate-600">Email</span>
                <input v-model="email" type="email" name="email" autocomplete="email" inputmode="email" required class="gate-input" />
            </label>
            <p v-if="error" class="mb-4 font-roboto text-sm text-red-700" role="alert">{{ error }}</p>
            <button
                type="submit"
                :disabled="busy || !name.trim() || !email.trim()"
                class="w-full border border-sky-900 bg-sky-900 px-4 py-2.5 font-roboto font-light text-white transition-colors hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {{ busy ? 'Opening…' : 'View the room' }}
            </button>
            <p class="mt-5 font-roboto text-xs font-light leading-relaxed text-slate-500">
                We record how you browse this room so we can follow up on the works that interest you.
            </p>
        </form>
    </div>
</template>

<style scoped>
@reference "@/style.css";
.gate-input {
    @apply w-full border border-slate-300 bg-white px-3 py-2 font-roboto font-light text-slate-900 outline-none transition-colors focus:border-sky-900 focus:ring-1 focus:ring-sky-900;
}
</style>
