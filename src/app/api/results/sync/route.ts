import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/auth/session';
import { getMatchById, parseMatchTeams } from '@/lib/matches';
import { calculateMatchPoints, Prediction, MatchResult, PointsBreakdown } from '@/lib/scoring';
import { MEMBERS } from '@/data/members';
import { isKnockoutPhase } from '@/lib/constants';
import {
  fetchWorldCupMatches,
  findOurMatchId,
  getFinalScore,
  testApiConnection,
  ApiMatch,
  MatchScore,
} from '@/lib/football-api';
import matches from '@/data/matches.json';

// Verify cron secret for security
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get('authorization');
  return authHeader === `Bearer ${cronSecret}`;
}

interface SyncResult {
  matchId: number;
  matchName: string;
  homeScore: number;
  awayScore: number;
  qualifier?: 'home' | 'away';
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

// GET /api/results/sync - Get sync status (public for admin dashboard)
export async function GET() {
  const supabase = getSupabaseAdmin();

  // Get last sync info
  const { data: lastSync } = await supabase
    .from('sync_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  // Get auto-synced results count
  const { count: autoSyncedCount } = await supabase
    .from('match_results')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'auto');

  // Test API connection
  const apiStatus = await testApiConnection();

  return NextResponse.json({
    lastSyncs: lastSync || [],
    autoSyncedCount: autoSyncedCount || 0,
    apiStatus,
  });
}

// POST /api/results/sync - Run sync (protected by CRON_SECRET)
export async function POST(request: NextRequest) {
  // Verify cron secret
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized - invalid CRON_SECRET' },
      { status: 401 }
    );
  }

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
      const ourMatchId = findOurMatchId(apiMatch, matches as any);

      if (!ourMatchId) {
        // Could be a match not in our list (shouldn't happen for group stage)
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
        const isKnockout = match ? isKnockoutPhase(match.phase) : false;

        await recordMatchResult(
          supabase,
          ourMatchId,
          score.home,
          score.away,
          'auto',
          isKnockout ? score.qualifier : undefined
        );

        response.newResultsSynced.push({
          matchId: ourMatchId,
          matchName: match?.match || `Match #${ourMatchId}`,
          homeScore: score.home,
          awayScore: score.away,
          qualifier: isKnockout ? score.qualifier : undefined,
          hadExtraTime: score.hadExtraTime,
          source: 'auto',
          pointsCalculated: MEMBERS.length,
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        response.errors.push(`Match ${ourMatchId}: ${msg}`);
      }
    }

    // 4. Log the sync
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
 * @param qualifier - For knockout matches: 'home' or 'away' indicating who advanced
 */
async function recordMatchResult(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  matchId: number,
  homeScore: number,
  awayScore: number,
  source: 'auto' | 'admin',
  qualifier?: 'home' | 'away'
) {
  const match = getMatchById(matchId);
  if (!match) {
    throw new Error(`Match ${matchId} not found`);
  }

  const teams = parseMatchTeams(match.match);
  const isKnockout = isKnockoutPhase(match.phase);

  // Insert result with source tracking
  // Score = fullTime (90min for group stage, 120min if extra time for knockout)
  const { error: insertError } = await supabase
    .from('match_results')
    .insert({
      match_id: matchId,
      home_score: homeScore,
      away_score: awayScore,
      qualifier: isKnockout ? qualifier : null,
      source,
      entered_at: new Date().toISOString(),
    });

  if (insertError) {
    throw new Error(`DB insert error: ${insertError.message}`);
  }

  // Get all predictions for this match (including qualifier_pick for knockout)
  const { data: predictionsData } = await supabase
    .from('match_score_predictions')
    .select('user_id, home_score, away_score, qualifier_pick')
    .eq('match_id', matchId);

  const predictions: Prediction[] = (predictionsData || []).map(p => ({
    user_id: p.user_id,
    home_score: p.home_score,
    away_score: p.away_score,
    qualifier_pick: p.qualifier_pick as 'home' | 'away' | undefined,
  }));

  const result: MatchResult = {
    home_score: homeScore,
    away_score: awayScore,
    qualifier: isKnockout ? qualifier : undefined,
  };

  // Calculate points for all predictions (with knockout flag)
  const pointsMap = calculateMatchPoints(predictions, result, teams.home, teams.away, isKnockout);

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
    qualifier_bonus: number;
    total_points: number;
    detail: string;
  }> = [];

  for (const [userId, breakdown] of pointsMap) {
    pointsLogEntries.push({
      user_id: userId,
      match_id: matchId,
      base_points: breakdown.base,
      visionary_bonus: breakdown.visionary,
      qualifier_bonus: breakdown.qualifier,
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

  // Update daily awards
  await updateDailyAwards(supabase, match.date);
}

/**
 * Update daily Drère award
 */
async function updateDailyAwards(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  dateStr: string
) {
  // Get all points for matches on this date
  const { data: matchesData } = await supabase
    .from('match_results')
    .select('match_id')
    .gte('entered_at', `${dateStr}T00:00:00`)
    .lt('entered_at', `${dateStr}T23:59:59`);

  if (!matchesData || matchesData.length === 0) return;

  const matchIds = matchesData.map(m => m.match_id);

  // Get points for these matches
  const { data: pointsData } = await supabase
    .from('points_log')
    .select('user_id, total_points')
    .in('match_id', matchIds);

  if (!pointsData || pointsData.length === 0) return;

  // Sum points per user
  const userPoints: Record<string, number> = {};
  for (const p of pointsData) {
    userPoints[p.user_id] = (userPoints[p.user_id] || 0) + p.total_points;
  }

  // Find max points
  const maxPoints = Math.max(...Object.values(userPoints));
  if (maxPoints === 0) return;

  // Find users with max points
  const drereUsers = Object.entries(userPoints)
    .filter(([, points]) => points === maxPoints)
    .map(([userId]) => userId);

  // Create daily awards
  await supabase
    .from('daily_awards')
    .delete()
    .eq('award_date', dateStr)
    .eq('award_type', 'drere');

  const awards = drereUsers.map(userId => ({
    user_id: userId,
    award_date: dateStr,
    award_type: 'drere' as const,
    points_earned: maxPoints,
  }));

  await supabase.from('daily_awards').insert(awards);
}
