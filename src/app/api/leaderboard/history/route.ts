import { NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import { MEMBERS } from '@/data/members';

interface DayPoints {
  date: string;
  [userId: string]: number | string; // date is string, rest are numbers
}

// GET /api/leaderboard/history - Get cumulative points per user per day
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Non connecté' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Get all points with their match results dates
    const { data: pointsData, error } = await supabase
      .from('points_log')
      .select(`
        user_id,
        total_points,
        match_id,
        match_results!inner(entered_at)
      `)
      .order('match_results(entered_at)', { ascending: true });

    if (error) {
      console.error('[LeaderboardHistory] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Group points by date and user
    const pointsByDateAndUser: Record<string, Record<string, number>> = {};

    for (const p of pointsData || []) {
      const enteredAt = (p.match_results as any)?.entered_at;
      if (!enteredAt) continue;

      const date = new Date(enteredAt).toISOString().split('T')[0];

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

    // Return member info for legend
    const members = MEMBERS.map(m => ({
      id: m.id,
      name: m.name.split(' ')[0], // First name only
      slug: m.slug,
    }));

    return NextResponse.json({ history, members });
  } catch (error) {
    console.error('[LeaderboardHistory] Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
