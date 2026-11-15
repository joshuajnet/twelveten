<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

/**
 * Plain text edited in place, inheriting the surrounding typography so it looks exactly
 * like the published text. `multiline` keeps line breaks (Enter adds a line).
 */
const props = withDefaults(defineProps<{ placeholder?: string; multiline?: boolean; tag?: string; label?: string }>(), { tag: 'span' });
const model = defineModel<string | null>({ required: true });
const el = ref<HTMLElement | null>(null);

function render() {
    if (el.value && el.value.innerText !== (model.value ?? '')) el.value.innerText = model.value ?? '';
}
onMounted(render);
watch(model, () => {
    if (document.activeElement !== el.value) render();
});

function onInput() {
    const text = (el.value?.innerText ?? '').replace(/ /g, ' ');
    const value = props.multiline ? text.replace(/\n{3,}/g, '\n\n').replace(/\n+$/, '') : text.replace(/\n/g, ' ');
    model.value = value.trim() === '' ? null : value;
}

function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !props.multiline) {
        e.preventDefault();
        (e.target as HTMLElement).blur();
    }
}

function onPaste(e: ClipboardEvent) {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, props.multiline ? text : text.replace(/\s*\n\s*/g, ' '));
}
</script>

<template>
    <component
        :is="tag"
        ref="el"
        class="tt-editable"
        :class="{ 'whitespace-pre-line': multiline }"
        contenteditable="true"
        role="textbox"
        :aria-label="label ?? placeholder"
        :aria-multiline="multiline ? 'true' : undefined"
        :data-placeholder="placeholder"
        spellcheck="true"
        @input="onInput"
        @keydown="onKeydown"
        @paste="onPaste"
        @blur="render"
    />
</template>
