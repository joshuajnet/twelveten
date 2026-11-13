import { defineConfig, devices } from '@playwright/test';

// Local admin credentials (written by `npm run dev`) for the editing tests.
try {
    process.loadEnvFile('.env.local');
} catch {
    // CI provides env vars directly
}

const port = Number(process.env.E2E_PORT ?? 4173);

export default defineConfig({
    testDir: './e2e',
    snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
    fullyParallel: true,
    reporter: [['list']],
    expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
    use: { baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${port}` },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testMatch: /visual\/.*\.spec\.ts/ },
        { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /visual\/.*\.spec\.ts/ },
        { name: 'admin-setup', use: { ...devices['Desktop Chrome'] }, testMatch: /editing\/auth\.setup\.ts/ },
        { name: 'editing', use: { ...devices['Desktop Chrome'] }, testMatch: /editing\/.*\.spec\.ts/, dependencies: ['admin-setup', 'desktop', 'mobile'] },
    ],
    webServer: process.env.E2E_BASE_URL
        ? undefined
        : {
              command: process.env.E2E_SERVER_CMD ?? `npm run preview -w apps/web -- --port ${port} --strictPort`,
              port,
              reuseExistingServer: true,
          },
});
