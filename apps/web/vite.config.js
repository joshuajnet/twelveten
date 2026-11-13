import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

const apiTarget = process.env.API_TARGET ?? 'http://localhost:3000';
// Media bucket (LocalStack locally) mounted at /media, matching CloudFront's /media/* behaviour.
const mediaTarget = process.env.MEDIA_TARGET ?? 'http://localhost:4566';
const mediaBucket = process.env.MEDIA_BUCKET ?? 'twelveten-local-media';

const proxy = {
    '/api': { target: apiTarget, changeOrigin: false, xfwd: true },
    '/media': { target: mediaTarget, changeOrigin: true, rewrite: (path) => `/${mediaBucket}${path}` },
};

export default defineConfig({
    plugins: [vue(), tailwindcss()],
    resolve: {
        alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    // Same-origin API and media in development, matching CloudFront in production.
    server: { proxy },
    preview: { proxy },
});
