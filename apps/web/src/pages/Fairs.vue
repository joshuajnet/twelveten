<script setup lang="ts">
import { computed } from 'vue';
import { artistList, exhibitionStatus, formatDateRange, todayIso, type ExhibitionSummary } from '@twelveten/shared';
import { api } from '@/api/client';
import { useResource } from '@/composables/useResource';
import { useMeta } from '@/composables/useMeta';

const { data } = useResource(
    () => 'fair' as const,
    (k) => api.exhibitions(k),
);

const today = todayIso();
const byStatus = computed(() => {
    const groups = { current: [] as ExhibitionSummary[], upcoming: [] as ExhibitionSummary[], past: [] as ExhibitionSummary[] };
    for (const f of data.value ?? []) groups[exhibitionStatus(f.startsOn, f.endsOn, today)].push(f);
    groups.upcoming.reverse();
    return groups;
});

useMeta({ kind: 'static', path: '/fairs' });
</script>

<template>
    <div class="container mx-auto py-4 px-3 flex flex-col grow">
        <div v-if="byStatus.current.length || byStatus.upcoming.length" class="grid md:grid-cols-4 grid-cols-2 gap-6 mb-6">
            <div v-for="group in (['current', 'upcoming'] as const)" v-show="byStatus[group].length" :key="group">
                <h3 class="font-roboto text-xl mb-3">{{ group === 'current' ? 'Current' : 'Upcoming' }}</h3>
                <router-link
                    v-for="f in byStatus[group]"
                    :key="f.id"
                    :to="{ name: 'fair', params: { slug: f.slug } }"
                    class="no-underline text-2xl block mb-6"
                >
                    <div class="text-lg">
                        <template v-for="a in artistList(f.artists)" :key="a">{{ a }}<br /></template>
                        <span class="text-base italic">{{ f.title }}</span><br />
                        <template v-if="f.locationText"><span class="text-sm">{{ f.locationText }}</span><br /></template>
                        <span class="text-sm">{{ formatDateRange(f.startsOn, f.endsOn) }}</span>
                    </div>
                </router-link>
            </div>
        </div>
        <template v-if="byStatus.past.length">
            <h3 class="font-roboto text-xl mb-3">Past</h3>
            <div class="grid md:grid-cols-4 grid-cols-2 gap-6">
                <router-link
                    v-for="f in byStatus.past"
                    :key="f.id"
                    :to="{ name: 'fair', params: { slug: f.slug } }"
                    class="no-underline text-2xl"
                >
                    <div class="text-lg">
                        <template v-for="a in artistList(f.artists)" :key="a">{{ a }}<br /></template>
                        <span class="text-base italic">{{ f.title }}</span><br />
                        <template v-if="f.locationText"><span class="text-sm">{{ f.locationText }}</span><br /></template>
                        <span class="text-sm">{{ formatDateRange(f.startsOn, f.endsOn) }}</span>
                    </div>
                </router-link>
            </div>
        </template>
    </div>
</template>
