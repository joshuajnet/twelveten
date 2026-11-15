import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { closeDb } from './db/index.ts';
import { appDeps } from './services.ts';
import { config } from './config.ts';

const { PORT } = config();
const server = serve({ fetch: createApp(appDeps()).fetch, port: PORT }, (info) => {
    console.log(`API listening on http://localhost:${info.port}/api`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
        server.close();
        void closeDb().finally(() => process.exit(0));
    });
}
