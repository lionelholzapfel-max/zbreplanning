import { NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import { MEMBERS } from '@/data/members';

// GET /api/drere-celebration/check - Check if current user is Drère du jour
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ isDrere: false });
    }

    const supabase = getSupabaseAdmin();

    // Get today's display date (same logic as leaderboard)
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

    // Check if user is Drère for today
    const { data: drereAward } = await supabase
      .from('daily_awards')
      .select('user_id, points_earned, celebration_seen_at')
      .eq('award_date', drereDisplayDate)
      .eq('award_type', 'drere')
      .eq('user_id', user.id)
      .single();

    if (!drereAward) {
      return NextResponse.json({ isDrere: false });
    }

    // Check if already seen
    const alreadySeen = !!drereAward.celebration_seen_at;

    // Get member info
    const member = MEMBERS.find(m => m.id === user.id);

    return NextResponse.json({
      isDrere: true,
      alreadySeen,
      member_name: member?.name || 'Drère',
      member_slug: member?.slug || 'unknown',
      points: drereAward.points_earned,
      date: drereDisplayDate,
    });
  } catch (error) {
    console.error('[DrèreCelebration] Check error:', error);
    return NextResponse.json({ isDrere: false });
  }
}
