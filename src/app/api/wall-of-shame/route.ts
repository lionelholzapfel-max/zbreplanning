import { NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import { MEMBERS } from '@/data/members';
import matches from '@/data/matches.json';

interface ShameEntry {
  user_id: string;
  member_name: string;
  member_slug: string;
  match_id: number;
  match_name: string;
  predicted_home: number;
  predicted_away: number;
  actual_home: number;
  actual_away: number;
  shame_score: number; // How wrong they were
  date: string;
}

// GET /api/wall-of-shame - Get the worst predictions of the week
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Non connecté' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Get results from the last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: results, error: rError } = await supabase
      .from('match_results')
      .select('match_id, home_score, away_score, entered_at')
      .gte('entered_at', weekAgo.toISOString());

    if (rError || !results || results.length === 0) {
      return NextResponse.json({ shameList: [] });
    }

    const matchIds = results.map(r => r.match_id);

    // Get predictions for these matches
    const { data: predictions, error: pError } = await supabase
      .from('match_score_predictions')
      .select('user_id, match_id, home_score, away_score')
      .in('match_id', matchIds);

    if (pError || !predictions) {
      return NextResponse.json({ shameList: [] });
    }

    // Calculate shame scores (how wrong each prediction was)
    const shameEntries: ShameEntry[] = [];

    for (const pred of predictions) {
      const result = results.find(r => r.match_id === pred.match_id);
      if (!result) continue;

      const member = MEMBERS.find(m => m.id === pred.user_id);
      if (!member) continue;

      const match = (matches as any[]).find(m => m.id === pred.match_id);
      if (!match) continue;

      // Shame score = total goal difference
      const homeDiff = Math.abs(pred.home_score - result.home_score);
      const awayDiff = Math.abs(pred.away_score - result.away_score);
      const shameScore = homeDiff + awayDiff;

      // Only include predictions that were really wrong (at least 3 goals off)
      if (shameScore >= 3) {
        shameEntries.push({
          user_id: pred.user_id,
          member_name: member.name,
          member_slug: member.slug,
          match_id: pred.match_id,
          match_name: match.match,
          predicted_home: pred.home_score,
          predicted_away: pred.away_score,
          actual_home: result.home_score,
          actual_away: result.away_score,
          shame_score: shameScore,
          date: result.entered_at,
        });
      }
    }

    // Sort by shame score (worst first) and take top 3
    shameEntries.sort((a, b) => b.shame_score - a.shame_score);
    const top3 = shameEntries.slice(0, 3);

    return NextResponse.json({ shameList: top3 });
  } catch (error) {
    console.error('[WallOfShame] Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
