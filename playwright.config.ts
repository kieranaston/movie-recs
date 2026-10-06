import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false, // one shared seeded database
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Requires `npm run build` first (the `test:e2e` script does it).
    command: 'npx tsx tests/e2e/server.ts',
    url: `http://localhost:${PORT}`,
    timeout: 120_000,
    reuseExistingServer: false,
    stdout: 'pipe',
  },
});
