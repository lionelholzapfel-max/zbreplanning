import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/auth/session';
import { MEMBERS } from '@/data/members';

export async function GET() {
  const supabase = getSupabaseAdmin();

  // Same logic as leaderboard API
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

  const { data: todayMzi } = await supabase
    .from('daily_awards')
    .select('user_id, points_earned')
    .eq('award_date', drereDisplayDate)
    .eq('award_type', 'mzi');

  const todayMziIds = new Set((todayMzi || []).map(d => d.user_id));

  // Check each member
  const memberMziStatus = MEMBERS.map(m => ({
    id: m.id,
    name: m.name,
    is_mzi_today: todayMziIds.has(m.id),
  }));

  return NextResponse.json({
    drereDisplayDate,
    todayMzi,
    todayMziIds: Array.from(todayMziIds),
    memberMziStatus: memberMziStatus.filter(m => m.is_mzi_today),
    allMembers: MEMBERS.map(m => ({ id: m.id, name: m.name })),
  });
}
