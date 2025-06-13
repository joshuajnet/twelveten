<script setup>
import { ref } from 'vue';
</script>

<template>
    <div
        class="text-slate-600 flex flex-col flex-grow justify-center text-center text-xs py-4 px-2 md:mt-6"
        :class="[{ hidden: $route.name == 'home' }]"
    >
        <div>&copy; {{ new Date().getFullYear() }} Twelve Ten Gallery | 1210 W Thorndale Ave. Chicago, IL 60660</div>
    </div>
</template>
