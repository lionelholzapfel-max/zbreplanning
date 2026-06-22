import { NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import { MEMBERS } from '@/data/members';
import matches from '@/data/matches.json';

interface LiveRankingEntry {
  user_id: string;
  member_name: string;
  member_slug: string;
  day_points: number;
  matches_today: number;
}

/**
 * Get the current "competition day" (session in progress)
 * Session = soirée foot belge: 09h00 jour N → 08h59 jour N+1 (heure belge)
 * In UTC: 07:00 jour N → 06:59 jour N+1
 */
function getCurrentCompetitionDay(): string {
  const now = new Date();
  const hour = now.getUTCHours();

  // Before 07:00 UTC (09:00 Belgian) - still in previous day's session
  if (hour < 7) {
    const yesterday = new Date(now.getTime() - 86400000);
    return yesterday.toISOString().split('T')[0];
  }

  return now.toISOString().split('T')[0];
}

/**
 * Get matches for a competition day
 * Matches belong to a day if they start between 09:00 that day and 08:59 next day (Belgian time)
 */
function getMatchesForCompetitionDay(dateStr: string): number[] {
  const matchIds: number[] = [];

  for (const match of matches as any[]) {
    const hour = parseInt(match.time.split(':')[0], 10);

    // If match is before 09:00, it belongs to the previous day's session
    if (hour < 9) {
      // Check if match date is day AFTER the competition day
      const matchDate = new Date(match.date);
      const compDate = new Date(dateStr);
      compDate.setDate(compDate.getDate() + 1);

      if (matchDate.toISOString().split('T')[0] === compDate.toISOString().split('T')[0]) {
        matchIds.push(match.id);
      }
    } else {
      // Match is 09:00 or later, belongs to its own date's session
      if (match.date === dateStr) {
        matchIds.push(match.id);
      }
    }
  }

  return matchIds;
}

// GET /api/leaderboard/live - Get live ranking for current day
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Non connecté' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const currentDay = getCurrentCompetitionDay();
    const matchIds = getMatchesForCompetitionDay(currentDay);

    if (matchIds.length === 0) {
      return NextResponse.json({
        date: currentDay,
        matchesToday: 0,
        matchesCompleted: 0,
        ranking: [],
      });
    }

    // Get completed matches for today
    const { data: resultsData } = await supabase
      .from('match_results')
      .select('match_id')
      .in('match_id', matchIds);

    const completedMatchIds = (resultsData || []).map(r => r.match_id);

    if (completedMatchIds.length === 0) {
      // No results yet, return empty ranking
      return NextResponse.json({
        date: currentDay,
        matchesToday: matchIds.length,
        matchesCompleted: 0,
        ranking: [],
      });
    }

    // Get points for completed matches today
    const { data: pointsData } = await supabase
      .from('points_log')
      .select('user_id, total_points, match_id')
      .in('match_id', completedMatchIds);

    // Sum points per user
    const userPoints: Record<string, { points: number; matches: number }> = {};
    for (const p of pointsData || []) {
      if (!userPoints[p.user_id]) {
        userPoints[p.user_id] = { points: 0, matches: 0 };
      }
      userPoints[p.user_id].points += p.total_points;
      userPoints[p.user_id].matches += 1;
    }

    // Build ranking
    const ranking: LiveRankingEntry[] = Object.entries(userPoints)
      .map(([userId, data]) => {
        const member = MEMBERS.find(m => m.id === userId);
        return {
          user_id: userId,
          member_name: member?.name || 'Inconnu',
          member_slug: member?.slug || 'unknown',
          day_points: data.points,
          matches_today: data.matches,
        };
      })
      .sort((a, b) => b.day_points - a.day_points);

    return NextResponse.json({
      date: currentDay,
      matchesToday: matchIds.length,
      matchesCompleted: completedMatchIds.length,
      ranking,
      currentLeader: ranking[0] || null,
    });
  } catch (error) {
    console.error('[LiveRanking] Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
