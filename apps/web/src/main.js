import { createApp } from 'vue';
import { createHead } from '@unhead/vue/client';
import './style.css';
import App from './App.vue';
import router from './router';

// Images in rendered rich text point at derivatives (srcset); if one hasn't been made yet, show the
// original instead (`data-original`). ArtImage handles its own fallback.
document.addEventListener(
    'error',
    (e) => {
        const img = e.target;
        if (!(img instanceof HTMLImageElement) || !img.dataset.original) return;
        img.removeAttribute('srcset');
        img.removeAttribute('sizes');
        img.src = img.dataset.original;
        delete img.dataset.original;
    },
    true,
);

createApp(App).use(createHead()).use(router).mount('#app');
