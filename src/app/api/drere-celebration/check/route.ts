import { NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import { MEMBERS } from '@/data/members';

// Helper to get the Monday of a given week (at 6am UTC = 8am Belgian time)
function getWeekStartDate(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const hour = d.getUTCHours();

  // If it's Monday before 6am UTC, we're still in the previous week
  const daysToSubtract = day === 0 ? 6 : (day === 1 && hour < 6 ? 7 : day - 1);
  d.setUTCDate(d.getUTCDate() - daysToSubtract);
  d.setUTCHours(6, 0, 0, 0);

  return d.toISOString().split('T')[0];
}

// GET /api/drere-celebration/check - Check if current user is Drère du jour or Drère of the Week
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ isDrere: false, isDrereWeek: false });
    }

    const supabase = getSupabaseAdmin();
    const now = new Date();
    const hour = now.getUTCHours();

    // Get today's display date for daily Drère
    let drereDisplayDate: string;
    if (hour < 6) {
      const twoDaysAgo = new Date(now.getTime() - 2 * 86400000);
      drereDisplayDate = twoDaysAgo.toISOString().split('T')[0];
    } else {
      const yesterday = new Date(now.getTime() - 86400000);
      drereDisplayDate = yesterday.toISOString().split('T')[0];
    }

    // Get the week start date for weekly Drère (last Monday at 6am)
    const weekStartDate = getWeekStartDate(now);

    // Check daily Drère
    const { data: drereAward } = await supabase
      .from('daily_awards')
      .select('user_id, points_earned, celebration_seen_at')
      .eq('award_date', drereDisplayDate)
      .eq('award_type', 'drere')
      .eq('user_id', user.id)
      .single();

    // Check weekly Drère
    const { data: weeklyAward } = await supabase
      .from('daily_awards')
      .select('user_id, points_earned, celebration_seen_at')
      .eq('award_date', weekStartDate)
      .eq('award_type', 'drere_week')
      .eq('user_id', user.id)
      .single();

    // Check daily MZI (Type mzi du jour - worst performer)
    const { data: mziAward } = await supabase
      .from('daily_awards')
      .select('user_id, points_earned, celebration_seen_at')
      .eq('award_date', drereDisplayDate)
      .eq('award_type', 'mzi')
      .eq('user_id', user.id)
      .single();

    const member = MEMBERS.find(m => m.id === user.id);

    // Return daily, weekly and MZI status
    return NextResponse.json({
      // Daily Drère
      isDrere: !!drereAward,
      alreadySeen: drereAward?.celebration_seen_at ? true : false,
      member_name: member?.name || 'Drère',
      member_slug: member?.slug || 'unknown',
      points: drereAward?.points_earned || 0,
      date: drereDisplayDate,
      // Weekly Drère
      isDrereWeek: !!weeklyAward,
      alreadySeenWeek: weeklyAward?.celebration_seen_at ? true : false,
      weekPoints: weeklyAward?.points_earned || 0,
      weekDate: weekStartDate,
      // Daily MZI
      isMzi: !!mziAward,
      alreadySeenMzi: mziAward?.celebration_seen_at ? true : false,
      mziPoints: mziAward?.points_earned || 0,
    });
  } catch (error) {
    return NextResponse.json({ isDrere: false, isDrereWeek: false });
  }
}
