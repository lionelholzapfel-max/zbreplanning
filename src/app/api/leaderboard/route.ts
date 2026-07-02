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

export interface RecordEntry {
  user_id: string;
  member_name: string;
  member_slug: string;
  points: number;
  date: string;
}

export interface StreakRecord {
  user_id: string;
  member_name: string;
  member_slug: string;
  streak: number;
  start_date: string;
  end_date: string;
}

export interface StreakRecordHolder {
  user_id: string;
  member_name: string;
  member_slug: string;
  start_date: string;
  end_date: string;
}

export interface StreakRecordWithHolders {
  streak: number;
  holders: StreakRecordHolder[];
}

export interface CountRecordHolder {
  user_id: string;
  member_name: string;
  member_slug: string;
}

export interface CountRecordWithHolders {
  count: number;
  holders: CountRecordHolder[];
}

export interface AverageRecordHolder {
  user_id: string;
  member_name: string;
  member_slug: string;
  matches_predicted: number;
}

export interface AverageRecordWithHolders {
  average: number;
  holders: AverageRecordHolder[];
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

    // Previous completed week's Monday (Drère of the Week is stored under that date;
    // the cron runs Monday 6am UTC and writes the award with the PREVIOUS Monday's date).
    const getPreviousWeekStartDate = (date: Date): string => {
      const d = new Date(date);
      const day = d.getUTCDay(); // 0=Sunday, 1=Monday, etc.
      const daysToMostRecentMonday = day === 0 ? 6 : day - 1;
      d.setUTCDate(d.getUTCDate() - daysToMostRecentMonday - 7);
      return d.toISOString().split('T')[0];
    };
    const weekStartDate = getPreviousWeekStartDate(now);

    // These reads are all independent → run them concurrently (was ~13 sequential
    // round-trips ≈ ~1s of TTFB, now ~1 round-trip). 14 users, tiny payloads.
    const [
      pointsRes,
      globalPointsRes,
      crownsRes,
      mziRes,
      drereWeekRes,
      dailyRecordRes,
      weeklyRecordRes,
      allDailyDrereRes,
      allWeeklyDrereRes,
      allMziAwardsRes,
      todayDrereRes,
      todayMziRes,
      weeklyDrereRes,
    ] = await Promise.all([
      supabase.from('points_log').select('user_id, total_points, base_points, visionary_bonus'),
      supabase.from('global_prediction_points').select('user_id, points_awarded'),
      supabase.from('daily_awards').select('user_id').eq('award_type', 'drere'),
      supabase.from('daily_awards').select('user_id').eq('award_type', 'mzi'),
      supabase.from('daily_awards').select('user_id, points_earned').eq('award_type', 'drere_week'),
      supabase.from('daily_awards').select('user_id, points_earned, award_date').eq('award_type', 'drere').order('points_earned', { ascending: false }).limit(1),
      supabase.from('daily_awards').select('user_id, points_earned, award_date').eq('award_type', 'drere_week').order('points_earned', { ascending: false }).limit(1),
      supabase.from('daily_awards').select('user_id, award_date').eq('award_type', 'drere').order('award_date', { ascending: true }),
      supabase.from('daily_awards').select('user_id, award_date').eq('award_type', 'drere_week').order('award_date', { ascending: true }),
      supabase.from('daily_awards').select('user_id, award_date').eq('award_type', 'mzi').order('award_date', { ascending: true }),
      supabase.from('daily_awards').select('user_id, points_earned').eq('award_date', drereDisplayDate).eq('award_type', 'drere'),
      supabase.from('daily_awards').select('user_id, points_earned').eq('award_date', drereDisplayDate).eq('award_type', 'mzi'),
      supabase.from('daily_awards').select('user_id, points_earned').eq('award_date', weekStartDate).eq('award_type', 'drere_week'),
    ]);

    const pointsData = pointsRes.data;
    // global_prediction_points might not exist yet on a fresh DB — tolerate that.
    const globalPointsData = (!globalPointsRes.error && globalPointsRes.data) ? globalPointsRes.data : [];
    const crownsData = crownsRes.data;
    const mziData = mziRes.data;
    const drereWeekData = drereWeekRes.data;
    const dailyRecordData = dailyRecordRes.data;
    const weeklyRecordData = weeklyRecordRes.data;
    const allDailyDrere = allDailyDrereRes.data;
    const allWeeklyDrere = allWeeklyDrereRes.data;
    const allMziAwards = allMziAwardsRes.data;
    const todayDrere = todayDrereRes.data;
    const todayMzi = todayMziRes.data;
    const weeklyDrere = weeklyDrereRes.data;

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

    // Fun stats + match count are independent → run concurrently.
    const [stats, matchesCountRes] = await Promise.all([
      calculateFunStats(supabase),
      supabase.from('match_results').select('*', { count: 'exact', head: true }),
    ]);
    const totalMatchesWithResults = matchesCountRes.count;

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

    // First get match_ids that fall within this week
    const { data: weekMatchResults } = await supabase
      .from('match_results')
      .select('match_id')
      .gte('entered_at', weekStart.toISOString())
      .lt('entered_at', weekEnd.toISOString());

    const weekMatchIds = (weekMatchResults || []).map(r => r.match_id);

    // Then get points for those matches
    let weekPointsData: Array<{ user_id: string; total_points: number }> = [];
    if (weekMatchIds.length > 0) {
      const { data } = await supabase
        .from('points_log')
        .select('user_id, total_points')
        .in('match_id', weekMatchIds);
      weekPointsData = data || [];
    }

    // Sum points per user for the current week
    const weekPointsByUser: Record<string, number> = {};
    for (const p of weekPointsData) {
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

    // Build records
    let dailyRecord: RecordEntry | null = null;
    if (dailyRecordData && dailyRecordData.length > 0) {
      const record = dailyRecordData[0];
      const member = MEMBERS.find(m => m.id === record.user_id);
      if (member) {
        dailyRecord = {
          user_id: record.user_id,
          member_name: member.name,
          member_slug: member.slug,
          points: record.points_earned,
          date: record.award_date,
        };
      }
    }

    let weeklyRecord: RecordEntry | null = null;
    if (weeklyRecordData && weeklyRecordData.length > 0) {
      const record = weeklyRecordData[0];
      const member = MEMBERS.find(m => m.id === record.user_id);
      if (member) {
        weeklyRecord = {
          user_id: record.user_id,
          member_name: member.name,
          member_slug: member.slug,
          points: record.points_earned,
          date: record.award_date,
        };
      }
    }

    // Calculate daily streak record
    // A streak is consecutive days where the same user won (handles ties - multiple winners same day)
    let dailyStreakRecord: StreakRecordWithHolders | null = null;
    if (allDailyDrere && allDailyDrere.length > 0) {
      // Group awards by user - get all dates each user won
      const userDates: Record<string, string[]> = {};
      for (const award of allDailyDrere) {
        if (!userDates[award.user_id]) {
          userDates[award.user_id] = [];
        }
        // Avoid duplicates (shouldn't happen but just in case)
        if (!userDates[award.user_id].includes(award.award_date)) {
          userDates[award.user_id].push(award.award_date);
        }
      }

      // For each user, calculate their best streak and collect all streaks
      const allBestStreaks: Array<{ userId: string; streak: number; startDate: string; endDate: string }> = [];

      for (const [userId, dates] of Object.entries(userDates)) {
        // Sort dates chronologically
        const sortedDates = dates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

        let currentStreak = 1;
        let currentStart = sortedDates[0];
        let currentEnd = sortedDates[0];
        let userBestStreak = { streak: 1, startDate: sortedDates[0], endDate: sortedDates[0] };

        for (let i = 1; i < sortedDates.length; i++) {
          const prevDate = new Date(sortedDates[i - 1]);
          const currDate = new Date(sortedDates[i]);
          const daysDiff = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

          if (daysDiff === 1) {
            // Consecutive day
            currentStreak++;
            currentEnd = sortedDates[i];
          } else {
            // Gap - check if this was the best streak for this user
            if (currentStreak > userBestStreak.streak) {
              userBestStreak = { streak: currentStreak, startDate: currentStart, endDate: currentEnd };
            }
            // Reset
            currentStreak = 1;
            currentStart = sortedDates[i];
            currentEnd = sortedDates[i];
          }
        }
        // Check final streak for this user
        if (currentStreak > userBestStreak.streak) {
          userBestStreak = { streak: currentStreak, startDate: currentStart, endDate: currentEnd };
        }

        if (userBestStreak.streak > 1) {
          allBestStreaks.push({ userId, ...userBestStreak });
        }
      }

      // Find the maximum streak
      const maxStreak = Math.max(0, ...allBestStreaks.map(s => s.streak));

      if (maxStreak > 1) {
        // Get all users with this max streak
        const holders: StreakRecordHolder[] = allBestStreaks
          .filter(s => s.streak === maxStreak)
          .map(s => {
            const member = MEMBERS.find(m => m.id === s.userId);
            return {
              user_id: s.userId,
              member_name: member?.name || 'Unknown',
              member_slug: member?.slug || '',
              start_date: s.startDate,
              end_date: s.endDate,
            };
          });

        dailyStreakRecord = {
          streak: maxStreak,
          holders,
        };
      }
    }

    // Calculate weekly streak record (same logic, but for weeks = 7 days apart)
    let weeklyStreakRecord: StreakRecordWithHolders | null = null;
    if (allWeeklyDrere && allWeeklyDrere.length > 0) {
      // Group awards by user
      const userDates: Record<string, string[]> = {};
      for (const award of allWeeklyDrere) {
        if (!userDates[award.user_id]) {
          userDates[award.user_id] = [];
        }
        if (!userDates[award.user_id].includes(award.award_date)) {
          userDates[award.user_id].push(award.award_date);
        }
      }

      const allBestStreaks: Array<{ userId: string; streak: number; startDate: string; endDate: string }> = [];

      for (const [userId, dates] of Object.entries(userDates)) {
        const sortedDates = dates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

        let currentStreak = 1;
        let currentStart = sortedDates[0];
        let currentEnd = sortedDates[0];
        let userBestStreak = { streak: 1, startDate: sortedDates[0], endDate: sortedDates[0] };

        for (let i = 1; i < sortedDates.length; i++) {
          const prevDate = new Date(sortedDates[i - 1]);
          const currDate = new Date(sortedDates[i]);
          const daysDiff = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

          if (daysDiff === 7) {
            // Consecutive week
            currentStreak++;
            currentEnd = sortedDates[i];
          } else {
            if (currentStreak > userBestStreak.streak) {
              userBestStreak = { streak: currentStreak, startDate: currentStart, endDate: currentEnd };
            }
            currentStreak = 1;
            currentStart = sortedDates[i];
            currentEnd = sortedDates[i];
          }
        }
        if (currentStreak > userBestStreak.streak) {
          userBestStreak = { streak: currentStreak, startDate: currentStart, endDate: currentEnd };
        }

        if (userBestStreak.streak > 1) {
          allBestStreaks.push({ userId, ...userBestStreak });
        }
      }

      const maxStreak = Math.max(0, ...allBestStreaks.map(s => s.streak));

      if (maxStreak > 1) {
        const holders: StreakRecordHolder[] = allBestStreaks
          .filter(s => s.streak === maxStreak)
          .map(s => {
            const member = MEMBERS.find(m => m.id === s.userId);
            return {
              user_id: s.userId,
              member_name: member?.name || 'Unknown',
              member_slug: member?.slug || '',
              start_date: s.startDate,
              end_date: s.endDate,
            };
          });

        weeklyStreakRecord = {
          streak: maxStreak,
          holders,
        };
      }
    }

    // Build count records (most drère du jour, most mzi du jour, most exact scores)
    // All records support ties (multiple holders)
    let mostDrereRecord: CountRecordWithHolders | null = null;
    let mostMziRecord: CountRecordWithHolders | null = null;
    let mostExactScoresRecord: CountRecordWithHolders | null = null;

    // Find all users with most drère du jour
    const maxDrereCount = Math.max(0, ...Object.values(crownCounts));
    if (maxDrereCount > 0) {
      const holders: CountRecordHolder[] = Object.entries(crownCounts)
        .filter(([, c]) => c === maxDrereCount)
        .map(([userId]) => {
          const member = MEMBERS.find(m => m.id === userId);
          return {
            user_id: userId,
            member_name: member?.name || 'Unknown',
            member_slug: member?.slug || '',
          };
        })
        .filter(h => h.member_slug !== '');

      if (holders.length > 0) {
        mostDrereRecord = { count: maxDrereCount, holders };
      }
    }

    // Find all users with most mzi du jour
    const maxMziCount = Math.max(0, ...Object.values(mziCounts));
    if (maxMziCount > 0) {
      const holders: CountRecordHolder[] = Object.entries(mziCounts)
        .filter(([, c]) => c === maxMziCount)
        .map(([userId]) => {
          const member = MEMBERS.find(m => m.id === userId);
          return {
            user_id: userId,
            member_name: member?.name || 'Unknown',
            member_slug: member?.slug || '',
          };
        })
        .filter(h => h.member_slug !== '');

      if (holders.length > 0) {
        mostMziRecord = { count: maxMziCount, holders };
      }
    }

    // Find all users with most exact scores
    const exactScoreCounts: Record<string, number> = {};
    for (const member of MEMBERS) {
      exactScoreCounts[member.id] = userStats[member.id]?.exact_scores || 0;
    }
    const maxExactCount = Math.max(0, ...Object.values(exactScoreCounts));
    if (maxExactCount > 0) {
      const holders: CountRecordHolder[] = Object.entries(exactScoreCounts)
        .filter(([, c]) => c === maxExactCount)
        .map(([userId]) => {
          const member = MEMBERS.find(m => m.id === userId);
          return {
            user_id: userId,
            member_name: member?.name || 'Unknown',
            member_slug: member?.slug || '',
          };
        })
        .filter(h => h.member_slug !== '');

      if (holders.length > 0) {
        mostExactScoresRecord = { count: maxExactCount, holders };
      }
    }

    // Find all users with most visionary bonuses
    let mostVisionaryRecord: CountRecordWithHolders | null = null;
    const visionaryCounts: Record<string, number> = {};
    for (const member of MEMBERS) {
      visionaryCounts[member.id] = userStats[member.id]?.visionary_count || 0;
    }
    const maxVisionaryCount = Math.max(0, ...Object.values(visionaryCounts));
    if (maxVisionaryCount > 0) {
      const holders: CountRecordHolder[] = Object.entries(visionaryCounts)
        .filter(([, c]) => c === maxVisionaryCount)
        .map(([userId]) => {
          const member = MEMBERS.find(m => m.id === userId);
          return {
            user_id: userId,
            member_name: member?.name || 'Unknown',
            member_slug: member?.slug || '',
          };
        })
        .filter(h => h.member_slug !== '');

      if (holders.length > 0) {
        mostVisionaryRecord = { count: maxVisionaryCount, holders };
      }
    }

    // Find best average points per match (minimum 10 matches to qualify)
    let bestAverageRecord: AverageRecordWithHolders | null = null;
    const MIN_MATCHES_FOR_AVERAGE = 10;
    const userAverages: Record<string, { average: number; matches: number }> = {};
    for (const member of MEMBERS) {
      const stats = userStats[member.id];
      if (stats && stats.matches_predicted >= MIN_MATCHES_FOR_AVERAGE) {
        const avg = Math.round((stats.match_points / stats.matches_predicted) * 100) / 100;
        userAverages[member.id] = { average: avg, matches: stats.matches_predicted };
      }
    }
    if (Object.keys(userAverages).length > 0) {
      const maxAverage = Math.max(...Object.values(userAverages).map(u => u.average));
      const holders: AverageRecordHolder[] = Object.entries(userAverages)
        .filter(([, u]) => u.average === maxAverage)
        .map(([userId, u]) => {
          const member = MEMBERS.find(m => m.id === userId);
          return {
            user_id: userId,
            member_name: member?.name || 'Unknown',
            member_slug: member?.slug || '',
            matches_predicted: u.matches,
          };
        })
        .filter(h => h.member_slug !== '');

      if (holders.length > 0) {
        bestAverageRecord = { average: maxAverage, holders };
      }
    }

    // Calculate MZI streak record (consecutive days being MZI - the shame record)
    let mziStreakRecord: StreakRecordWithHolders | null = null;
    if (allMziAwards && allMziAwards.length > 0) {
      const userMziDates: Record<string, string[]> = {};
      for (const award of allMziAwards) {
        if (!userMziDates[award.user_id]) {
          userMziDates[award.user_id] = [];
        }
        if (!userMziDates[award.user_id].includes(award.award_date)) {
          userMziDates[award.user_id].push(award.award_date);
        }
      }

      const allMziStreaks: Array<{ userId: string; streak: number; startDate: string; endDate: string }> = [];

      for (const [userId, dates] of Object.entries(userMziDates)) {
        const sortedDates = dates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

        let currentStreak = 1;
        let currentStart = sortedDates[0];
        let currentEnd = sortedDates[0];
        let userBestStreak = { streak: 1, startDate: sortedDates[0], endDate: sortedDates[0] };

        for (let i = 1; i < sortedDates.length; i++) {
          const prevDate = new Date(sortedDates[i - 1]);
          const currDate = new Date(sortedDates[i]);
          const daysDiff = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

          if (daysDiff === 1) {
            currentStreak++;
            currentEnd = sortedDates[i];
          } else {
            if (currentStreak > userBestStreak.streak) {
              userBestStreak = { streak: currentStreak, startDate: currentStart, endDate: currentEnd };
            }
            currentStreak = 1;
            currentStart = sortedDates[i];
            currentEnd = sortedDates[i];
          }
        }
        if (currentStreak > userBestStreak.streak) {
          userBestStreak = { streak: currentStreak, startDate: currentStart, endDate: currentEnd };
        }

        if (userBestStreak.streak >= 1) {
          allMziStreaks.push({ userId, ...userBestStreak });
        }
      }

      const maxMziStreak = Math.max(0, ...allMziStreaks.map(s => s.streak));

      if (maxMziStreak >= 2) {
        const holders: StreakRecordHolder[] = allMziStreaks
          .filter(s => s.streak === maxMziStreak)
          .map(s => {
            const member = MEMBERS.find(m => m.id === s.userId);
            return {
              user_id: s.userId,
              member_name: member?.name || 'Unknown',
              member_slug: member?.slug || '',
              start_date: s.startDate,
              end_date: s.endDate,
            };
          });

        mziStreakRecord = {
          streak: maxMziStreak,
          holders,
        };
      }
    }

    // Calculate longest streak without MZI (for users who have participated)
    // This requires knowing all competition days and finding gaps in MZI awards
    let longestWithoutMziRecord: StreakRecordWithHolders | null = null;

    // Get all unique competition days from daily_awards
    const { data: allCompetitionDays } = await supabase
      .from('daily_awards')
      .select('award_date')
      .order('award_date', { ascending: true });

    if (allCompetitionDays && allCompetitionDays.length > 0) {
      const uniqueDays = [...new Set(allCompetitionDays.map(d => d.award_date))].sort();

      // For each user who has participated, calculate their longest streak without MZI
      const allWithoutMziStreaks: Array<{ userId: string; streak: number; startDate: string; endDate: string }> = [];

      for (const member of MEMBERS) {
        // Skip users who haven't played
        if (!userStats[member.id] || userStats[member.id].matches_predicted === 0) continue;

        const userMziDays = new Set(
          (allMziAwards || [])
            .filter(a => a.user_id === member.id)
            .map(a => a.award_date)
        );

        let currentStreak = 0;
        let currentStart = '';
        let currentEnd = '';
        let userBestStreak = { streak: 0, startDate: '', endDate: '' };

        for (const day of uniqueDays) {
          if (!userMziDays.has(day)) {
            // Not MZI on this day
            if (currentStreak === 0) {
              currentStart = day;
            }
            currentStreak++;
            currentEnd = day;
          } else {
            // Was MZI - streak ends
            if (currentStreak > userBestStreak.streak) {
              userBestStreak = { streak: currentStreak, startDate: currentStart, endDate: currentEnd };
            }
            currentStreak = 0;
          }
        }
        // Check final streak
        if (currentStreak > userBestStreak.streak) {
          userBestStreak = { streak: currentStreak, startDate: currentStart, endDate: currentEnd };
        }

        if (userBestStreak.streak >= 2) {
          allWithoutMziStreaks.push({ userId: member.id, ...userBestStreak });
        }
      }

      const maxWithoutMziStreak = Math.max(0, ...allWithoutMziStreaks.map(s => s.streak));

      if (maxWithoutMziStreak >= 2) {
        const holders: StreakRecordHolder[] = allWithoutMziStreaks
          .filter(s => s.streak === maxWithoutMziStreak)
          .map(s => {
            const member = MEMBERS.find(m => m.id === s.userId);
            return {
              user_id: s.userId,
              member_name: member?.name || 'Unknown',
              member_slug: member?.slug || '',
              start_date: s.startDate,
              end_date: s.endDate,
            };
          });

        longestWithoutMziRecord = {
          streak: maxWithoutMziStreak,
          holders,
        };
      }
    }

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
      daily_record: dailyRecord,
      weekly_record: weeklyRecord,
      daily_streak_record: dailyStreakRecord,
      weekly_streak_record: weeklyStreakRecord,
      most_drere_record: mostDrereRecord,
      most_mzi_record: mostMziRecord,
      most_exact_scores_record: mostExactScoresRecord,
      most_visionary_record: mostVisionaryRecord,
      best_average_record: bestAverageRecord,
      mzi_streak_record: mziStreakRecord,
      longest_without_mzi_record: longestWithoutMziRecord,
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
