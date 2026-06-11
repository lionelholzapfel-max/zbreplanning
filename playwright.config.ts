import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Limit workers locally to avoid overwhelming the dev server
  // CI uses 1 worker, local uses 2 (enough for speed without compilation issues)
  workers: process.env.CI ? 1 : 2,
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

  // Run production build before tests (no on-demand compilation)
  webServer: {
    command: 'npm run build && npm run start -- --port 3002',
    url: 'http://localhost:3002',
    reuseExistingServer: !process.env.CI,
    timeout: 180000, // Build can take time
  },
});
