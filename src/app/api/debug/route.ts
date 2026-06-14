import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/auth/session';
import matches from '@/data/matches.json';

function getCompetitionDay(date: string, time: string): string {
  const hour = parseInt(time.split(':')[0], 10);
  if (hour < 9) {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }
  return date;
}

export async function GET() {
  const supabase = getSupabaseAdmin();

  // Calculate drereDisplayDate (same logic as leaderboard API)
  const now = new Date();
  const hour = now.getUTCHours();
  let drereDisplayDate: string;

  if (hour < 7) {
    const twoDaysAgo = new Date(now.getTime() - 2 * 86400000);
    drereDisplayDate = twoDaysAgo.toISOString().split('T')[0];
  } else {
    const yesterday = new Date(now.getTime() - 86400000);
    drereDisplayDate = yesterday.toISOString().split('T')[0];
  }

  // Get all daily awards
  const { data: allAwards } = await supabase
    .from('daily_awards')
    .select('*')
    .order('award_date', { ascending: false });

  // Get points_log for drereDisplayDate
  const matchesOnDate = (matches as any[]).filter(m =>
    getCompetitionDay(m.date, m.time) === drereDisplayDate
  );
  const matchIds = matchesOnDate.map(m => m.id);

  const { data: pointsData } = await supabase
    .from('points_log')
    .select('user_id, match_id, total_points')
    .in('match_id', matchIds);

  // Calculate user totals for that date
  const userPoints: Record<string, number> = {};
  for (const p of pointsData || []) {
    userPoints[p.user_id] = (userPoints[p.user_id] || 0) + p.total_points;
  }

  const pointsValues = Object.values(userPoints);
  const maxPoints = pointsValues.length > 0 ? Math.max(...pointsValues) : 0;
  const minPoints = pointsValues.length > 0 ? Math.min(...pointsValues) : 0;

  // Get mzi awards specifically
  const { data: mziAwards } = await supabase
    .from('daily_awards')
    .select('*')
    .eq('award_type', 'mzi')
    .order('award_date', { ascending: false });

  // Calculate who should be mzi
  const mziUserIds = minPoints < maxPoints
    ? Object.entries(userPoints)
        .filter(([, points]) => points === minPoints)
        .map(([userId]) => userId)
    : [];

  return NextResponse.json({
    now: now.toISOString(),
    utcHour: hour,
    drereDisplayDate,
    matchesOnDate: matchesOnDate.map(m => ({ id: m.id, match: m.match, date: m.date, time: m.time })),
    matchIds,
    userPointsForDate: userPoints,
    maxPoints,
    minPoints,
    wouldHaveMzi: minPoints < maxPoints,
    expectedMziUserIds: mziUserIds,
    allDrereAwards: allAwards?.filter(a => a.award_type === 'drere').slice(0, 10),
    allMziAwards: mziAwards?.slice(0, 10) || [],
  });
}
