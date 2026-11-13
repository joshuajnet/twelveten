<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui';

defineProps<{ label: string; hint?: string }>();
const model = defineModel<boolean>({ required: true });
</script>

<template>
    <label class="flex cursor-pointer items-start justify-between gap-4 py-1.5">
        <span>
            <span class="block text-sm">{{ label }}</span>
            <span v-if="hint" class="block text-xs text-slate-500">{{ hint }}</span>
        </span>
        <SwitchRoot
            v-model="model"
            class="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-slate-300 transition-colors data-[state=checked]:bg-sky-800"
        >
            <SwitchThumb class="block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-4" />
        </SwitchRoot>
    </label>
</template>
