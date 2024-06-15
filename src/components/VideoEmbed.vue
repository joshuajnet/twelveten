<script>
export default {
    props: {
        embedCode: String,
    },
};
</script>

<template>
    <div class="relative w-full h-0" style="padding-top: 56.5%">
        <iframe
            class="absolute top-0 left-0 w-full h-full"
            width="100%"
            height="100%"
            :src="`https://www.youtube.com/embed/${embedCode}?rel=0&autoplay=0`"
            title="YouTube video player"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
        >
        </iframe>
    </div>
</template>
