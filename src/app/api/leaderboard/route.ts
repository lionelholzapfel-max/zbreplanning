import { NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import { MEMBERS } from '@/data/members';

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  member_name: string;
  member_slug: string;
  total_points: number;
  exact_scores: number;
  visionary_count: number;
  outsider_count: number;
  matches_predicted: number;
  crown_count: number;
  is_drere_today: boolean;
  rank_change: number; // positive = up, negative = down, 0 = same
}

export interface LeaderboardStats {
  most_optimistic: { user_id: string; member_name: string; avg_goals: number } | null;
  top_visionary: { user_id: string; member_name: string; count: number } | null;
  top_follower: { user_id: string; member_name: string; count: number } | null;
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
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Get all points
    const { data: pointsData } = await supabase
      .from('points_log')
      .select('user_id, total_points, base_points, visionary_bonus, outsider_bonus');

    // Get crown counts
    const { data: crownsData } = await supabase
      .from('daily_awards')
      .select('user_id')
      .eq('award_type', 'drere');

    // Get today's Drère(s)
    const { data: todayDrere } = await supabase
      .from('daily_awards')
      .select('user_id')
      .eq('award_date', today)
      .eq('award_type', 'drere');

    const todayDrereIds = new Set((todayDrere || []).map(d => d.user_id));

    // Calculate user stats
    const userStats: Record<string, {
      total_points: number;
      exact_scores: number;
      visionary_count: number;
      outsider_count: number;
      matches_predicted: number;
    }> = {};

    for (const member of MEMBERS) {
      userStats[member.id] = {
        total_points: 0,
        exact_scores: 0,
        visionary_count: 0,
        outsider_count: 0,
        matches_predicted: 0,
      };
    }

    for (const p of pointsData || []) {
      if (!userStats[p.user_id]) continue;
      userStats[p.user_id].total_points += p.total_points;
      userStats[p.user_id].matches_predicted += 1;
      if (p.base_points === 3) userStats[p.user_id].exact_scores += 1;
      if (p.visionary_bonus === 1) userStats[p.user_id].visionary_count += 1;
      if (p.outsider_bonus === 1) userStats[p.user_id].outsider_count += 1;
    }

    // Count crowns
    const crownCounts: Record<string, number> = {};
    for (const c of crownsData || []) {
      crownCounts[c.user_id] = (crownCounts[c.user_id] || 0) + 1;
    }

    // Build leaderboard
    const entries: LeaderboardEntry[] = MEMBERS.map(member => ({
      rank: 0,
      user_id: member.id,
      member_name: member.name,
      member_slug: member.slug,
      total_points: userStats[member.id]?.total_points || 0,
      exact_scores: userStats[member.id]?.exact_scores || 0,
      visionary_count: userStats[member.id]?.visionary_count || 0,
      outsider_count: userStats[member.id]?.outsider_count || 0,
      matches_predicted: userStats[member.id]?.matches_predicted || 0,
      crown_count: crownCounts[member.id] || 0,
      is_drere_today: todayDrereIds.has(member.id),
      rank_change: 0, // TODO: Calculate from yesterday's ranking
    }));

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

    return NextResponse.json({
      leaderboard: entries,
      stats,
      current_user_id: user.id,
    });
  } catch (error) {
    console.error('[Leaderboard] GET error:', error);
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
