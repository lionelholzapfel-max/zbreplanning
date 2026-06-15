import { NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';

// POST /api/drere-celebration/seen - Mark that user saw their Drère celebration
export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Non connecté' }, { status: 401 });
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

    // Update the celebration_seen_at for this user's drere award
    const { error } = await supabase
      .from('daily_awards')
      .update({ celebration_seen_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('award_date', drereDisplayDate)
      .eq('award_type', 'drere');

    if (error) {
      console.error('[DrèreCelebration] Error:', error);
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }

    return NextResponse.json({ success: true, date: drereDisplayDate });
  } catch (error) {
    console.error('[DrèreCelebration] Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
