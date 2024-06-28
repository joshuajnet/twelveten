import { createApp } from 'vue';
import VueLazyLoad from 'vue3-lazyload'
import './style.css';
import App from './App.vue';
import router from './router.js';

createApp(App).use(VueLazyLoad).use(router).mount('#app');
