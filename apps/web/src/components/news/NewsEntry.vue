<script setup lang="ts">
import { formatDate, todayIso, type NewsPost } from '@twelveten/shared';
import { computed } from 'vue';

const props = defineProps<{ post: NewsPost }>();
/** Posts are dated by their gallery-local publish day. */
const day = computed(() => todayIso(undefined, new Date(props.post.publishedAt)));
</script>

<template>
    <div class="border-t py-3">
        <router-link :to="{ name: 'news-item', params: { slug: post.slug } }" class="no-underline!">
            <h3 class="text-lg font-medium text-sky-900">{{ post.title }}</h3>
        </router-link>
        <h4 class="mb-3 italic">{{ formatDate(day) }}</h4>
        <div v-html="post.bodyHtml" />
    </div>
</template>
