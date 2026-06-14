import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/auth/session';

export async function GET() {
  const supabase = getSupabaseAdmin();

  const { data: mziAwards } = await supabase
    .from('daily_awards')
    .select('*')
    .eq('award_type', 'mzi')
    .order('award_date', { ascending: false });

  const { data: allAwardsToday } = await supabase
    .from('daily_awards')
    .select('*')
    .eq('award_date', '2026-06-13');

  return NextResponse.json({
    mziAwards,
    allAwardsForJune13: allAwardsToday,
  });
}
