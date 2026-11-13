import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { REDIRECTS } from '@twelveten/shared';

// vue-router param regexes cannot contain repeat groups; the API validates slugs fully.
const SLUG = ':slug([a-z0-9][a-z0-9-]*)';

const routes: RouteRecordRaw[] = [
    { path: '/', name: 'home', component: () => import('./pages/Home.vue') },
    { path: '/about', name: 'about', component: () => import('./pages/About.vue') },
    { path: '/exhibitions', name: 'exhibitions', component: () => import('./pages/Exhibitions.vue') },
    { path: `/exhibitions/${SLUG}`, name: 'exhibition', component: () => import('./pages/ExhibitionDetail.vue') },
    { path: '/fairs', name: 'fairs', component: () => import('./pages/Fairs.vue') },
    { path: `/fairs/${SLUG}`, name: 'fair', component: () => import('./pages/ExhibitionDetail.vue') },
    { path: '/news', name: 'news', component: () => import('./pages/News.vue') },
    { path: `/news/${SLUG}`, name: 'news-item', component: () => import('./pages/News.vue') },
    {
        path: '/documents/beech-von-sternberg-interview',
        name: 'beech-von-sternberg-interview',
        component: () => import('./pages/documents/BeechInterview.vue'),
    },
    { path: '/admin', redirect: '/admin/login' },
    { path: '/admin/login', name: 'admin-login', component: () => import('./pages/AdminLogin.vue') },
    ...Object.entries(REDIRECTS).map(([path, redirect]) => ({ path, redirect })),
    { path: '/:pathMatch(.*)*', name: 'error404', component: () => import('./pages/Error404.vue') },
];

export default createRouter({
    history: createWebHistory(),
    routes,
    scrollBehavior(to, from, saved) {
        // Lists restore their own scroll position (see useInfiniteList).
        if (saved) return saved;
        if (to.path === from.path) return false;
        return { left: 0, top: 0 };
    },
});
