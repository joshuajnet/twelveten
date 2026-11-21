<script setup lang="ts">
import { watch } from "vue";
import { RouterLink } from "vue-router";
import {
  formatPrice,
  WORKS_PAGE_SIZE,
  type WorkStatus,
} from "@twelveten/shared";
import { boApi } from "./api";
import { locationLabel } from "./format";
import StatusBadge from "./StatusBadge.vue";
import Pagination from "./Pagination.vue";
import { usePagedList } from "./useListQuery";
import ArtImage from '@/components/ArtImage.vue';

/** One page of works for the current filters. */
const props = defineProps<{
  q: string;
  artist: string | null;
  statuses: WorkStatus[];
  location: string | null;
  page: number;
}>();
const emit = defineEmits<{ page: [page: number]; total: [total: number | null] }>();

const { result, loading, error, reload } = usePagedList(
  () => [props.q, props.artist, props.statuses, props.location, props.page],
  () =>
    boApi.works({
      q: props.q,
      artist: props.artist,
      statuses: props.statuses,
      location: props.location,
      page: props.page,
      limit: WORKS_PAGE_SIZE,
    }),
  (page) => emit("page", page),
);
// How many works match, for actions on all of them (e.g. shipping labels).
watch(() => result.value?.total ?? null, (t) => emit("total", t), { immediate: true });
</script>

<template>
  <div>
    <div
      class="overflow-x-auto rounded-md border border-slate-200 bg-white"
      :aria-busy="loading"
    >
      <table class="w-full min-w-[44rem] text-left text-sm">
        <thead
          class="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"
        >
          <tr>
            <th scope="col" class="w-14 px-3 py-2 font-medium">
              <span class="sr-only">Image</span>
            </th>
            <th scope="col" class="px-3 py-2 font-medium">Inv. no.</th>
            <th scope="col" class="px-3 py-2 font-medium">Artist</th>
            <th scope="col" class="px-3 py-2 font-medium">Title</th>
            <th scope="col" class="px-3 py-2 font-medium">Status</th>
            <th scope="col" class="hidden px-3 py-2 font-medium lg:table-cell">
              Location
            </th>
            <th scope="col" class="px-3 py-2 text-right font-medium">Price</th>
          </tr>
        </thead>
        <tbody
          class="divide-y divide-slate-100"
          :class="{ 'opacity-60': loading && result }"
        >
          <tr
            v-for="w in result?.items ?? []"
            :key="w.id"
            class="relative hover:bg-sky-50/60 focus-within:bg-sky-50/60"
          >
            <td class="px-3 py-1.5">
              <ArtImage sizes="96px" fit="cover"
                v-if="w.image"
                :src="w.image.url"
                alt=""
                class="h-10 w-10 rounded object-cover"
              />
              <span v-else class="block h-10 w-10 rounded bg-slate-100" />
            </td>
            <td
              class="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-600"
            >
              {{ w.inventoryNumber }}
            </td>
            <td class="px-3 py-2 text-slate-700">{{ w.artistName }}</td>
            <td class="px-3 py-2">
              <RouterLink
                :to="{ name: 'bo-work', params: { id: w.id } }"
                class="font-medium italic text-slate-900 after:absolute after:inset-0 after:content-[''] focus:outline-none focus-visible:after:outline-2 focus-visible:after:outline-sky-700"
              >
                {{ w.title || "Untitled" }}</RouterLink><span
                v-if="w.dateText"
                class="text-slate-500"
                >, {{ w.dateText }}</span
              >
            </td>
            <td class="px-3 py-2"><StatusBadge :status="w.status" /></td>
            <td class="hidden px-3 py-2 text-slate-600 lg:table-cell">
              {{ locationLabel(w.location) }}
            </td>
            <td class="whitespace-nowrap px-3 py-2 text-right tabular-nums">
              {{ formatPrice(w.priceCents, w.currency) }}
            </td>
          </tr>
        </tbody>
      </table>
      <p
        v-if="!result && loading"
        class="px-3 py-8 text-center text-sm text-slate-500"
      >
        Loading…
      </p>
      <p
        v-else-if="error"
        class="px-3 py-8 text-center text-sm text-red-700"
        role="alert"
      >
        Couldn’t load works: {{ error }}
        <button type="button" class="text-sky-800 underline" @click="reload">
          Retry
        </button>
      </p>
      <p
        v-else-if="result && !result.total"
        class="px-3 py-8 text-center text-sm text-slate-500"
      >
        No works match.
      </p>
    </div>
    <Pagination
      v-if="result && result.total"
      :page="result.page"
      :page-size="result.pageSize"
      :total="result.total"
      label="works"
      @page="(n) => emit('page', n)"
    />
  </div>
</template>
