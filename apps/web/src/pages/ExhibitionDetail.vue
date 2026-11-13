<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import type { ExhibitionKind } from '@twelveten/shared';
import { api } from '@/api/client';
import { useResource } from '@/composables/useResource';
import { useMeta } from '@/composables/useMeta';
import ExhibitionTemplate from '@/components/exhibition/ExhibitionTemplate.vue';
import Error404 from '@/pages/Error404.vue';

const route = useRoute();
const kind = computed<ExhibitionKind>(() => (route.name === 'fair' ? 'fair' : 'exhibition'));
const slug = computed(() => String(route.params.slug));

const { data: exhibition, notFound, error } = useResource(
    () => [slug.value, kind.value] as const,
    ([s, k]) => api.exhibition(s, k),
);

useMeta(() =>
    exhibition.value
        ? { kind: 'exhibition', exhibition: exhibition.value }
        : notFound.value
          ? { kind: 'not-found', path: route.path }
          : null,
);
</script>

<template>
    <Error404 v-if="notFound" />
    <div v-else-if="error" class="container mx-auto px-3 py-8">This page could not be loaded. Please try again.</div>
    <ExhibitionTemplate v-else-if="exhibition" :exhibition="exhibition" />
    <div v-else class="flex grow" aria-busy="true" />
</template>
