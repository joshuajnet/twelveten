<script setup lang="ts">
import { computed } from 'vue';
import { exhibitionStatus, formatDateRange, joinArtists, todayIso, type ExhibitionSummary } from '@twelveten/shared';
import { api } from '@/api/client';
import { useResource } from '@/composables/useResource';
import { useMeta } from '@/composables/useMeta';
import ArtImage from '@/components/ArtImage.vue';

const { data } = useResource(
    () => 'exhibition' as const,
    (k) => api.exhibitions(k),
);

const today = todayIso();
const byStatus = computed(() => {
    const groups = { current: [] as ExhibitionSummary[], upcoming: [] as ExhibitionSummary[], past: [] as ExhibitionSummary[] };
    for (const e of data.value ?? []) groups[exhibitionStatus(e.startsOn, e.endsOn, today)].push(e);
    // Upcoming reads soonest first; the API returns newest first.
    groups.upcoming.reverse();
    return groups;
});

const alt = (e: ExhibitionSummary) => {
    const who = joinArtists(e.artists);
    return `${e.titleFirst || !who ? e.title : `${who}: ${e.title}`}. ${formatDateRange(e.startsOn, e.endsOn)}`;
};
const image = (e: ExhibitionSummary) => e.thumbnail ?? e.heroImage;

useMeta(() => ({ kind: 'static', path: '/exhibitions', image: data.value?.[0] ? image(data.value[0]) : null }));
</script>

<template>
    <div class="container mx-auto py-4 px-3 flex flex-col grow">
        <div v-if="byStatus.current.length || byStatus.upcoming.length" class="grid md:grid-cols-4 grid-cols-2 gap-6 mb-6">
            <div v-for="group in (['current', 'upcoming'] as const)" v-show="byStatus[group].length" :key="group">
                <h3 class="font-roboto text-xl mb-3">{{ group === 'current' ? 'Current' : 'Upcoming' }}</h3>
                <router-link
                    v-for="e in byStatus[group]"
                    :key="e.id"
                    :to="{ name: 'exhibition', params: { slug: e.slug } }"
                    class="no-underline text-2xl block mb-6"
                >
                    <ArtImage
                        v-if="image(e)"
                        :src="image(e)!"
                        :alt="alt(e)"
                        sizes="(min-width: 768px) 25vw, 50vw"
                        class="max-w-full w-auto h-auto mx-auto"
                        style="max-height: calc(100vh - 200px)"
                    />
                </router-link>
            </div>
        </div>
        <template v-if="byStatus.past.length">
            <h3 class="font-roboto text-xl mb-3">Past</h3>
            <div class="grid md:grid-cols-4 grid-cols-2 gap-6">
                <router-link
                    v-for="e in byStatus.past"
                    :key="e.id"
                    :to="{ name: 'exhibition', params: { slug: e.slug } }"
                    class="no-underline text-2xl"
                >
                    <ArtImage
                        v-if="image(e)"
                        :src="image(e)!"
                        :alt="alt(e)"
                        sizes="(min-width: 768px) 25vw, 50vw"
                        class="max-w-full w-auto h-auto mx-auto"
                        style="max-height: calc(100vh - 200px)"
                    />
                    <span v-else class="text-lg">{{ e.title }}</span>
                </router-link>
            </div>
        </template>
    </div>
</template>

<style scoped>
</style>
