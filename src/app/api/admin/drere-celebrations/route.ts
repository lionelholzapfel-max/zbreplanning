import { NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import { MEMBERS } from '@/data/members';

// GET /api/admin/drere-celebrations - Get all Drère awards with celebration status
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Non connecté' }, { status: 401 });
    }

    // Simple admin check - only Lionel can access
    if (user.id !== '7') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    const { data: awards } = await supabase
      .from('daily_awards')
      .select('user_id, award_date, points_earned, celebration_seen_at')
      .eq('award_type', 'drere')
      .order('award_date', { ascending: false })
      .limit(30);

    // Add member names
    const awardsWithNames = (awards || []).map(award => {
      const member = MEMBERS.find(m => m.id === award.user_id);
      return {
        ...award,
        member_name: member?.name || 'Inconnu',
      };
    });

    return NextResponse.json({ awards: awardsWithNames });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
