<script setup>
import { ref } from 'vue';
</script>

<template>
    <div class="text-slate-600 flex flex-col flex-grow justify-center text-center text-sm py-4 px-2 mt-6">
        <div>Twelve Ten Gallery | 1210 W Thorndale Ave. Chicago, IL 60660</div>
        <div class="flex items-center justify-center">
            <a href="https://www.instagram.com/twelvetengallery/" target="_blank" class="mr-3 text-lg"
                ><i class="lab la-instagram"></i></a>
            &copy; {{ new Date().getFullYear() }}
        </div>
    </div>
</template>
