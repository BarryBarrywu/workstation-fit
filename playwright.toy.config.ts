import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/toy-browser',
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4322/toy/jiuwei/',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium', viewport: { width: 375, height: 812 } } },
  ],
  webServer: {
    command: 'npm run build:toy && node scripts/serve-toy.mjs',
    url: 'http://127.0.0.1:4322/toy/jiuwei/index.html',
    reuseExistingServer: false,
  },
});
