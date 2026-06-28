import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/auth/session';

interface TeamOverride {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  source: 'auto' | 'admin';
}

// GET /api/knockout/teams - Get all team overrides for knockout matches
export async function GET() {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('match_team_overrides')
    .select('match_id, home_team, away_team, source')
    .order('match_id');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const overrides: TeamOverride[] = (data || []).map(d => ({
    matchId: d.match_id,
    homeTeam: d.home_team,
    awayTeam: d.away_team,
    source: d.source as 'auto' | 'admin',
  }));

  return NextResponse.json({ overrides });
}
