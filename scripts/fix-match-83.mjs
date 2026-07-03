// One-off correction: Portugal–Croatie (#83) recorded 2-2 (a late goal was
// disallowed by VAR); the real score is 2-1. Recomputes points_log + the daily
// awards for the affected session, using the exact scoring rules of src/lib.
//
// Run: node --env-file=.env.local scripts/fix-match-83.mjs        (dry-run)
//      node --env-file=.env.local scripts/fix-match-83.mjs --apply (writes)

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const MATCH_ID = 83;
const NEW_HOME = 2;
const NEW_AWAY = 1;
const APPLY = process.argv.includes('--apply');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing Supabase env');
const supabase = createClient(url, key, { auth: { persistSession: false } });

const matches = JSON.parse(readFileSync(new URL('../src/data/matches.json', import.meta.url)));

// --- scoring (mirror of src/lib/scoring.ts) ---
const outcome = (h, a) => (h > a ? 'home' : a > h ? 'away' : 'draw');
function basePoints(p, r) {
  if (outcome(p.home_score, p.away_score) !== outcome(r.home, r.away)) return 0;
  if (p.home_score === r.home && p.away_score === r.away) return 3;
  if (p.home_score - p.away_score === r.home - r.away) return 2;
  return 1;
}
function detailFor(base, visionary) {
  const parts = [];
  if (base === 0) parts.push('Mauvais résultat');
  else if (base === 3) parts.push('Score exact (+3)');
  else if (base === 2) parts.push('Bon résultat + diff (+2)');
  else parts.push('Bon résultat (+1)');
  if (visionary) parts.push('Visionnaire (+1)');
  return parts.join(', ');
}

// --- competition day (mirror of src/lib/awards.ts) ---
function competitionDay(date, time) {
  const hour = parseInt(time.split(':')[0], 10);
  if (hour < 9) {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().split('T')[0];
  }
  return date;
}

async function recomputeDailyAwards(dateStr) {
  const matchIds = matches.filter((m) => competitionDay(m.date, m.time) === dateStr).map((m) => m.id);
  const { data: results } = await supabase.from('match_results').select('match_id').in('match_id', matchIds);
  const completed = (results || []).map((r) => r.match_id);
  const { data: pts } = await supabase.from('points_log').select('user_id, total_points').in('match_id', completed);

  const userPoints = {};
  for (const p of pts || []) userPoints[p.user_id] = (userPoints[p.user_id] || 0) + p.total_points;

  const values = Object.values(userPoints);
  if (values.length === 0) return { drere: [], mzi: [], userPoints };
  const maxPoints = Math.max(...values);
  const minPoints = Math.min(...values);
  const drere = maxPoints === 0 ? [] : Object.entries(userPoints).filter(([, v]) => v === maxPoints).map(([u]) => u);
  const mzi = minPoints < maxPoints ? Object.entries(userPoints).filter(([, v]) => v === minPoints).map(([u]) => u) : [];

  if (APPLY) {
    await supabase.from('daily_awards').delete().eq('award_date', dateStr).eq('award_type', 'drere');
    if (drere.length) await supabase.from('daily_awards').insert(drere.map((u) => ({ user_id: u, award_date: dateStr, award_type: 'drere', points_earned: maxPoints })));
    await supabase.from('daily_awards').delete().eq('award_date', dateStr).eq('award_type', 'mzi');
    if (mzi.length) await supabase.from('daily_awards').insert(mzi.map((u) => ({ user_id: u, award_date: dateStr, award_type: 'mzi', points_earned: minPoints })));
  }
  return { drere, mzi, maxPoints, minPoints, userPoints };
}

async function main() {
  const match = matches.find((m) => m.id === MATCH_ID);
  const dateStr = competitionDay(match.date, match.time);
  console.log(`Match #${MATCH_ID} — session ${dateStr} — new score ${NEW_HOME}-${NEW_AWAY} (${APPLY ? 'APPLY' : 'DRY-RUN'})\n`);

  const { data: preds } = await supabase.from('match_score_predictions').select('user_id, home_score, away_score').eq('match_id', MATCH_ID);
  const result = { home: NEW_HOME, away: NEW_AWAY };

  const exactCount = (preds || []).filter((p) => p.home_score === result.home && p.away_score === result.away).length;
  const rows = (preds || []).map((p) => {
    const base = basePoints(p, result);
    const isExact = p.home_score === result.home && p.away_score === result.away;
    const visionary = isExact && exactCount === 1 ? 1 : 0;
    return { user_id: p.user_id, match_id: MATCH_ID, base_points: base, visionary_bonus: visionary, total_points: base + visionary, detail: detailFor(base, visionary) };
  });

  console.log('New points_log for #83:');
  for (const r of rows.sort((a, b) => Number(a.user_id) - Number(b.user_id))) {
    const p = preds.find((x) => x.user_id === r.user_id);
    console.log(`  user ${r.user_id}  prono ${p.home_score}-${p.away_score}  ->  ${r.total_points} pt  (${r.detail})`);
  }

  console.log('\nAwards BEFORE:', JSON.stringify(await recomputeDailyAwardsReadonly(dateStr)));

  if (APPLY) {
    await supabase.from('match_results').upsert(
      { match_id: MATCH_ID, home_score: NEW_HOME, away_score: NEW_AWAY, source: 'admin', entered_by: null, entered_at: new Date().toISOString() },
      { onConflict: 'match_id' }
    );
    await supabase.from('points_log').delete().eq('match_id', MATCH_ID);
    if (rows.length) await supabase.from('points_log').insert(rows);
  }

  const awards = await recomputeDailyAwards(dateStr);
  console.log('Awards AFTER :', JSON.stringify({ drere: awards.drere, drerePts: awards.maxPoints, mzi: awards.mzi, mziPts: awards.minPoints }));
  console.log(`\n${APPLY ? '✅ Applied.' : '(dry-run — re-run with --apply to write)'}`);
}

// read-only award computation for the BEFORE snapshot (does not write)
async function recomputeDailyAwardsReadonly(dateStr) {
  const { data } = await supabase.from('daily_awards').select('award_type, user_id, points_earned').eq('award_date', dateStr);
  return data;
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
