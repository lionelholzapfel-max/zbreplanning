import { NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';

// GET /api/predictions/my-scores
// Returns all score predictions for the current user in one request
// This replaces 20+ individual requests to /api/predictions/score
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non connecté' },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Get all predictions for this user
    const { data: predictions, error } = await supabase
      .from('match_score_predictions')
      .select('match_id, home_score, away_score')
      .eq('user_id', user.id);

    if (error) {
      console.error('[MyScores] Error:', error);
      return NextResponse.json(
        { error: 'Erreur base de données' },
        { status: 500 }
      );
    }

    // Return as a map of matchId -> prediction
    const predictionsMap: Record<number, { home_score: number; away_score: number }> = {};
    for (const p of predictions || []) {
      predictionsMap[p.match_id] = {
        home_score: p.home_score,
        away_score: p.away_score,
      };
    }

    return NextResponse.json({
      predictions: predictionsMap,
      matchIds: Object.keys(predictionsMap).map(Number),
    }, {
      headers: {
        'Cache-Control': 'private, max-age=10, stale-while-revalidate=30',
      },
    });
  } catch (err) {
    console.error('[MyScores] Unexpected error:', err);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
