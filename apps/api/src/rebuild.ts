import { appDeps } from './services.ts';

const deps = appDeps();

/**
 * Lambda: re-render every page. Runs daily (Current / Upcoming / Past changes as dates pass)
 * and after each site deploy (`sls invoke -f rebuild`).
 */
export async function handler() {
    return deps.publisher!.rebuildAll();
}
