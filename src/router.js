import { createRouter, createWebHistory } from 'vue-router';

import Home from './pages/Home.vue';
import About from './pages/About.vue';
import Exhibitions from './pages/Exhibitions.vue';
import Speedrunners from './pages/exhibitions/Speedrunners.vue';
import BulletHell from './pages/exhibitions/BulletHell.vue';
import DelphicFuture from './pages/exhibitions/DelphicFuture.vue';
import TheVeil from './pages/exhibitions/TheVeil.vue';
import BrainWorms from './pages/exhibitions/BrainWorms.vue';
import BeechInterview from './pages/documents/BeechInterview.vue';
import News from './pages/News.vue';
import Error404 from './pages/Error404.vue';

export default createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/',
            name: 'home',
            component: Home,
        },
        {
            path: '/about',
            name: 'about',
            component: About,
        },
        {
            path: '/documents/beech-von-sternberg-interview',
            name: 'beech-von-sternberg-interview',
            component: BeechInterview,
        },
        {
            path: '/exhibitions',
            name: 'exhibitions',
            component: Exhibitions,
        },
        {
            path: '/exhibitions/speedrunners',
            name: 'speedrunners',
            component: Speedrunners,
        },
        {
            path: '/exhibitions/bullet-hell',
            name: 'bullet-hell',
            component: BulletHell,
        },
        {
            path: '/exhibitions/beech-delphic-future',
            name: 'delphic-future',
            component: DelphicFuture,
        },
        {
            path: '/the-veil',
            redirect: {
                name: 'the-veil'
            }
        },
        {
            path: '/exhibitions/the-vei',
            redirect: {
                name: 'the-veil'
            }
        },
        {
            path: '/exhibitions/the-veil',
            name: 'the-veil',
            component: TheVeil,
        },
        {
            path: '/exhibitions/brain-worms',
            name: 'brain-worms',
            component: BrainWorms,
        },
        {
            path: '/news',
            name: 'news',
            component: News,
        },
        {
            path: '/news/:path',
            name: 'news-item',
            component: News,
        },
        {
            path: '/:pathMatch(.*)*',
            name: 'error404',
            component: Error404,
        },
    ],
});
