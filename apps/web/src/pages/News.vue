<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import MailSignUp from '@/components/MailSignUp.vue';
import PressEntry from '@/components/news/PressEntry.vue';
import NewsEntry from '@/components/news/NewsEntry.vue';
import InfiniteFooter from '@/components/news/InfiniteFooter.vue';
import Error404 from '@/pages/Error404.vue';
import { api } from '@/api/client';
import { useInfiniteList } from '@/composables/useInfiniteList';
import { useResource } from '@/composables/useResource';
import { useMeta } from '@/composables/useMeta';
import { todayIso, type ExhibitionSummary, type NewsPost, type PressItem } from '@twelveten/shared';
import { isAdmin } from '@/session';
import { editMode } from '@/admin/state';

const EditableNewsEntry = defineAsyncComponent(() => import('@/admin/EditableNewsEntry.vue'));
const EditablePressEntry = defineAsyncComponent(() => import('@/admin/EditablePressEntry.vue'));

const route = useRoute();
const slug = computed(() => (route.name === 'news-item' ? String(route.params.slug) : null));

// Single post view
const single = useResource(slug, (s) => (s ? api.newsPost(s) : Promise.resolve(null)));

// List views: news and press load independently, 10 at a time, as the reader scrolls.
const newsSentinel = ref<HTMLElement | null>(null);
const pressSentinel = ref<HTMLElement | null>(null);
const news = useInfiniteList<NewsPost>({ key: 'news', fetchPage: (c) => api.news(c), sentinel: newsSentinel });
const press = useInfiniteList<PressItem>({ key: 'press', fetchPage: (c) => api.press(c), sentinel: pressSentinel });

// ---- Editing (admins) ----
const editing = computed(() => isAdmin.value && editMode.editing);
const exhibitions = ref<ExhibitionSummary[]>([]);
watch(
    editing,
    async (on) => {
        if (on && !exhibitions.value.length) exhibitions.value = await api.exhibitions();
    },
    { immediate: true },
);

async function handleRequest(kind: typeof editMode.request) {
    if (!kind || !editing.value || slug.value) return;
    editMode.request = null;
    const { adminApi } = await import('@/admin/api');
    if (kind === 'new-news') news.prepend(await adminApi.createNews({ title: 'New post' }));
    if (kind === 'new-press') {
        press.prepend(await adminApi.createPress({ outlet: 'Publication', title: 'Article title', url: 'https://example.com/', publishedOn: todayIso() }));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
watch(() => editMode.request, handleRequest, { immediate: true });

function onNewsUpdated(post: NewsPost) {
    news.replace((p) => p.id === post.id, post);
    if (single.data.value?.id === post.id) single.data.value = post;
}
function onNewsDeleted(id: string) {
    if (id === '__reload__') return void single.reload();
    news.replace((p) => p.id === id, null);
}

useMeta(() => {
    if (!slug.value) return { kind: 'static', path: '/news' };
    if (single.data.value) return { kind: 'news-item', post: single.data.value };
    if (single.notFound.value) return { kind: 'not-found', path: route.path };
    return null;
});
</script>

<template>
    <Error404 v-if="slug && single.notFound.value" />
    <div v-else class="container mx-auto text-sm py-4 px-3">
        <div class="grid md:grid-cols-2 md:gap-6 lg:grid-cols-3 lg:gap-10">
            <div v-if="!slug" class="text-justify mb-10">
                <h2 class="text-xl font-bold mb-3">Press</h2>
                <div class="border-t py-3">
                    <template v-if="editing">
                        <button type="button" class="admin-ui mb-3 text-xs text-sky-800 underline" @click="editMode.request = 'new-press'">+ Add press</button>
                        <EditablePressEntry
                            v-for="p in press.state.items"
                            :key="p.id"
                            :item="p"
                            :exhibitions="exhibitions"
                            @updated="(u) => press.replace((x) => x.id === u.id, u)"
                            @deleted="(id) => press.replace((x) => x.id === id, null)"
                        />
                    </template>
                    <PressEntry v-for="p in press.state.items" v-else :key="p.id" :item="p" />
                    <InfiniteFooter :list="press" label="press" />
                    <div ref="pressSentinel" aria-hidden="true" />
                </div>
            </div>
            <div class="text-justify posts" :class="{ 'md:col-span-2': slug }">
                <h2 class="text-xl font-bold mb-3">Gallery News</h2>
                <template v-if="slug">
                    <EditableNewsEntry v-if="single.data.value && editing" :key="single.data.value.updatedAt" :post="single.data.value" @updated="onNewsUpdated" @deleted="onNewsDeleted" />
                    <NewsEntry v-else-if="single.data.value" :post="single.data.value" />
                </template>
                <template v-else>
                    <template v-if="editing">
                        <button type="button" class="admin-ui mb-3 text-xs text-sky-800 underline" @click="editMode.request = 'new-news'">+ New post</button>
                        <EditableNewsEntry v-for="post in news.state.items" :key="`${post.id}-${post.updatedAt}`" :post="post" @updated="onNewsUpdated" @deleted="onNewsDeleted" />
                    </template>
                    <NewsEntry v-for="post in news.state.items" v-else :key="post.id" :post="post" />
                    <InfiniteFooter :list="news" label="posts" />
                    <div ref="newsSentinel" aria-hidden="true" />
                </template>
            </div>
            <MailSignUp />
        </div>
    </div>
</template>

<style>
@reference "@/style.css";
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
</style>
