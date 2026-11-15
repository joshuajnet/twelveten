import { defineProject } from 'vitest/config';

export default defineProject({
    test: {
        name: 'api',
        include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
        // Integration tests share one Postgres database; run files one at a time.
        fileParallelism: false,
        setupFiles: ['test/setup-env.ts'],
    },
});
