#!/usr/bin/env npx tsx

/**
 * Database Health Check Script
 * Run with: npx tsx scripts/check-db.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
config({ path: '.env.local' });

const REQUIRED_TABLES = [
  'users',
  'activities',
  'activity_participations',
  'match_participations',
  'watch_locations',
  'notifications',
  'predictions',
  'match_score_predictions',
  'match_results',
];

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'JWT_SECRET',
];

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
}

const results: CheckResult[] = [];

function log(result: CheckResult) {
  const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
  console.log(`${icon} ${result.name}: ${result.message}`);
  results.push(result);
}

async function main() {
  console.log('\n🔍 ZbrePlanning Database Health Check\n');
  console.log('=' .repeat(50));

  // Check environment variables
  console.log('\n📋 Environment Variables:\n');

  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar];
    if (!value) {
      log({ name: envVar, status: 'fail', message: 'Missing' });
    } else if (envVar === 'JWT_SECRET' && value === 'dev-secret-change-in-prod') {
      log({ name: envVar, status: 'warn', message: 'Using default dev secret (change in production!)' });
    } else {
      const masked = value.substring(0, 10) + '...';
      log({ name: envVar, status: 'pass', message: `Set (${masked})` });
    }
  }

  // Check Supabase connection
  console.log('\n🔌 Supabase Connection:\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    log({ name: 'Connection', status: 'fail', message: 'Cannot connect - missing credentials' });
    printSummary();
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Test connection with a simple query
    const { error: connError } = await supabase.from('users').select('id').limit(1);

    if (connError && connError.code !== 'PGRST116') {
      // PGRST116 = no rows returned, which is fine
      if (connError.message.includes('relation') && connError.message.includes('does not exist')) {
        log({ name: 'Connection', status: 'warn', message: 'Connected but users table missing' });
      } else {
        log({ name: 'Connection', status: 'fail', message: connError.message });
      }
    } else {
      log({ name: 'Connection', status: 'pass', message: 'Connected successfully' });
    }
  } catch (err) {
    log({ name: 'Connection', status: 'fail', message: `Error: ${err}` });
    printSummary();
    process.exit(1);
  }

  // Check tables
  console.log('\n📊 Tables:\n');

  for (const table of REQUIRED_TABLES) {
    try {
      const { error } = await supabase.from(table).select('id').limit(1);

      if (error) {
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          log({ name: table, status: 'fail', message: 'Table does not exist' });
        } else if (error.code === 'PGRST116') {
          // No rows - table exists but is empty
          log({ name: table, status: 'pass', message: 'Exists (empty)' });
        } else if (error.code === '42501') {
          // Permission denied - table exists but RLS blocking
          log({ name: table, status: 'pass', message: 'Exists (RLS active)' });
        } else {
          log({ name: table, status: 'warn', message: error.message });
        }
      } else {
        log({ name: table, status: 'pass', message: 'Exists' });
      }
    } catch (err) {
      log({ name: table, status: 'fail', message: `Error: ${err}` });
    }
  }

  // Check specific columns for new tables
  console.log('\n🔐 Auth columns (users table):\n');

  try {
    const { data, error } = await supabase
      .from('users')
      .select('pin_hash, is_admin')
      .limit(1);

    if (error) {
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        log({ name: 'users.pin_hash', status: 'fail', message: 'Column missing' });
        log({ name: 'users.is_admin', status: 'fail', message: 'Column missing' });
      } else {
        log({ name: 'Auth columns', status: 'warn', message: error.message });
      }
    } else {
      log({ name: 'users.pin_hash', status: 'pass', message: 'Column exists' });
      log({ name: 'users.is_admin', status: 'pass', message: 'Column exists' });
    }
  } catch (err) {
    log({ name: 'Auth columns', status: 'fail', message: `Error: ${err}` });
  }

  printSummary();
}

function printSummary() {
  console.log('\n' + '=' .repeat(50));
  console.log('\n📊 Summary:\n');

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warned = results.filter(r => r.status === 'warn').length;

  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ⚠️  Warnings: ${warned}`);
  console.log(`   ❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log('\n⚠️  Some checks failed. Run the migration SQL to fix missing tables/columns.\n');
    process.exit(1);
  } else if (warned > 0) {
    console.log('\n⚠️  Some warnings. Review before deploying to production.\n');
    process.exit(0);
  } else {
    console.log('\n✅ All checks passed! Database is ready.\n');
    process.exit(0);
  }
}

main().catch(console.error);
