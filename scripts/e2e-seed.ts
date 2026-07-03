/**
 * Idempotent E2E / integration seed for the TEST Supabase project ONLY.
 *
 * Fixes the recurring fixture drift (see AGENTS.md) that broke the suite:
 *  - the 14 team members exist with pin_hash = bcrypt('1234') so quickLogin works,
 *  - the 3 vitest fixtures (test-user-1/2/3) exist with the exact shape the
 *    integration tests assert.
 *
 * Runs from Playwright globalSetup AND vitest globalSetup — re-running is safe.
 * Guarded to REFUSE any non-test database (never touches production).
 */
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

const TEST_REF = 'cmigotevaosnhjqxmoqe'; // ZbrePlanning TEST project
const PROD_REF = 'wsimtsbtiijcyvgzavlp'; // ZbrePlanning production — must NEVER be seeded

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Members must match src/data/members.ts / e2e/helpers.ts.
const MEMBERS = [
  { id: '1', name: 'Benjamin Oyowe', slug: 'benjamin-oyowe' },
  { id: '2', name: 'Edu Rodger Martinez', slug: 'edu-rodger-martinez' },
  { id: '3', name: 'Gregory Longueville', slug: 'gregory-longueville' },
  { id: '4', name: 'Ian Poznanski', slug: 'ian-poznanski' },
  { id: '5', name: 'Kevin Nounomo', slug: 'kevin-nounomo' },
  { id: '6', name: 'Killian Bohan', slug: 'killian-bohan' },
  { id: '7', name: 'Lionel Holzapfel', slug: 'lionel-holzapfel' },
  { id: '8', name: 'Martin Bracken', slug: 'martin-bracken' },
  { id: '9', name: 'Maximilien Piquet', slug: 'maximilien-piquet' },
  { id: '10', name: 'Nicolas Reuter', slug: 'nicolas-reuter' },
  { id: '11', name: 'Ramzi Lahouegue', slug: 'ramzi-lahouegue' },
  { id: '12', name: 'Ruairi Doyle', slug: 'ruairi-doyle' },
  { id: '13', name: 'Sacha Convens', slug: 'sacha-convens' },
  { id: '14', name: 'Sam Spinnael', slug: 'sam-spinnael' },
];

// Vitest fixtures — shape asserted verbatim in tests/db-connection.test.ts.
const TEST_USERS = [
  { id: 'test-user-1', email: 'test1@zbreplanning.test', member_name: 'Test User Alpha', is_admin: true },
  { id: 'test-user-2', email: 'test2@zbreplanning.test', member_name: 'Test User Beta', is_admin: false },
  { id: 'test-user-3', email: 'test3@zbreplanning.test', member_name: 'Test User Gamma', is_admin: false },
];

export async function seed(): Promise<void> {
  if (!url || !serviceKey) throw new Error('e2e-seed: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants (.env.test)');
  if (url.includes(PROD_REF)) throw new Error('e2e-seed REFUSÉ : URL de PRODUCTION détectée.');
  if (!url.includes(TEST_REF)) throw new Error(`e2e-seed REFUSÉ : URL non-TEST (${url}). Attendu: *${TEST_REF}*.`);

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const pinHash = await bcrypt.hash('1234', 10);

  const memberRows = MEMBERS.map((m) => ({
    id: m.id,
    email: `${m.slug}@zbre.team`,
    member_id: m.id,
    member_name: m.name,
    member_slug: m.slug,
    pin_hash: pinHash,
    is_admin: m.id === '7',
  }));

  const testRows = TEST_USERS.map((u) => ({
    id: u.id,
    email: u.email,
    member_id: u.id,
    member_name: u.member_name,
    member_slug: u.id,
    pin_hash: null,
    is_admin: u.is_admin,
  }));

  const { error: e1 } = await supabase.from('users').upsert(memberRows, { onConflict: 'id' });
  if (e1) throw new Error(`e2e-seed members: ${e1.message}`);
  const { error: e2 } = await supabase.from('users').upsert(testRows, { onConflict: 'id' });
  if (e2) throw new Error(`e2e-seed test-users: ${e2.message}`);

  console.log(`✅ e2e-seed: ${memberRows.length} membres (PIN 1234) + ${testRows.length} test-users → ${TEST_REF}`);
}

// Allow running standalone: `npx tsx scripts/e2e-seed.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  seed().catch((e) => { console.error('e2e-seed failed:', e); process.exit(1); });
}
