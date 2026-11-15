import { defineProject, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

export default mergeConfig(
    viteConfig,
    defineProject({
        test: {
            name: 'web',
            environment: 'happy-dom',
            include: ['src/**/*.test.{js,ts}'],
        },
    }),
);
