<script setup lang="ts">
/** Labelled text input used in admin dialogs. */
withDefaults(defineProps<{ label: string; hint?: string; type?: string; placeholder?: string; multiline?: boolean; mono?: boolean }>(), {
    type: 'text',
});
const model = defineModel<string | null>({ required: true });
</script>

<template>
    <label class="block py-1.5">
        <span class="block text-xs font-medium text-slate-600">{{ label }}</span>
        <textarea
            v-if="multiline"
            :value="model ?? ''"
            rows="3"
            :placeholder="placeholder"
            class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-sky-700 focus:outline-none"
            @input="model = ($event.target as HTMLTextAreaElement).value || null"
        />
        <input
            v-else
            :value="model ?? ''"
            :type="type"
            :placeholder="placeholder"
            class="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-sky-700 focus:outline-none"
            :class="{ 'font-mono text-xs': mono }"
            @input="model = ($event.target as HTMLInputElement).value || null"
        />
        <span v-if="hint" class="mt-0.5 block text-xs text-slate-500">{{ hint }}</span>
    </label>
</template>
