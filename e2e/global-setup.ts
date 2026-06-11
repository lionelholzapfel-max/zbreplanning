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

  // Check if this is a production Supabase instance
  const isProdSupabase = PROD_SUPABASE_URLS.some(prodUrl =>
    supabaseUrl.includes(prodUrl)
  );

  if (isProdSupabase && process.env.ALLOW_PROD_TESTS !== '1') {
    console.error('\n');
    console.error('╔══════════════════════════════════════════════════════════════╗');
    console.error('║  🚫 TESTS BLOCKED: Production Supabase Detected!             ║');
    console.error('╠══════════════════════════════════════════════════════════════╣');
    console.error('║                                                              ║');
    console.error('║  The Supabase URL points to PRODUCTION database.             ║');
    console.error('║  Running tests would pollute production data.                ║');
    console.error('║                                                              ║');
    console.error('║  Options:                                                    ║');
    console.error('║  1. Use a local Supabase instance for testing                ║');
    console.error('║  2. Create a separate test project in Supabase               ║');
    console.error('║  3. Set ALLOW_PROD_TESTS=1 if you really need this           ║');
    console.error('║                                                              ║');
    console.error('╚══════════════════════════════════════════════════════════════╝');
    console.error('\n');

    throw new Error(
      'E2E tests refused to run against production Supabase. ' +
      'Set ALLOW_PROD_TESTS=1 to override (not recommended).'
    );
  }

  if (isProdSupabase && process.env.ALLOW_PROD_TESTS === '1') {
    console.warn('\n');
    console.warn('⚠️  WARNING: Running tests against PRODUCTION Supabase!');
    console.warn('    Test data will be prefixed with [E2E-TEST] for cleanup.');
    console.warn('\n');
  }

  // Set test mode flag for the app to use
  process.env.E2E_TEST_MODE = '1';

  console.log('✅ Global setup complete');
}
