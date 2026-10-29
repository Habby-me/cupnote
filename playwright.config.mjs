import { defineConfig, devices } from 'playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5175',
    trace: 'retain-on-failure',
    launchOptions: process.env.CUPNOTE_CHROME_PATH ? { executablePath: process.env.CUPNOTE_CHROME_PATH } : {}
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }
  ],
  webServer: {
    command: 'node server.mjs',
    url: 'http://127.0.0.1:5175',
    env: { PORT: '5175' },
    reuseExistingServer: !process.env.CI
  }
});
