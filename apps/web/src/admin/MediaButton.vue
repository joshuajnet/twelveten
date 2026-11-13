<script setup lang="ts">
import { ref } from 'vue';
import { pickFiles, uploadFile, type UploadKind } from './upload';
import { errorMessage } from './api';
import { toast } from './state';
import { btnOutline } from './ui/buttons';

/** Upload a file and emit its URL. */
const props = withDefaults(defineProps<{ kind?: UploadKind; label?: string }>(), { kind: 'image', label: 'Replace' });
const emit = defineEmits<{ uploaded: [url: string, file: File] }>();
const progress = ref<number | null>(null);

async function choose() {
    const [file] = await pickFiles(props.kind);
    if (!file) return;
    try {
        progress.value = 0;
        emit('uploaded', await uploadFile(file, (f) => (progress.value = f)), file);
    } catch (e) {
        toast(errorMessage(e), 'error');
    } finally {
        progress.value = null;
    }
}
</script>

<template>
    <button type="button" :class="btnOutline" class="admin-ui shadow" :disabled="progress !== null" @click.prevent.stop="choose">
        {{ progress !== null ? `Uploading ${Math.round(progress * 100)}%` : label }}
    </button>
</template>
