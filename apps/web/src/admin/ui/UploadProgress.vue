<script setup lang="ts">
/** Files being uploaded, each with a progress bar (see `useUploadQueue`). */
defineProps<{ uploads: { name: string; progress: number }[] }>();
</script>

<template>
    <div v-if="uploads.length" class="space-y-1 text-xs">
        <div v-for="u in uploads" :key="u.name" class="flex items-center gap-2">
            <span class="w-48 truncate">{{ u.name }}</span>
            <span class="h-1.5 flex-1 rounded bg-slate-200"><span class="block h-1.5 rounded bg-sky-800" :style="{ width: `${u.progress * 100}%` }" /></span>
        </div>
    </div>
</template>
