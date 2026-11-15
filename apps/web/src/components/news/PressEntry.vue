<script setup lang="ts">
import { formatDate, type PressItem } from '@twelveten/shared';

defineProps<{ item: PressItem }>();
</script>

<template>
    <div class="mb-6">
        <h3 class="text-lg italic">{{ item.outlet }}</h3>
        <a :href="item.url" target="_blank" rel="noopener noreferrer" class="no-underline!">
            <h3 class="text-lg font-medium text-sky-900">{{ item.title }}</h3>
        </a>
        <h4 class="italic">{{ item.issueLabel ?? formatDate(item.publishedOn) }}</h4>
        <p v-if="item.byline">{{ item.byline }}</p>
    </div>
</template>
