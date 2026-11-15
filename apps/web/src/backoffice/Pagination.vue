<script setup lang="ts">
import { computed } from 'vue';

/** "Showing 26–50 of 61" with Previous / numbered pages / Next. */
const props = defineProps<{ page: number; pageSize: number; total: number; label: string }>();
const emit = defineEmits<{ page: [page: number] }>();

const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
const from = computed(() => Math.min(props.total, (props.page - 1) * props.pageSize + 1));
const to = computed(() => Math.min(props.total, props.page * props.pageSize));

/** Page numbers to show: first, last, and two either side of the current page, with gaps. */
const items = computed<(number | '…')[]>(() => {
    const keep = new Set([1, pages.value]);
    for (let n = props.page - 2; n <= props.page + 2; n++) if (n >= 1 && n <= pages.value) keep.add(n);
    const sorted = [...keep].sort((a, b) => a - b);
    const out: (number | '…')[] = [];
    sorted.forEach((n, i) => {
        if (i > 0 && n - sorted[i - 1]! > 1) out.push('…');
        out.push(n);
    });
    return out;
});

const btn = 'inline-flex h-8 min-w-8 items-center justify-center rounded px-2 text-sm';
</script>

<template>
    <nav class="mt-3 flex flex-wrap items-center gap-3" :aria-label="`${label} pages`">
        <p class="text-sm text-slate-600" aria-live="polite">Showing {{ from }}–{{ to }} of {{ total }} {{ label }}</p>
        <div v-if="pages > 1" class="ml-auto flex items-center gap-1">
            <button type="button" :class="[btn, 'text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40']" :disabled="page <= 1" @click="emit('page', page - 1)">
                ← Previous
            </button>
            <template v-for="(n, i) in items" :key="`${n}-${i}`">
                <span v-if="n === '…'" class="px-1 text-slate-400" aria-hidden="true">…</span>
                <button
                    v-else
                    type="button"
                    :class="[btn, n === page ? 'bg-sky-800 text-white' : 'text-slate-700 hover:bg-slate-100']"
                    :aria-current="n === page ? 'page' : undefined"
                    :aria-label="`Page ${n}`"
                    @click="emit('page', n)"
                >
                    {{ n }}
                </button>
            </template>
            <button type="button" :class="[btn, 'text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40']" :disabled="page >= pages" @click="emit('page', page + 1)">
                Next →
            </button>
        </div>
    </nav>
</template>
