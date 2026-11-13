import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 4173);

export default defineConfig({
    testDir: './e2e',
    snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
    fullyParallel: true,
    reporter: [['list']],
    expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
    use: { baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${port}` },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
        { name: 'mobile', use: { ...devices['Pixel 7'] } },
    ],
    webServer: process.env.E2E_BASE_URL
        ? undefined
        : {
              command: process.env.E2E_SERVER_CMD ?? `npx vite preview --port ${port} --strictPort`,
              port,
              reuseExistingServer: true,
          },
});
