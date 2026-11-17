<script setup lang="ts">
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuTrigger } from 'reka-ui';

export interface MenuItem {
    label: string;
    select: () => void;
    disabled?: boolean;
    /** Why it is disabled, or more about it. */
    hint?: string;
    testid?: string;
}

/** A dropdown of actions under a trigger (the `trigger` slot, else `label`). */
withDefaults(defineProps<{ items: MenuItem[]; label: string; triggerClass?: string; align?: 'start' | 'end' }>(), { triggerClass: '', align: 'end' });
</script>

<template>
    <DropdownMenuRoot>
        <DropdownMenuTrigger :class="triggerClass" :aria-label="label" :title="label">
            <slot name="trigger">{{ label }}</slot>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
            <DropdownMenuContent class="admin-ui z-[85] min-w-40 rounded-md border border-slate-200 bg-white p-1 shadow-lg" :align="align" :side-offset="4">
                <DropdownMenuItem
                    v-for="item in items"
                    :key="item.label"
                    :disabled="item.disabled"
                    :title="item.hint"
                    :data-testid="item.testid"
                    class="cursor-pointer rounded px-2 py-1.5 text-sm outline-none data-[disabled]:cursor-not-allowed data-[highlighted]:bg-slate-100 data-[disabled]:text-slate-400"
                    @select="item.select()"
                >
                    {{ item.label }}
                    <span v-if="item.disabled && item.hint" class="block text-[11px] text-slate-400">{{ item.hint }}</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenuPortal>
    </DropdownMenuRoot>
</template>
