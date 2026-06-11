import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 30000,

  // Global setup: blocks tests from running against production Supabase
  globalSetup: './e2e/global-setup.ts',

  use: {
    baseURL: 'http://localhost:3002',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 }, // iPhone 14 size but using chromium
      },
      grep: /@mobile/,
    },
  ],

  // Run local dev server before tests on port 3002
  webServer: {
    command: 'npm run dev -- --port 3002',
    url: 'http://localhost:3002',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
