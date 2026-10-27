const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  globalTimeout: 8 * 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'https://avvmatteosenesi-afk.github.io/Carburanti/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...devices['iPhone 13'],
    geolocation: { latitude: 43.9022, longitude: 11.0069 },
    permissions: ['geolocation'],
    locale: 'it-IT'
  },
  projects: [{ name: 'mobile-webkit', use: { ...devices['iPhone 13'] } }]
});
