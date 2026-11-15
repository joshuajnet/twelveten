<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useHead } from '@unhead/vue';
import type { PublicRoom } from '@twelveten/shared';
import { api, ApiError } from '@/api/client';
import RoomGate from '@/components/rooms/RoomGate.vue';
import RoomViewer from '@/components/rooms/RoomViewer.vue';

/** A private viewing room: the name/email gate, then the works. */
const route = useRoute();
const token = String(route.params.token);
const preview = route.query.preview === '1';

const state = ref<'loading' | 'gate' | 'room' | 'missing' | 'error'>('loading');
const gateTitle = ref('');
const room = ref<PublicRoom | null>(null);

async function load() {
    state.value = 'loading';
    try {
        const r = await api.room(token, preview);
        if ('gate' in r) {
            gateTitle.value = r.gate.title;
            state.value = 'gate';
        } else {
            room.value = r.room;
            state.value = 'room';
        }
    } catch (e) {
        state.value = e instanceof ApiError && e.status === 404 ? 'missing' : 'error';
    }
}
void load();

function entered(r: PublicRoom) {
    room.value = r;
    state.value = 'room';
}

const title = computed(() => room.value?.title || gateTitle.value);
useHead({
    title: () => (title.value ? `${title.value} — Twelve Ten` : 'Viewing room — Twelve Ten'),
    meta: [
        { name: 'robots', content: 'noindex, nofollow' },
        { name: 'referrer', content: 'same-origin' },
    ],
});
</script>

<template>
    <div class="room-page flex min-h-screen flex-col bg-white font-gentium-book text-slate-900">
        <header class="border-b border-zinc-100">
            <div class="container mx-auto flex items-baseline justify-between gap-4 px-3 py-6">
                <a href="/" class="no-underline"><span class="font-germania-one text-3xl text-sky-900 md:text-4xl">Twelve Ten</span></a>
                <span class="font-roboto text-sm font-light text-slate-500">Private viewing room</span>
            </div>
        </header>

        <div v-if="preview && state === 'room'" class="bg-amber-50 px-3 py-2 text-center font-roboto text-sm font-light text-amber-900" role="status">
            Admin preview — viewers see the name and email form first. Nothing you do here is recorded.
        </div>

        <main class="flex grow flex-col">
            <div v-if="state === 'loading'" class="flex grow items-center justify-center" aria-busy="true">
                <span class="sr-only">Loading…</span>
                <div class="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-sky-900" aria-hidden="true" />
            </div>
            <RoomGate v-else-if="state === 'gate'" :token="token" :title="gateTitle" @entered="entered" />
            <RoomViewer v-else-if="state === 'room' && room" :room="room" :token="token" :preview="preview" />
            <div v-else class="container mx-auto max-w-xl px-3 py-24 text-center">
                <h1 class="mb-3 text-2xl">{{ state === 'missing' ? 'This viewing room isn’t available' : 'Something went wrong' }}</h1>
                <p v-if="state === 'missing'" class="text-slate-600">The link may have expired or been replaced. Please contact the gallery for a new one.</p>
                <p v-else class="text-slate-600">
                    Please <button type="button" class="text-sky-900 underline" @click="load">try again</button>.
                </p>
            </div>
        </main>

        <footer class="border-t border-zinc-100 px-3 py-6 text-center font-roboto text-xs font-light text-slate-500">
            Twelve Ten · This link is private; please don’t share it.
        </footer>
    </div>
</template>
