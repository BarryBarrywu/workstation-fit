import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/xhs-browser',
  timeout: 30_000,
  workers: 1,
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'compact-mobile', use: { browserName: 'chromium', viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } },
    { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium', viewport: { width: 390, height: 844 } } },
  ],
});
