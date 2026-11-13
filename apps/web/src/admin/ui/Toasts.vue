<script setup lang="ts">
import { toasts } from '../state';
</script>

<template>
    <div class="admin-ui pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2" aria-live="polite">
        <div
            v-for="t in toasts"
            :key="t.id"
            class="pointer-events-auto max-w-sm rounded px-3 py-2 text-sm shadow-lg"
            :class="{
                'bg-slate-900 text-white': t.kind === 'info',
                'bg-red-700 text-white': t.kind === 'error',
                'bg-emerald-700 text-white': t.kind === 'success',
            }"
        >
            {{ t.message }}
        </div>
    </div>
</template>
