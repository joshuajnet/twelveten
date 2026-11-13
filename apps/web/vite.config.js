import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import metaPlugin from './vite/metaPlugin.js';
import mediaPlugin from './vite/mediaPlugin.js';

const apiTarget = process.env.API_TARGET ?? 'http://localhost:3000';
// Media bucket (LocalStack locally) mounted at /media, matching CloudFront's /media/* behaviour.
const mediaTarget = process.env.MEDIA_TARGET ?? 'http://localhost:4566';
const mediaBucket = process.env.MEDIA_BUCKET ?? 'twelveten-local-media';

const proxy = {
    '/api': { target: apiTarget, changeOrigin: false, xfwd: true },
    // New uploads live in the (LocalStack) media bucket; existing media is served from .media/ by mediaPlugin.
    '/media/uploads': { target: mediaTarget, changeOrigin: true, rewrite: (path) => `/${mediaBucket}${path}` },
};

export default defineConfig({
    // Absolute URLs (/media/...) are served at runtime, not bundled.
    plugins: [vue({ template: { transformAssetUrls: { includeAbsolute: false } } }), tailwindcss(), metaPlugin({ apiTarget }), mediaPlugin({ dir: fileURLToPath(new URL('../../.media', import.meta.url)) })],
    resolve: {
        alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    // Same-origin API and media in development, matching CloudFront in production.
    server: { proxy },
    preview: { proxy },
});
