<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiError } from '@/api/client';
import { isAdmin, loadSession, setHint } from '@/session';
import { useMeta } from '@/composables/useMeta';

const route = useRoute();
const router = useRouter();
const email = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);

useMeta({ kind: 'static', path: '/admin/login', title: 'Sign in' });

const next = () => {
    const to = String(route.query.next ?? '/');
    return to.startsWith('/') && !to.startsWith('//') ? to : '/';
};

onMounted(async () => {
    if (await loadSession(true)) {
        if (isAdmin.value) await router.replace(next());
    }
});

async function submit() {
    error.value = '';
    busy.value = true;
    try {
        const res = await fetch('/api/auth/sign-in/email', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.value, password: password.value }),
        });
        if (!res.ok) throw new ApiError(res.status, res.status === 429 ? 'Too many attempts — wait a minute and try again.' : 'Email or password is incorrect.');
        setHint(true);
        await loadSession(true);
        if (!isAdmin.value) throw new ApiError(403, 'This account cannot edit the site.');
        await router.replace(next());
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Sign-in failed.';
    } finally {
        busy.value = false;
    }
}
</script>

<template>
    <div class="container mx-auto flex grow items-start justify-center px-3 py-12">
        <form class="w-full max-w-sm" @submit.prevent="submit">
            <h2 class="mb-6 text-2xl">Sign in</h2>
            <label class="mb-4 block">
                <span class="mb-1 block text-sm">Email</span>
                <input v-model="email" type="email" autocomplete="username" required class="w-full border border-slate-300 px-3 py-2 focus:border-sky-900 focus:outline-none" />
            </label>
            <label class="mb-6 block">
                <span class="mb-1 block text-sm">Password</span>
                <input v-model="password" type="password" autocomplete="current-password" required class="w-full border border-slate-300 px-3 py-2 focus:border-sky-900 focus:outline-none" />
            </label>
            <p v-if="error" class="mb-4 text-sm text-red-700" role="alert">{{ error }}</p>
            <button type="submit" :disabled="busy" class="w-full bg-sky-900 px-4 py-2 text-white hover:bg-sky-950 disabled:opacity-50">
                {{ busy ? 'Signing in…' : 'Sign in' }}
            </button>
        </form>
    </div>
</template>
