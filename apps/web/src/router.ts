import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { REDIRECTS } from '@twelveten/shared';
import { isAdmin, loadSession, session } from './session';

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
    { path: '/admin/login', name: 'admin-login', component: () => import('./pages/AdminLogin.vue') },
    {
        // Back office: admin-only, its own layout and lazy chunk.
        path: '/admin',
        component: () => import('./backoffice/BackofficeLayout.vue'),
        meta: { backoffice: true },
        beforeEnter: async (to) => {
            if (!session.user) await loadSession(true);
            if (!isAdmin.value) return { name: 'admin-login', query: { next: to.fullPath } };
            return true;
        },
        children: [
            { path: '', redirect: { name: 'bo-people' } },
            { path: 'people', name: 'bo-people', component: () => import('./backoffice/PeopleList.vue') },
            { path: 'people/:id/:profile?', name: 'bo-person', component: () => import('./backoffice/PersonPage.vue') },
            { path: 'inventory', name: 'bo-inventory', component: () => import('./backoffice/InventoryList.vue') },
            { path: 'works/:id', name: 'bo-work', component: () => import('./backoffice/WorkDetail.vue') },
            { path: 'invoices', name: 'bo-invoices', component: () => import('./backoffice/InvoicesList.vue') },
            { path: 'invoices/new', name: 'bo-invoice-new', component: () => import('./backoffice/InvoiceNew.vue') },
            { path: 'invoices/settings', name: 'bo-invoice-settings', component: () => import('./backoffice/InvoiceSettings.vue') },
            { path: 'invoices/:id', name: 'bo-invoice', component: () => import('./backoffice/InvoicePage.vue') },
        ],
    },
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
        // Switching tabs on a person keeps the scroll position.
        if (to.name === 'bo-person' && from.name === 'bo-person' && to.params.id === from.params.id) return false;
        return { left: 0, top: 0 };
    },
});
