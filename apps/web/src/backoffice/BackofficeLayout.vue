<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { useHead } from '@unhead/vue';
import '@/admin/admin.css';
import Toasts from '@/admin/ui/Toasts.vue';
import Dialog from '@/admin/ui/Dialog.vue';
import { conflict } from '@/admin/state';
import { signOut } from '@/admin/api';
import { btnDanger, btnOutline } from '@/admin/ui/buttons';
import { session, setHint } from '@/session';
import { boApi } from './api';
import { duplicateCount, unseenInquiries } from './nav';
import InquiryAlerts from './inquiries/InquiryAlerts.vue';

/** Back office shell: sidebar navigation, account controls, toasts and the conflict prompt. */
const route = useRoute();
const router = useRouter();
const menuOpen = ref(false);

useHead({ title: 'Admin — Twelve Ten', meta: [{ name: 'robots', content: 'noindex, nofollow' }] });

// Close the phone menu after navigating.
watch(
    () => route.fullPath,
    () => (menuOpen.value = false),
);

/** Which profile a people page or person page is showing. */
const viewedProfile = computed(() => (route.name === 'bo-people' ? route.query.profile : route.name === 'bo-person' ? route.params.profile : undefined));
const nav = computed(() => [
    {
        label: 'People',
        to: { name: 'bo-people' },
        active: (route.name === 'bo-people' || route.name === 'bo-person') && viewedProfile.value !== 'artist' && viewedProfile.value !== 'collector',
    },
    { label: 'Artists', to: { name: 'bo-people', query: { profile: 'artist' } }, active: viewedProfile.value === 'artist' },
    { label: 'Collectors', to: { name: 'bo-people', query: { profile: 'collector' } }, active: viewedProfile.value === 'collector' },
    { label: 'Inventory', to: { name: 'bo-inventory' }, active: route.name === 'bo-inventory' || route.name === 'bo-work' },
    { label: 'Invoices', to: { name: 'bo-invoices' }, active: String(route.name ?? '').startsWith('bo-invoice') },
    { label: 'Inquiries', to: { name: 'bo-inquiries' }, active: route.name === 'bo-inquiries', badge: unseenInquiries.value.count || null },
    { label: 'Viewing rooms', to: { name: 'bo-rooms' }, active: String(route.name ?? '').startsWith('bo-room') },
    { label: 'Duplicates', to: { name: 'bo-duplicates' }, active: route.name === 'bo-duplicates', badge: duplicateCount.value || null },
]);

// Refresh the badges and the inquiry alert on each page change (two small queries).
const refreshCount = () => {
    boApi.duplicateCount().then((n) => (duplicateCount.value = n)).catch(() => {});
    boApi.unseenInquiries().then((u) => (unseenInquiries.value = u)).catch(() => {});
};
onMounted(refreshCount);
watch(() => route.name, refreshCount);

async function logout() {
    await signOut().catch(() => {});
    setHint(false);
    session.user = null;
    await router.push('/admin/login');
}

function closeConflict(o: boolean) {
    if (!o) conflict.resolve?.('reload');
}
</script>

<template>
    <div class="admin-ui flex min-h-screen bg-slate-50 text-slate-900">
        <a href="#bo-main" class="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow">Skip to content</a>

        <!-- Sidebar (drawer on small screens) -->
        <div v-if="menuOpen" class="fixed inset-0 z-30 bg-black/30 md:hidden" aria-hidden="true" @click="menuOpen = false" />
        <aside
            class="fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-slate-200 bg-white transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0"
            :class="menuOpen ? 'translate-x-0' : '-translate-x-full'"
            aria-label="Admin"
        >
            <div class="flex h-14 items-center border-b border-slate-200 px-4">
                <RouterLink :to="{ name: 'bo-people' }" class="flex items-baseline gap-2"
                    ><span class="font-germania-one text-2xl text-sky-900">Twelve Ten</span><span class="text-sm text-slate-500">Admin</span></RouterLink
                >
            </div>
            <nav class="flex-1 space-y-0.5 p-2 text-sm">
                <RouterLink
                    v-for="item in nav"
                    :key="item.label"
                    :to="item.to"
                    class="block rounded px-3 py-2 hover:bg-slate-100"
                    :class="item.active ? 'bg-slate-100 font-medium text-sky-900' : 'text-slate-700'"
                    :aria-current="item.active ? 'page' : undefined"
                >
                    <span class="flex items-center justify-between gap-2">
                        {{ item.label }}
                        <span v-if="'badge' in item && item.badge" class="rounded-full bg-amber-100 px-1.5 text-xs font-medium tabular-nums text-amber-800" :aria-label="item.label === 'Inquiries' ? `${item.badge} new` : `${item.badge} possible duplicates`">{{ item.badge }}</span>
                    </span>
                </RouterLink>
            </nav>
            <div class="space-y-1 border-t border-slate-200 p-3 text-sm">
                <a href="/" class="block rounded px-2 py-1.5 text-slate-700 hover:bg-slate-100">View site ↗</a>
                <div class="truncate px-2 pt-1 text-xs text-slate-500" :title="session.user?.email">{{ session.user?.name || session.user?.email }}</div>
                <button type="button" class="w-full rounded px-2 py-1.5 text-left text-slate-700 hover:bg-slate-100" @click="logout">Sign out</button>
            </div>
        </aside>

        <div class="flex min-w-0 flex-1 flex-col">
            <header class="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:hidden">
                <button type="button" class="rounded p-1.5 hover:bg-slate-100" aria-label="Open menu" :aria-expanded="menuOpen" @click="menuOpen = true">
                    <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <span class="flex items-baseline gap-2"><span class="font-germania-one text-xl text-sky-900">Twelve Ten</span><span class="text-sm text-slate-500">Admin</span></span>
            </header>
            <main id="bo-main" class="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8">
                <InquiryAlerts />
                <RouterView />
            </main>
        </div>

        <Dialog :open="conflict.open" title="Someone else changed this" description="Another save happened since you opened this page." @update:open="closeConflict">
            <p class="text-sm">Reload to see their version (your unsaved edits are dropped), or overwrite it with yours.</p>
            <template #footer>
                <button type="button" :class="btnOutline" @click="conflict.resolve?.('reload')">Reload theirs</button>
                <button type="button" :class="btnDanger" @click="conflict.resolve?.('overwrite')">Overwrite with mine</button>
            </template>
        </Dialog>
        <Toasts />
    </div>
</template>

<style>
@layer base {
    /* The public site underlines every link in <main>; the back office styles its links itself. */
    #bo-main a {
        text-decoration: none;
        color: inherit;
    }
}
</style>
