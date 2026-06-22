import { NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import { MEMBERS } from '@/data/members';

interface DayPoints {
  date: string;
  [userId: string]: number | string;
}

// GET /api/leaderboard/history - Get cumulative points per user per day
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Non connecté' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Get all match results with dates
    const { data: matchResults, error: mrError } = await supabase
      .from('match_results')
      .select('match_id, entered_at')
      .order('entered_at', { ascending: true });

    if (mrError) {
      console.error('[LeaderboardHistory] Match results error:', mrError);
      return NextResponse.json({ error: mrError.message }, { status: 500 });
    }

    if (!matchResults || matchResults.length === 0) {
      return NextResponse.json({ history: [], members: [] });
    }

    // Get all points
    const { data: pointsData, error: pError } = await supabase
      .from('points_log')
      .select('user_id, total_points, match_id');

    if (pError) {
      console.error('[LeaderboardHistory] Points error:', pError);
      return NextResponse.json({ error: pError.message }, { status: 500 });
    }

    // Create a map of match_id -> entered_at date
    const matchDateMap: Record<number, string> = {};
    for (const mr of matchResults) {
      const date = new Date(mr.entered_at).toISOString().split('T')[0];
      matchDateMap[mr.match_id] = date;
    }

    // Group points by date and user
    const pointsByDateAndUser: Record<string, Record<string, number>> = {};

    for (const p of pointsData || []) {
      const date = matchDateMap[p.match_id];
      if (!date) continue;

      if (!pointsByDateAndUser[date]) {
        pointsByDateAndUser[date] = {};
      }

      if (!pointsByDateAndUser[date][p.user_id]) {
        pointsByDateAndUser[date][p.user_id] = 0;
      }

      pointsByDateAndUser[date][p.user_id] += p.total_points;
    }

    // Get sorted dates
    const dates = Object.keys(pointsByDateAndUser).sort();

    if (dates.length === 0) {
      return NextResponse.json({ history: [], members: [] });
    }

    // Build cumulative data
    const cumulativePoints: Record<string, number> = {};
    MEMBERS.forEach(m => { cumulativePoints[m.id] = 0; });

    const history: DayPoints[] = [];

    for (const date of dates) {
      // Add day's points to cumulative
      for (const [userId, points] of Object.entries(pointsByDateAndUser[date])) {
        cumulativePoints[userId] = (cumulativePoints[userId] || 0) + points;
      }

      // Create data point for this date
      const dataPoint: DayPoints = { date };
      MEMBERS.forEach(m => {
        dataPoint[m.id] = cumulativePoints[m.id];
      });

      history.push(dataPoint);
    }

    // Only return members who have points (active players)
    const activeMembers = MEMBERS
      .filter(m => cumulativePoints[m.id] > 0)
      .map(m => ({
        id: m.id,
        name: m.name.split(' ')[0],
        slug: m.slug,
      }));

    return NextResponse.json({ history, members: activeMembers });
  } catch (error) {
    console.error('[LeaderboardHistory] Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
