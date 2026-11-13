import { createApp } from 'vue';
import { createHead } from '@unhead/vue/client';
import VueLazyLoad from 'vue3-lazyload';
import './style.css';
import App from './App.vue';
import router from './router';

createApp(App).use(createHead()).use(VueLazyLoad).use(router).mount('#app');
