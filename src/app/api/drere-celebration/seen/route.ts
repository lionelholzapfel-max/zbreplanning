import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';

// Helper to get the Monday of a given week (at 6am UTC)
function getWeekStartDate(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const hour = d.getUTCHours();
  const daysToSubtract = day === 0 ? 6 : (day === 1 && hour < 6 ? 7 : day - 1);
  d.setUTCDate(d.getUTCDate() - daysToSubtract);
  d.setUTCHours(6, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

// POST /api/drere-celebration/seen - Mark that user saw their Drère celebration
// Body: { type: 'daily' | 'weekly' }
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Non connecté' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const type = body.type || 'daily';

    const supabase = getSupabaseAdmin();
    const now = new Date();

    let awardDate: string;
    let awardType: string;

    if (type === 'weekly') {
      awardDate = getWeekStartDate(now);
      awardType = 'drere_week';
    } else {
      // Daily logic (drere or mzi)
      const hour = now.getUTCHours();
      if (hour < 7) {
        const twoDaysAgo = new Date(now.getTime() - 2 * 86400000);
        awardDate = twoDaysAgo.toISOString().split('T')[0];
      } else {
        const yesterday = new Date(now.getTime() - 86400000);
        awardDate = yesterday.toISOString().split('T')[0];
      }
      awardType = type === 'mzi' ? 'mzi' : 'drere';
    }

    // Update the celebration_seen_at for this user's award
    const { error } = await supabase
      .from('daily_awards')
      .update({ celebration_seen_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('award_date', awardDate)
      .eq('award_type', awardType);

    if (error) {
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
    }

    return NextResponse.json({ success: true, date: awardDate, type: awardType });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
