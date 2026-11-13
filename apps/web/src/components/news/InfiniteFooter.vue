<script setup lang="ts">
/** Loading / end / retry states under an infinitely loading list, plus a keyboard-reachable "Load more". */
defineProps<{
    list: {
        state: { loading: boolean; done: boolean; error: Error | null; items: unknown[] };
        loadMore: () => Promise<void>;
        retry: () => Promise<void>;
        announcement: string;
    };
    label: string;
}>();
</script>

<template>
    <div class="text-center text-xs font-roboto font-light text-slate-500">
        <p v-if="list.state.loading" class="py-3">Loading…</p>
        <p v-else-if="list.state.error" class="py-3">
            Couldn’t load more {{ label }}.
            <button type="button" class="underline text-sky-900 cursor-pointer" @click="list.retry()">Retry</button>
        </p>
        <button
            v-else-if="!list.state.done"
            type="button"
            class="sr-only focus:not-sr-only py-3 underline text-sky-900"
            @click="list.loadMore()"
        >
            Load more {{ label }}
        </button>
        <span class="sr-only" aria-live="polite">{{ list.announcement }}</span>
    </div>
</template>
