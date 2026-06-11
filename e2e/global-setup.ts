/**
 * Playwright Global Setup
 *
 * CRITICAL: Prevents tests from running against production Supabase
 * ALWAYS blocks production unless ALLOW_PROD_TESTS=1 is set
 */

import { FullConfig } from '@playwright/test';

// Known production Supabase URLs - add any production project URLs here
const PROD_SUPABASE_URLS = [
  'wsimtsbtiijcyvgzavlp.supabase.co', // ZbrePlanning production
];

export default async function globalSetup(config: FullConfig) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const allowProdTests = process.env.ALLOW_PROD_TESTS === '1';

  // Check if this is a production Supabase instance
  const isProdSupabase = PROD_SUPABASE_URLS.some(prodUrl =>
    supabaseUrl.includes(prodUrl)
  );

  // ALWAYS block production tests unless explicitly allowed
  if (isProdSupabase && !allowProdTests) {
    console.error('\n');
    console.error('╔══════════════════════════════════════════════════════════════╗');
    console.error('║  🚫 TESTS BLOCKED: Production Supabase Detected!             ║');
    console.error('╠══════════════════════════════════════════════════════════════╣');
    console.error('║                                                              ║');
    console.error('║  Tests are attempting to run against PRODUCTION database:   ║');
    console.error(`║  ${supabaseUrl.slice(0, 50).padEnd(50)}    ║`);
    console.error('║                                                              ║');
    console.error('║  This WILL pollute production data. Tests refused.          ║');
    console.error('║                                                              ║');
    console.error('║  Solutions:                                                  ║');
    console.error('║  1. Create .env.test with test Supabase project              ║');
    console.error('║  2. Run: ALLOW_PROD_TESTS=1 npx playwright test (RISKY!)     ║');
    console.error('║                                                              ║');
    console.error('╚══════════════════════════════════════════════════════════════╝');
    console.error('\n');

    throw new Error(
      'Tests blocked: Production Supabase detected. ' +
      'Set ALLOW_PROD_TESTS=1 to override (creates test data in prod).'
    );
  }

  if (isProdSupabase && allowProdTests) {
    console.warn('\n');
    console.warn('⚠️  WARNING: Running tests against PRODUCTION Supabase!');
    console.warn('   ALLOW_PROD_TESTS=1 is set. Test data will be created.');
    console.warn('   Run cleanup SQL afterward to remove [E2E-TEST] data.');
    console.warn('\n');
  }

  // Set test mode flag for the app to use
  process.env.E2E_TEST_MODE = '1';

  console.log('✅ Global setup complete');
  console.log(`   Supabase: ${supabaseUrl ? supabaseUrl.slice(8, 40) + '...' : '(not set)'}`);
  console.log(`   Production: ${isProdSupabase ? 'YES' : 'no'}`);
  console.log(`   Allow prod tests: ${allowProdTests ? 'YES' : 'no'}`);
}
