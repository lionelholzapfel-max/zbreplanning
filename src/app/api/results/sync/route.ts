import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/auth/session';
import { getMatchById, parseMatchTeams } from '@/lib/matches';
import { calculateMatchPoints, Prediction, MatchResult, PointsBreakdown } from '@/lib/scoring';
import { MEMBERS } from '@/data/members';
import {
  fetchWorldCupMatches,
  findOurMatchId,
  getFinalScore,
  testApiConnection,
  apiTeamNameToOurs,
  ApiMatch,
  MatchScore,
} from '@/lib/football-api';
import matches from '@/data/matches.json';

// For knockout matches, find by team overrides since our match names are placeholders
async function findKnockoutMatchId(
  apiMatch: ApiMatch,
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<number | null> {
  // Skip if teams are not determined
  if (!apiMatch.homeTeam?.name || !apiMatch.awayTeam?.name) return null;

  // Convert API team names to our French names
  const homeTeam = apiTeamNameToOurs(apiMatch.homeTeam.name) || apiMatch.homeTeam.name;
  const awayTeam = apiTeamNameToOurs(apiMatch.awayTeam.name) || apiMatch.awayTeam.name;

  // Find match in overrides by team names
  const { data: overrides } = await supabase
    .from('match_team_overrides')
    .select('match_id, home_team, away_team')
    .or(`home_team.ilike.${homeTeam},home_team.ilike.${apiMatch.homeTeam.name}`);

  if (!overrides || overrides.length === 0) return null;

  // Find exact match (both home and away teams match)
  for (const override of overrides) {
    const homeMatch = override.home_team.toLowerCase() === homeTeam.toLowerCase() ||
                      override.home_team.toLowerCase() === apiMatch.homeTeam.name.toLowerCase();
    const awayMatch = override.away_team.toLowerCase() === awayTeam.toLowerCase() ||
                      override.away_team.toLowerCase() === apiMatch.awayTeam.name.toLowerCase();
    if (homeMatch && awayMatch) {
      return override.match_id;
    }
  }

  return null;
}

// Verify cron secret for security (supports both header and Vercel cron)
function verifyCronSecret(request: NextRequest): boolean {
  // Check Vercel cron header FIRST (automatic cron calls)
  // Vercel sets this header for cron jobs
  const vercelCron = request.headers.get('x-vercel-cron');
  if (vercelCron) return true;

  // Check Authorization header (manual calls) - requires CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) return true;

  return false;
}

interface SyncResult {
  matchId: number;
  matchName: string;
  homeScore: number;
  awayScore: number;
  hadExtraTime: boolean;
  source: 'auto';
  pointsCalculated: number;
}

interface SyncResponse {
  success: boolean;
  timestamp: string;
  apiConnected: boolean;
  matchesChecked: number;
  newResultsSynced: SyncResult[];
  alreadySynced: number;
  errors: string[];
}

// GET /api/results/sync - Vercel cron calls this with GET
// Always run the sync (idempotent - safe to call multiple times)
export async function GET() {
  return runSync();
}

// POST /api/results/sync - Run sync (protected by CRON_SECRET for manual calls)
export async function POST(request: NextRequest) {
  // Verify cron secret for manual POST calls
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized - invalid CRON_SECRET' },
      { status: 401 }
    );
  }

  return runSync();
}

// Shared sync logic for both GET (cron) and POST (manual)
async function runSync() {

  const response: SyncResponse = {
    success: true,
    timestamp: new Date().toISOString(),
    apiConnected: false,
    matchesChecked: 0,
    newResultsSynced: [],
    alreadySynced: 0,
    errors: [],
  };

  const supabase = getSupabaseAdmin();

  try {
    // 1. Fetch finished matches from football-data.org
    let apiMatches: ApiMatch[] = [];
    try {
      apiMatches = await fetchWorldCupMatches({ status: 'FINISHED' });
      response.apiConnected = true;
      response.matchesChecked = apiMatches.length;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'API connection failed';
      response.errors.push(`API Error: ${msg}`);
      response.success = false;

      // Log the failed sync attempt
      await supabase.from('sync_log').insert({
        success: false,
        matches_synced: 0,
        error_message: msg,
      });

      return NextResponse.json(response);
    }

    // 2. Get existing results from our database
    const { data: existingResults } = await supabase
      .from('match_results')
      .select('match_id, source');

    const existingMatchIds = new Set((existingResults || []).map(r => r.match_id));

    // 3. Process each finished match from API
    for (const apiMatch of apiMatches) {
      // Find corresponding match in our database
      // First try by team names (works for group stage)
      let ourMatchId = findOurMatchId(apiMatch, matches as any);

      // If not found, try knockout match lookup via team overrides
      if (!ourMatchId) {
        ourMatchId = await findKnockoutMatchId(apiMatch, supabase);
      }

      if (!ourMatchId) {
        // Could be a match not in our list
        continue;
      }

      // Skip if already has result (admin or auto)
      if (existingMatchIds.has(ourMatchId)) {
        response.alreadySynced++;
        continue;
      }

      // Get final score (fullTime = includes extra time, NOT penalties)
      const score = getFinalScore(apiMatch);
      if (!score) {
        response.errors.push(`Match ${ourMatchId}: Could not get final score`);
        continue;
      }

      // Record the result using the same logic as admin entry
      try {
        const match = getMatchById(ourMatchId);

        await recordMatchResult(
          supabase,
          ourMatchId,
          score.home,
          score.away,
          'auto'
        );

        response.newResultsSynced.push({
          matchId: ourMatchId,
          matchName: match?.match || `Match #${ourMatchId}`,
          homeScore: score.home,
          awayScore: score.away,
          hadExtraTime: score.hadExtraTime,
          source: 'auto',
          pointsCalculated: MEMBERS.length,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        response.errors.push(`Match ${ourMatchId}: ${msg}`);
      }
    }

    // 4. Recalculate all daily awards (Drère + Mzi) for all completed days
    const allCompetitionDays = new Set<string>();
    for (const m of matches as any[]) {
      const compDay = getCompetitionDay(m.date, m.time);
      allCompetitionDays.add(compDay);
    }

    for (const dateStr of allCompetitionDays) {
      await updateDailyAwards(supabase, dateStr);
    }

    // 5. Log the sync
    await supabase.from('sync_log').insert({
      success: response.errors.length === 0,
      matches_synced: response.newResultsSynced.length,
      matches_checked: response.matchesChecked,
      error_message: response.errors.length > 0 ? response.errors.join('; ') : null,
    });

    response.success = response.errors.length === 0;
    return NextResponse.json(response);

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    response.errors.push(msg);
    response.success = false;

    await supabase.from('sync_log').insert({
      success: false,
      matches_synced: 0,
      error_message: msg,
    });

    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * Record a match result and calculate points
 * Same logic as admin entry but with source tracking
 * Score = fullTime (90min for group stage, 120min if extra time for knockout)
 */
async function recordMatchResult(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  matchId: number,
  homeScore: number,
  awayScore: number,
  source: 'auto' | 'admin'
) {
  const match = getMatchById(matchId);
  if (!match) {
    throw new Error(`Match ${matchId} not found`);
  }

  const teams = parseMatchTeams(match.match);

  // Insert result with source tracking
  // entered_by: null for auto-sync (no human user)
  const { error: insertError } = await supabase
    .from('match_results')
    .insert({
      match_id: matchId,
      home_score: homeScore,
      away_score: awayScore,
      source,
      entered_by: null,
      entered_at: new Date().toISOString(),
    });

  if (insertError) {
    throw new Error(`DB insert error: ${insertError.message}`);
  }

  // Get all predictions for this match
  const { data: predictionsData } = await supabase
    .from('match_score_predictions')
    .select('user_id, home_score, away_score')
    .eq('match_id', matchId);

  const predictions: Prediction[] = (predictionsData || []).map(p => ({
    user_id: p.user_id,
    home_score: p.home_score,
    away_score: p.away_score,
  }));

  const result: MatchResult = {
    home_score: homeScore,
    away_score: awayScore,
  };

  // Calculate points for all predictions
  const pointsMap = calculateMatchPoints(predictions, result, teams.home, teams.away);

  // Delete existing points log for this match (safety)
  await supabase
    .from('points_log')
    .delete()
    .eq('match_id', matchId);

  // Insert new points log entries
  const pointsLogEntries: Array<{
    user_id: string;
    match_id: number;
    base_points: number;
    visionary_bonus: number;
    total_points: number;
    detail: string;
  }> = [];

  for (const [userId, breakdown] of pointsMap) {
    pointsLogEntries.push({
      user_id: userId,
      match_id: matchId,
      base_points: breakdown.base,
      visionary_bonus: breakdown.visionary,
      total_points: breakdown.total,
      detail: breakdown.detail,
    });
  }

  if (pointsLogEntries.length > 0) {
    await supabase.from('points_log').insert(pointsLogEntries);
  }

  // Send notifications to all members
  const notifications = MEMBERS.map(member => {
    const points = pointsMap.get(member.id);
    const pointsText = points
      ? `+${points.total} pt${points.total > 1 ? 's' : ''}`
      : 'pas de prono';

    return {
      user_id: member.id,
      type: 'match_response' as const,
      title: `${teams.home} ${homeScore}-${awayScore} ${teams.away}`,
      message: `Résultat ${source === 'auto' ? '(auto)' : ''} — ${pointsText}`,
      link: '/leaderboard',
      created_by: 'system',
      related_id: matchId.toString(),
    };
  });

  await supabase.from('notifications').insert(notifications);

  // Update daily awards (using competition day: 06:00 to 05:59 next day)
  const competitionDay = getCompetitionDay(match.date, match.time);
  await updateDailyAwards(supabase, competitionDay);
}

/**
 * Get the "competition day" (session) for a match
 * Session = soirée foot belge: 18h00 jour N → 08h59 jour N+1
 * Nouvelle session à 09h00
 *
 * Exemple session "15 juin":
 * - 15 juin 18h ✓
 * - 15 juin 21h ✓
 * - 16 juin 00h ✓
 * - 16 juin 03h ✓
 * - 16 juin 06h ✓
 * - 16 juin 08h ✓
 * - 16 juin 09h → nouvelle session "16 juin"
 *
 * Drère calculé à 09h01 chaque jour
 */
function getCompetitionDay(date: string, time: string): string {
  const hour = parseInt(time.split(':')[0], 10);

  // If match is before 09:00 Belgian time, it belongs to the previous day's session
  // (late night matches are part of the previous evening's session)
  if (hour < 9) {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }

  return date;
}

/**
 * Update daily Drère award
 * Awards the user(s) with most points for matches on a given competition day
 * Competition day: 06:00 to 05:59 next day (groups evening + late night matches)
 */
async function updateDailyAwards(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  dateStr: string
) {
  // Get all matches that belong to this competition day
  const matchesOnCompetitionDay = (matches as any[]).filter(m =>
    getCompetitionDay(m.date, m.time) === dateStr
  );
  if (matchesOnCompetitionDay.length === 0) return;

  const matchIds = matchesOnCompetitionDay.map(m => m.id);

  // Check which of these matches have results
  const { data: resultsData } = await supabase
    .from('match_results')
    .select('match_id')
    .in('match_id', matchIds);

  if (!resultsData || resultsData.length === 0) return;

  const completedMatchIds = resultsData.map(r => r.match_id);

  // Get points for completed matches on this date
  const { data: pointsData } = await supabase
    .from('points_log')
    .select('user_id, total_points')
    .in('match_id', completedMatchIds);

  if (!pointsData || pointsData.length === 0) return;

  // Sum points per user
  const userPoints: Record<string, number> = {};
  for (const p of pointsData) {
    userPoints[p.user_id] = (userPoints[p.user_id] || 0) + p.total_points;
  }

  // Find max points
  const maxPoints = Math.max(...Object.values(userPoints));
  if (maxPoints === 0) return;

  // Find users with max points (Drère)
  const drereUsers = Object.entries(userPoints)
    .filter(([, points]) => points === maxPoints)
    .map(([userId]) => userId);

  // Find min points (Type mzi = celui qui a le moins de points)
  const minPoints = Math.min(...Object.values(userPoints));

  // Find users with min points (Type mzi) - exclude if same as max (everyone tied)
  const mziUsers = minPoints < maxPoints
    ? Object.entries(userPoints)
        .filter(([, points]) => points === minPoints)
        .map(([userId]) => userId)
    : [];

  // Create Drère daily awards
  await supabase
    .from('daily_awards')
    .delete()
    .eq('award_date', dateStr)
    .eq('award_type', 'drere');

  const drereAwards = drereUsers.map(userId => ({
    user_id: userId,
    award_date: dateStr,
    award_type: 'drere' as const,
    points_earned: maxPoints,
  }));

  await supabase.from('daily_awards').insert(drereAwards);

  // Create Type mzi daily awards
  await supabase
    .from('daily_awards')
    .delete()
    .eq('award_date', dateStr)
    .eq('award_type', 'mzi');

  if (mziUsers.length > 0) {
    const mziAwards = mziUsers.map(userId => ({
      user_id: userId,
      award_date: dateStr,
      award_type: 'mzi' as const,
      points_earned: minPoints,
    }));

    await supabase.from('daily_awards').insert(mziAwards);
  }
}
