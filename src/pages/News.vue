<script>
import { ref } from 'vue';
import MailSignUp from '../components/MailSignUp.vue';
import newsData from '../json/news.json';

export default {
    components: {
        MailSignUp,
    },
    computed: {
        selectedItem() {
            if (this.$route.params.path && this.news.length > 0) {
                for (let item of this.news) {
                    console.log(item.path);
                    if (item.path && item.path == this.$route.params.path) {
                        return item;
                    }
                }
            }
            return null;
        },
    },
    data() {
        return {
            news: newsData,
        };
    },
};
</script>

<template>
    <div class="container mx-auto text-sm py-4 px-3">
        <div class="md:flex md:justify-between gap-6">
            <div class="w-full max-w-2xl mb-10 posts">
                <router-link :to="{ name: 'news' }" class="!no-underline">
                    <h2 class="text-xl font-bold mb-3">News</h2>
                </router-link>
                <div class="border-t py-3" v-if="selectedItem">
                    <router-link :to="{ name: 'news-item', params: { path: selectedItem.path } }" class="!no-underline">
                        <h3 class="text-lg font-medium text-sky-900" v-if="selectedItem.title">
                            {{ selectedItem.title }}
                        </h3>
                    </router-link>
                    <h4 class="mb-3 italic" v-if="selectedItem.date">{{ selectedItem.date }}</h4>
                    <div v-html="selectedItem.html" v-if="selectedItem.html"></div>
                </div>
                <div v-else class="border-t py-3" v-for="(item, index) in news" :key="index">
                    <router-link :to="{ name: 'news-item', params: { path: item.path } }" class="!no-underline">
                        <h3 class="text-lg font-medium text-sky-900" v-if="item.title">{{ item.title }}</h3>
                    </router-link>
                    <h4 class="mb-3 italic" v-if="item.date">{{ item.date }}</h4>
                    <div v-html="item.html" v-if="item.html"></div>
                </div>
            </div>
            <div>
                <MailSignUp />
            </div>
        </div>
    </div>
</template>

<style>
.posts .align-left {
    @apply md:float-left md:pr-3 pb-3 block;
}
.posts .align-left img {
    @apply md:max-w-[200px] max-w-full;
}
.posts .align-right {
    @apply md:float-right md:pl-3 pb-3 block;
}
.posts .align-right img {
    @apply md:max-w-[200px] max-w-full;
}
.posts .align-center {
    @apply mx-auto pb-3 block;
}
.posts .align-left img {
    @apply md:max-w-[200px] max-w-full;
}
</style>
