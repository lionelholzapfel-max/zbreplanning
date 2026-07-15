import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/auth/session';

// Verify cron secret for security
function verifyCronSecret(request: NextRequest): boolean {
  // Check Vercel cron header FIRST (automatic cron calls)
  // Vercel sets this header for scheduled cron jobs
  const vercelCron = request.headers.get('x-vercel-cron');
  if (vercelCron) return true;

  // Check Authorization header (manual calls) - requires CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) return true;

  return false;
}

/**
 * Get the boundaries of the week that JUST ENDED
 * The cron runs Monday at 6am to calculate the previous week (Mon 6am to Mon 6am)
 */
function getWeekBoundaries(now: Date): { weekStart: Date; weekEnd: Date; weekLabel: string } {
  const d = new Date(now);
  const day = d.getUTCDay();

  // Find the most recent Monday
  let daysToMostRecentMonday: number;
  if (day === 0) {
    daysToMostRecentMonday = 6; // Sunday -> Monday was 6 days ago
  } else {
    daysToMostRecentMonday = day - 1; // Monday=0, Tuesday=1, etc.
  }

  // The week that just ended STARTED 7 days before the most recent Monday
  const weekStart = new Date(d);
  weekStart.setUTCDate(weekStart.getUTCDate() - daysToMostRecentMonday - 7);
  weekStart.setUTCHours(6, 0, 0, 0);

  // Week end is 7 days after week start (the most recent Monday at 6am)
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  // Week label is the Monday date that started the week
  const weekLabel = weekStart.toISOString().split('T')[0];

  return { weekStart, weekEnd, weekLabel };
}

// GET /api/awards/weekly - Calculate weekly Drère (called by cron on Monday at 6am)
export async function GET(request: NextRequest) {
  // Allow manual trigger for testing, but verify cron for production
  const isManual = request.nextUrl.searchParams.get('manual') === 'true';
  if (!isManual && !verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const now = new Date();
  const { weekStart, weekEnd, weekLabel } = getWeekBoundaries(now);

  try {
    // Get all points earned during this week
    // We look at match_results.entered_at to determine when points were earned
    const { data: pointsData, error: pointsError } = await supabase
      .from('points_log')
      .select(`
        user_id,
        total_points,
        match_id,
        match_results!inner(entered_at)
      `)
      .gte('match_results.entered_at', weekStart.toISOString())
      .lt('match_results.entered_at', weekEnd.toISOString());

    if (pointsError) {
      return NextResponse.json({ error: pointsError.message }, { status: 500 });
    }

    if (!pointsData || pointsData.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No matches this week',
        weekLabel,
      });
    }

    // Sum points per user
    const userPoints: Record<string, number> = {};
    for (const p of pointsData) {
      userPoints[p.user_id] = (userPoints[p.user_id] || 0) + p.total_points;
    }

    // Find max points
    const maxPoints = Math.max(...Object.values(userPoints));
    if (maxPoints === 0) {
      return NextResponse.json({
        success: true,
        message: 'No points earned this week',
        weekLabel,
      });
    }

    // Find users with max points (Drère of the Week)
    const drereWeekUsers = Object.entries(userPoints)
      .filter(([, points]) => points === maxPoints)
      .map(([userId]) => userId);

    // Delete existing weekly award for this week
    await supabase
      .from('daily_awards')
      .delete()
      .eq('award_date', weekLabel)
      .eq('award_type', 'drere_week');

    // Create weekly Drère awards
    const weeklyAwards = drereWeekUsers.map(userId => ({
      user_id: userId,
      award_date: weekLabel,
      award_type: 'drere_week' as const,
      points_earned: maxPoints,
    }));

    await supabase.from('daily_awards').insert(weeklyAwards);

    // Chain the Drère of the Week song generation with the SAME weekLabel
    // (the awards are stored under the Monday that STARTED the ended week —
    // without this explicit week_start the song route would look one week off).
    let songTrigger: string;
    try {
      const baseUrl = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || 'zbreplanning.vercel.app'}`;
      const songResponse = await fetch(`${baseUrl}/api/drere-song`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CRON_SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ week_start: weekLabel }),
      });
      const songResult = await songResponse.json().catch(() => ({}));
      songTrigger = songResponse.ok
        ? (songResult.message || 'started')
        : `failed (${songResponse.status}): ${songResult.error || 'unknown error'}`;
    } catch (songError) {
      // La chanson est du bonus : son échec ne doit pas faire échouer les awards.
      songTrigger = `failed: ${songError instanceof Error ? songError.message : 'unknown error'}`;
    }
    console.log(`[awards/weekly] week=${weekLabel} drere=${drereWeekUsers.join(',')} song=${songTrigger}`);

    return NextResponse.json({
      success: true,
      weekLabel,
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      drereWeekUsers,
      maxPoints,
      allUserPoints: userPoints,
      songTrigger,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
