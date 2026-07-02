import { getSupabaseAdmin } from '@/lib/auth/session';
import matches from '@/data/matches.json';

/**
 * Get the "competition day" (session) for a match.
 * Session = soirée foot belge: 18h00 jour N → 08h59 jour N+1, nouvelle session à 09h00.
 * A match kicking off before 09:00 belongs to the PREVIOUS calendar day's session.
 *
 * Uses UTC arithmetic so the result never depends on the server timezone.
 */
export function getCompetitionDay(date: string, time: string): string {
  const hour = parseInt(time.split(':')[0], 10);

  if (hour < 9) {
    const [y, m, day] = date.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, day - 1)).toISOString().split('T')[0];
  }

  return date;
}

/**
 * Recompute the daily awards (Drère = most points, Type mzi = fewest points) for a
 * given competition day. Single source of truth shared by the admin entry and the
 * auto-sync — do NOT duplicate this logic per-route (it drifts).
 *
 * Note: awards are computed over users who have a points_log row that day (i.e. who
 * actually predicted); a member with no prono is not ranked for the mzi.
 * Does not send notifications.
 */
export async function updateDailyAwards(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  dateStr: string
) {
  // Matches that belong to this competition day
  const matchesOnCompetitionDay = (matches as any[]).filter(
    (m) => getCompetitionDay(m.date, m.time) === dateStr
  );
  if (matchesOnCompetitionDay.length === 0) return;

  const matchIds = matchesOnCompetitionDay.map((m) => m.id);

  // Which of these matches have a result
  const { data: resultsData } = await supabase
    .from('match_results')
    .select('match_id')
    .in('match_id', matchIds);

  if (!resultsData || resultsData.length === 0) return;

  const completedMatchIds = resultsData.map((r) => r.match_id);

  // Points for completed matches on this day
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

  const maxPoints = Math.max(...Object.values(userPoints));
  if (maxPoints === 0) return;

  // Drère = most points (can be tied)
  const drereUsers = Object.entries(userPoints)
    .filter(([, points]) => points === maxPoints)
    .map(([userId]) => userId);

  // Type mzi = fewest points, only when not everyone is tied
  const minPoints = Math.min(...Object.values(userPoints));
  const mziUsers =
    minPoints < maxPoints
      ? Object.entries(userPoints)
          .filter(([, points]) => points === minPoints)
          .map(([userId]) => userId)
      : [];

  // Drère awards (replace existing for the day)
  await supabase
    .from('daily_awards')
    .delete()
    .eq('award_date', dateStr)
    .eq('award_type', 'drere');

  const drereAwards = drereUsers.map((userId) => ({
    user_id: userId,
    award_date: dateStr,
    award_type: 'drere' as const,
    points_earned: maxPoints,
  }));

  await supabase.from('daily_awards').insert(drereAwards);

  // Type mzi awards (replace existing for the day)
  await supabase
    .from('daily_awards')
    .delete()
    .eq('award_date', dateStr)
    .eq('award_type', 'mzi');

  if (mziUsers.length > 0) {
    const mziAwards = mziUsers.map((userId) => ({
      user_id: userId,
      award_date: dateStr,
      award_type: 'mzi' as const,
      points_earned: minPoints,
    }));

    await supabase.from('daily_awards').insert(mziAwards);
  }
}
