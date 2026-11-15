<script setup lang="ts" generic="T extends string">
import { useId } from 'vue';

/** Labelled native select (keyboard- and phone-friendly) styled like Field. */
defineProps<{ label: string; options: { value: T | ''; label: string }[]; hint?: string }>();
const model = defineModel<T | '' | null>({ required: true });
// Labelled by id: a <select> inside its <label> would take every option's text into its name.
const id = useId();
</script>

<template>
    <div class="py-1.5">
        <label :for="id" class="block text-xs font-medium text-slate-600">{{ label }}</label>
        <select
            :id="id"
            :value="model ?? ''"
            class="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-sky-700 focus:outline-none"
            @change="model = ($event.target as HTMLSelectElement).value as T | ''"
        >
            <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <span v-if="hint" class="mt-0.5 block text-xs text-slate-500">{{ hint }}</span>
    </div>
</template>
