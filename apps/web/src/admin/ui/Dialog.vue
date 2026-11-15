<script setup lang="ts">
import { DialogClose, DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';

defineProps<{ title: string; description?: string; wide?: boolean }>();
const open = defineModel<boolean>('open', { required: true });
</script>

<template>
    <DialogRoot v-model:open="open">
        <DialogPortal>
            <DialogOverlay class="fixed inset-0 z-[90] bg-black/40" />
            <DialogContent
                class="admin-ui fixed left-1/2 top-1/2 z-[91] max-h-[85vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md bg-white p-5 shadow-xl focus:outline-none"
                :class="wide ? 'max-w-2xl' : 'max-w-md'"
            >
                <div class="mb-4 flex items-start justify-between gap-4">
                    <div>
                        <DialogTitle class="text-base font-semibold">{{ title }}</DialogTitle>
                        <DialogDescription v-if="description" class="mt-1 text-sm text-slate-600">{{ description }}</DialogDescription>
                    </div>
                    <DialogClose class="rounded px-2 text-lg leading-none text-slate-500 hover:bg-slate-100" aria-label="Close">×</DialogClose>
                </div>
                <slot />
                <div v-if="$slots.footer" class="mt-5 flex justify-end gap-2">
                    <slot name="footer" />
                </div>
            </DialogContent>
        </DialogPortal>
    </DialogRoot>
</template>
