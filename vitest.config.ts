import { defineConfig } from 'vitest/config';
import path from 'path';
import dotenv from 'dotenv';

// Load .env.test for test environment
dotenv.config({ path: '.env.test' });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Seed the TEST database (idempotent) before the suite runs.
    globalSetup: './scripts/vitest-global-setup.ts',
    // Ensure .env.test is loaded
    env: {
      ...dotenv.config({ path: '.env.test' }).parsed,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
