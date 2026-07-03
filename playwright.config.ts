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
    baseURL: 'http://localhost:3003',
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

  // Production build + start, with .env.test injected into BOTH build (bakes the
  // test NEXT_PUBLIC_* → client bundles hit the TEST project) and start (server
  // env). Without this the app would serve with .env.local and hit production.
  webServer: {
    command: "env $(grep -v '^#' .env.test | grep -v '^$' | xargs) bash -c 'npm run build && npm run start -- --port 3003'",
    url: 'http://localhost:3003',
    reuseExistingServer: !process.env.CI,
    timeout: 180000, // Build can take time
  },
});
