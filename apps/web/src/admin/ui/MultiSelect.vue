<script setup lang="ts" generic="T extends string">
import { computed, useId } from 'vue';
import { DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItemIndicator, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui';

/**
 * A labelled dropdown of checkboxes for choosing several values (a filter, say). The trigger sums up
 * the choice; the menu stays open while ticking; at least `min` stay ticked. Values come back in
 * `options` order.
 */
const props = withDefaults(defineProps<{ label: string; options: { value: T; label: string }[]; min?: number; allLabel?: string; testid?: string }>(), {
    min: 1,
    allLabel: 'All',
    testid: undefined,
});
const selected = defineModel<T[]>({ required: true });
const id = useId();

const summary = computed(() => {
    if (selected.value.length === props.options.length) return props.allLabel;
    if (!selected.value.length) return 'None';
    return props.options
        .filter((o) => selected.value.includes(o.value))
        .map((o) => o.label)
        .join(', ');
});

function toggle(value: T, on: boolean) {
    const next = props.options.map((o) => o.value).filter((v) => (v === value ? on : selected.value.includes(v)));
    if (next.length >= props.min) selected.value = next;
}
const locked = (value: T) => selected.value.includes(value) && selected.value.length <= props.min;
</script>

<template>
    <div class="block">
        <span :id="id" class="block text-xs font-medium text-slate-600">{{ label }}</span>
        <DropdownMenuRoot>
            <DropdownMenuTrigger
                :aria-labelledby="id"
                :data-testid="testid"
                class="mt-1 flex w-full items-center justify-between gap-2 rounded border border-slate-300 bg-white px-2 py-1.5 text-left text-sm focus:border-sky-700 focus:outline-none"
            >
                <span class="truncate">{{ summary }}</span>
                <i class="las la-angle-down text-slate-500" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
                <DropdownMenuContent class="admin-ui z-[85] min-w-[var(--reka-dropdown-menu-trigger-width)] rounded-md border border-slate-200 bg-white p-1 shadow-lg" align="start" :side-offset="4">
                    <DropdownMenuCheckboxItem
                        v-for="o in options"
                        :key="o.value"
                        :model-value="selected.includes(o.value)"
                        :disabled="locked(o.value)"
                        class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none data-[disabled]:cursor-not-allowed data-[highlighted]:bg-slate-100 data-[disabled]:text-slate-400"
                        @update:model-value="(on: boolean | 'indeterminate') => toggle(o.value, on === true)"
                        @select="(e: Event) => e.preventDefault()"
                    >
                        <span class="flex h-4 w-4 items-center justify-center rounded border border-slate-400" aria-hidden="true">
                            <DropdownMenuItemIndicator><i class="las la-check text-xs" /></DropdownMenuItemIndicator>
                        </span>
                        {{ o.label }}
                    </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
            </DropdownMenuPortal>
        </DropdownMenuRoot>
    </div>
</template>
