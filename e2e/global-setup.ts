/**
 * Playwright Global Setup
 *
 * CRITICAL: Prevents tests from running against production Supabase
 * unless explicitly allowed with ALLOW_PROD_TESTS=1
 */

import { FullConfig } from '@playwright/test';

// Known production Supabase URLs - add any production project URLs here
const PROD_SUPABASE_URLS = [
  'wsimtsbtiijcyvgzavlp.supabase.co', // ZbrePlanning production
];

export default async function globalSetup(config: FullConfig) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const isCI = !!process.env.CI;
  const isLocalDev = !isCI && config.webServer?.command?.includes('npm run dev');

  // Check if this is a production Supabase instance
  const isProdSupabase = PROD_SUPABASE_URLS.some(prodUrl =>
    supabaseUrl.includes(prodUrl)
  );

  // In CI with production Supabase: BLOCK unless explicitly allowed
  // In local dev: WARN but allow (developer knows what they're doing)
  if (isProdSupabase && isCI && process.env.ALLOW_PROD_TESTS !== '1') {
    console.error('\n');
    console.error('╔══════════════════════════════════════════════════════════════╗');
    console.error('║  🚫 CI TESTS BLOCKED: Production Supabase Detected!          ║');
    console.error('╠══════════════════════════════════════════════════════════════╣');
    console.error('║                                                              ║');
    console.error('║  CI is attempting to run tests against PRODUCTION database.  ║');
    console.error('║  This would pollute production data.                         ║');
    console.error('║                                                              ║');
    console.error('║  Options:                                                    ║');
    console.error('║  1. Use a separate test Supabase project for CI              ║');
    console.error('║  2. Set ALLOW_PROD_TESTS=1 in CI env (not recommended)       ║');
    console.error('║                                                              ║');
    console.error('╚══════════════════════════════════════════════════════════════╝');
    console.error('\n');

    throw new Error(
      'CI tests refused to run against production Supabase. ' +
      'Configure a test Supabase project or set ALLOW_PROD_TESTS=1.'
    );
  }

  if (isProdSupabase && isLocalDev) {
    console.warn('\n');
    console.warn('⚠️  Local dev testing against PRODUCTION Supabase');
    console.warn('   Test data will be prefixed with [E2E-TEST] for easy cleanup.');
    console.warn('   Run supabase-cleanup-test-data.sql periodically to clean up.');
    console.warn('\n');
  }

  // Set test mode flag for the app to use
  process.env.E2E_TEST_MODE = '1';

  console.log('✅ Global setup complete');
}
