import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { closeDb, db } from './db/index.ts';
import { createAuth } from './auth/auth.ts';
import { config } from './config.ts';

const { PORT } = config();
const server = serve({ fetch: createApp({ db, auth: createAuth({ db: db() }) }).fetch, port: PORT }, (info) => {
    console.log(`API listening on http://localhost:${info.port}/api`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
        server.close();
        void closeDb().finally(() => process.exit(0));
    });
}
