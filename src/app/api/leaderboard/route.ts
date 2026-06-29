import { NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import { MEMBERS } from '@/data/members';

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  member_name: string;
  member_slug: string;
  total_points: number;
  match_points: number; // Points from match predictions
  global_points: number; // Points from global predictions (+20 each)
  exact_scores: number;
  visionary_count: number;
  matches_predicted: number;
  global_correct: number; // Number of correct global predictions (0-5)
  crown_count: number;
  mzi_count: number; // Number of times this user got 0 points in a day
  drere_week_count: number; // Number of Drère of the Week awards
  is_drere_today: boolean;
  is_mzi_today: boolean; // Type mzi du jour (0 points)
  is_drere_week: boolean; // Drère of the Week
  rank_change: number; // positive = up, negative = down, 0 = same
}

export interface DrereWeekLeaderboardEntry {
  rank: number;
  user_id: string;
  member_name: string;
  member_slug: string;
  drere_week_count: number;
  total_points_earned: number; // Sum of points from all drere_week wins
}

export interface WeekRaceEntry {
  rank: number;
  user_id: string;
  member_name: string;
  member_slug: string;
  week_points: number;
}

export interface LeaderboardStats {
  most_optimistic: { user_id: string; member_name: string; avg_goals: number } | null;
  top_visionary: { user_id: string; member_name: string; count: number } | null;
  top_follower: { user_id: string; member_name: string; count: number } | null;
}

/**
 * Get the boundaries of the CURRENT week (ongoing)
 * Week starts Monday at 6am UTC and runs until next Monday 6am
 */
function getCurrentWeekBoundaries(now: Date): { weekStart: Date; weekEnd: Date } {
  const d = new Date(now);
  const day = d.getUTCDay();
  const hour = d.getUTCHours();

  // Find days to most recent Monday 6am
  let daysToMostRecentMonday: number;
  if (day === 0) {
    daysToMostRecentMonday = 6;
  } else if (day === 1 && hour < 6) {
    // Monday before 6am - still in previous week
    daysToMostRecentMonday = 7;
  } else {
    daysToMostRecentMonday = day - 1;
  }

  const weekStart = new Date(d);
  weekStart.setUTCDate(weekStart.getUTCDate() - daysToMostRecentMonday);
  weekStart.setUTCHours(6, 0, 0, 0);

  // Week end is next Monday at 6am
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  return { weekStart, weekEnd };
}

// GET /api/leaderboard
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non connecté' },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Get the "display date" for Drère - based on Belgian viewing sessions
    // Session = 09h00 jour N → 08h59 jour N+1 (heure belge = UTC+2)
    // In UTC: 07:00 jour N → 06:59 jour N+1
    const now = new Date();
    const hour = now.getUTCHours();
    let drereDisplayDate: string;

    if (hour < 7) {
      // Before 07:00 UTC (09:00 Belgian) - still in previous day's session
      // Show 2 days ago's Drère (last completed session)
      const twoDaysAgo = new Date(now.getTime() - 2 * 86400000);
      drereDisplayDate = twoDaysAgo.toISOString().split('T')[0];
    } else {
      // After 07:00 UTC (09:00 Belgian) - new session has started
      // Show yesterday's Drère (the just-completed session)
      const yesterday = new Date(now.getTime() - 86400000);
      drereDisplayDate = yesterday.toISOString().split('T')[0];
    }

    // Get all match points
    const { data: pointsData } = await supabase
      .from('points_log')
      .select('user_id, total_points, base_points, visionary_bonus, outsider_bonus');

    // Get global prediction points (+20 per correct)
    let globalPointsData: Array<{ user_id: string; points_awarded: number }> = [];
    try {
      const { data, error } = await supabase
        .from('global_prediction_points')
        .select('user_id, points_awarded');
      if (!error && data) {
        globalPointsData = data;
      }
    } catch {
      // Table might not exist yet - that's ok
    }

    // Get crown counts (Drère)
    const { data: crownsData } = await supabase
      .from('daily_awards')
      .select('user_id')
      .eq('award_type', 'drere');

    // Get mzi counts (Type mzi)
    const { data: mziData } = await supabase
      .from('daily_awards')
      .select('user_id')
      .eq('award_type', 'mzi');

    // Get Drère of the Week counts and total points
    const { data: drereWeekData } = await supabase
      .from('daily_awards')
      .select('user_id, points_earned')
      .eq('award_type', 'drere_week');

    // Get Drère for display (previous competition day) with points earned
    const { data: todayDrere } = await supabase
      .from('daily_awards')
      .select('user_id, points_earned')
      .eq('award_date', drereDisplayDate)
      .eq('award_type', 'drere');

    // Get Mzi for display (previous competition day)
    const { data: todayMzi } = await supabase
      .from('daily_awards')
      .select('user_id, points_earned')
      .eq('award_date', drereDisplayDate)
      .eq('award_type', 'mzi');

    // Get Drère of the Week (calculated Monday at 6am UTC)
    // We display the PREVIOUS COMPLETED week's drère
    // The cron runs Monday 6am and stores the award with the PREVIOUS Monday's date
    const getPreviousWeekStartDate = (date: Date): string => {
      const d = new Date(date);
      const day = d.getUTCDay(); // 0=Sunday, 1=Monday, etc.

      // First, find the most recent Monday (or today if Monday)
      let daysToMostRecentMonday: number;
      if (day === 0) {
        daysToMostRecentMonday = 6; // Sunday -> Monday was 6 days ago
      } else {
        daysToMostRecentMonday = day - 1; // Monday=0, Tuesday=1, etc.
      }

      // Then go back 7 more days to get the start of the completed week
      d.setUTCDate(d.getUTCDate() - daysToMostRecentMonday - 7);
      return d.toISOString().split('T')[0];
    };

    const weekStartDate = getPreviousWeekStartDate(now);
    const { data: weeklyDrere } = await supabase
      .from('daily_awards')
      .select('user_id, points_earned')
      .eq('award_date', weekStartDate)
      .eq('award_type', 'drere_week');

    const todayDrereIds = new Set((todayDrere || []).map(d => d.user_id));
    const todayMziIds = new Set((todayMzi || []).map(d => d.user_id));
    const weeklyDrereIds = new Set((weeklyDrere || []).map(d => d.user_id));
    const drerePoints = (todayDrere || [])[0]?.points_earned || 0;
    const mziPoints = (todayMzi || [])[0]?.points_earned ?? null;
    const weeklyDrerePoints = (weeklyDrere || [])[0]?.points_earned || 0;

    // Calculate user stats
    const userStats: Record<string, {
      match_points: number;
      global_points: number;
      exact_scores: number;
      visionary_count: number;
      matches_predicted: number;
      global_correct: number;
    }> = {};

    for (const member of MEMBERS) {
      userStats[member.id] = {
        match_points: 0,
        global_points: 0,
        exact_scores: 0,
        visionary_count: 0,
        matches_predicted: 0,
        global_correct: 0,
      };
    }

    // Add match points
    for (const p of pointsData || []) {
      if (!userStats[p.user_id]) continue;
      userStats[p.user_id].match_points += p.total_points;
      userStats[p.user_id].matches_predicted += 1;
      if (p.base_points === 3) userStats[p.user_id].exact_scores += 1;
      if (p.visionary_bonus === 1) userStats[p.user_id].visionary_count += 1;
    }

    // Add global prediction points
    for (const g of globalPointsData) {
      if (!userStats[g.user_id]) continue;
      userStats[g.user_id].global_points += g.points_awarded;
      userStats[g.user_id].global_correct += 1;
    }

    // Count crowns (Drère)
    const crownCounts: Record<string, number> = {};
    for (const c of crownsData || []) {
      crownCounts[c.user_id] = (crownCounts[c.user_id] || 0) + 1;
    }

    // Count mzi
    const mziCounts: Record<string, number> = {};
    for (const m of mziData || []) {
      mziCounts[m.user_id] = (mziCounts[m.user_id] || 0) + 1;
    }

    // Count Drère of the Week and sum points
    const drereWeekCounts: Record<string, number> = {};
    const drereWeekTotalPoints: Record<string, number> = {};
    for (const d of drereWeekData || []) {
      drereWeekCounts[d.user_id] = (drereWeekCounts[d.user_id] || 0) + 1;
      drereWeekTotalPoints[d.user_id] = (drereWeekTotalPoints[d.user_id] || 0) + (d.points_earned || 0);
    }

    // Build leaderboard
    const entries: LeaderboardEntry[] = MEMBERS.map(member => {
      const stats = userStats[member.id] || {
        match_points: 0, global_points: 0, exact_scores: 0,
        visionary_count: 0, matches_predicted: 0, global_correct: 0
      };
      return {
        rank: 0,
        user_id: member.id,
        member_name: member.name,
        member_slug: member.slug,
        total_points: stats.match_points + stats.global_points,
        match_points: stats.match_points,
        global_points: stats.global_points,
        exact_scores: stats.exact_scores,
        visionary_count: stats.visionary_count,
        matches_predicted: stats.matches_predicted,
        global_correct: stats.global_correct,
        crown_count: crownCounts[member.id] || 0,
        mzi_count: mziCounts[member.id] || 0,
        drere_week_count: drereWeekCounts[member.id] || 0,
        is_drere_today: todayDrereIds.has(member.id),
        is_mzi_today: todayMziIds.has(member.id),
        is_drere_week: weeklyDrereIds.has(member.id),
        rank_change: 0, // TODO: Calculate from yesterday's ranking
      };
    });

    // Sort by points, then exact scores, then name
    entries.sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      if (b.exact_scores !== a.exact_scores) return b.exact_scores - a.exact_scores;
      return a.member_name.localeCompare(b.member_name);
    });

    // Assign ranks
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    // Calculate fun stats
    const stats = await calculateFunStats(supabase);

    // Get count of matches with results
    const { count: totalMatchesWithResults } = await supabase
      .from('match_results')
      .select('*', { count: 'exact', head: true });

    // Build Drère of the Week leaderboard (sorted by count, then total points)
    const drereWeekLeaderboard: DrereWeekLeaderboardEntry[] = MEMBERS
      .filter(member => (drereWeekCounts[member.id] || 0) > 0)
      .map(member => ({
        rank: 0,
        user_id: member.id,
        member_name: member.name,
        member_slug: member.slug,
        drere_week_count: drereWeekCounts[member.id] || 0,
        total_points_earned: drereWeekTotalPoints[member.id] || 0,
      }))
      .sort((a, b) => {
        if (b.drere_week_count !== a.drere_week_count) return b.drere_week_count - a.drere_week_count;
        return b.total_points_earned - a.total_points_earned;
      });

    // Assign ranks to drere week leaderboard
    drereWeekLeaderboard.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    // Calculate current week race (points accumulated this week so far)
    const { weekStart, weekEnd } = getCurrentWeekBoundaries(now);

    const { data: weekPointsData } = await supabase
      .from('points_log')
      .select(`
        user_id,
        total_points,
        match_results!inner(entered_at)
      `)
      .gte('match_results.entered_at', weekStart.toISOString())
      .lt('match_results.entered_at', weekEnd.toISOString());

    // Sum points per user for the current week
    const weekPointsByUser: Record<string, number> = {};
    for (const p of weekPointsData || []) {
      weekPointsByUser[p.user_id] = (weekPointsByUser[p.user_id] || 0) + p.total_points;
    }

    // Build week race leaderboard
    const weekRace: WeekRaceEntry[] = MEMBERS
      .filter(member => (weekPointsByUser[member.id] || 0) > 0)
      .map(member => ({
        rank: 0,
        user_id: member.id,
        member_name: member.name,
        member_slug: member.slug,
        week_points: weekPointsByUser[member.id] || 0,
      }))
      .sort((a, b) => b.week_points - a.week_points);

    // Assign ranks
    weekRace.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return NextResponse.json({
      leaderboard: entries,
      stats,
      current_user_id: user.id,
      total_matches_with_results: totalMatchesWithResults || 0,
      drere_day_points: drerePoints,
      mzi_day_points: mziPoints,
      drere_week_points: weeklyDrerePoints,
      drere_week_users: (weeklyDrere || []).map(d => d.user_id),
      drere_week_leaderboard: drereWeekLeaderboard,
      drere_display_date: drereDisplayDate,
      week_race: weekRace,
      week_race_start: weekStart.toISOString(),
      week_race_end: weekEnd.toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

async function calculateFunStats(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<LeaderboardStats> {
  // Most optimistic (highest average predicted goals)
  const { data: predictions } = await supabase
    .from('match_score_predictions')
    .select('user_id, home_score, away_score');

  let mostOptimistic: LeaderboardStats['most_optimistic'] = null;
  let topVisionary: LeaderboardStats['top_visionary'] = null;
  let topFollower: LeaderboardStats['top_follower'] = null;

  if (predictions && predictions.length > 0) {
    // Calculate average goals per user
    const userGoals: Record<string, { total: number; count: number }> = {};
    for (const p of predictions) {
      if (!userGoals[p.user_id]) {
        userGoals[p.user_id] = { total: 0, count: 0 };
      }
      userGoals[p.user_id].total += p.home_score + p.away_score;
      userGoals[p.user_id].count += 1;
    }

    let maxAvg = 0;
    let optimisticUserId = '';
    for (const [userId, data] of Object.entries(userGoals)) {
      const avg = data.total / data.count;
      if (avg > maxAvg) {
        maxAvg = avg;
        optimisticUserId = userId;
      }
    }

    if (optimisticUserId) {
      const member = MEMBERS.find(m => m.id === optimisticUserId);
      if (member) {
        mostOptimistic = {
          user_id: optimisticUserId,
          member_name: member.name,
          avg_goals: Math.round(maxAvg * 10) / 10,
        };
      }
    }
  }

  // Top visionary (most solo exact scores)
  const { data: visionaryData } = await supabase
    .from('points_log')
    .select('user_id')
    .eq('visionary_bonus', 1);

  if (visionaryData && visionaryData.length > 0) {
    const counts: Record<string, number> = {};
    for (const v of visionaryData) {
      counts[v.user_id] = (counts[v.user_id] || 0) + 1;
    }

    const maxCount = Math.max(...Object.values(counts));
    const topUserId = Object.entries(counts).find(([, c]) => c === maxCount)?.[0];

    if (topUserId) {
      const member = MEMBERS.find(m => m.id === topUserId);
      if (member) {
        topVisionary = {
          user_id: topUserId,
          member_name: member.name,
          count: maxCount,
        };
      }
    }
  }

  // Top follower (most duplicate predictions with others)
  // This is more complex - count how many times each user has the same prediction as someone else
  if (predictions && predictions.length > 0) {
    const predictionsByMatch: Record<number, Array<{ user_id: string; score: string }>> = {};

    // We need match_id, but we don't have it in this query. Let's skip this for now.
    // TODO: Implement follower stat with match_id
  }

  return {
    most_optimistic: mostOptimistic,
    top_visionary: topVisionary,
    top_follower: topFollower,
  };
}
