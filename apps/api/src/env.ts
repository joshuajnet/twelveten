import type { DB } from './db/index.ts';

/** Per-request context shared by all routes. */
export interface AppEnv {
    Variables: {
        db: DB;
        /** True when the request carries an admin session. */
        isAdmin: boolean;
        userId: string | null;
    };
}
