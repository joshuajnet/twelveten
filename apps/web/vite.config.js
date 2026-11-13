import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

const apiTarget = process.env.API_TARGET ?? 'http://localhost:3000';

export default defineConfig({
    plugins: [vue(), tailwindcss()],
    resolve: {
        alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
        proxy: {
            // Same-origin API in development, matching CloudFront's /api/* behaviour in production.
            '/api': { target: apiTarget, changeOrigin: false },
        },
    },
    preview: {
        proxy: {
            '/api': { target: apiTarget, changeOrigin: false },
        },
    },
});
