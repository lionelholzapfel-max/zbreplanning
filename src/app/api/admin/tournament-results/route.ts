import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';

export type TournamentPredictionType = 'winner' | 'best_player' | 'best_young' | 'top_scorer' | 'best_goalkeeper';

const VALID_TYPES: TournamentPredictionType[] = ['winner', 'best_player', 'best_young', 'top_scorer', 'best_goalkeeper'];
const POINTS_PER_CORRECT = 20;

interface TournamentResult {
  prediction_type: TournamentPredictionType;
  result_value: string;
}

// GET /api/admin/tournament-results
// Returns current tournament results (admin only)
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user?.is_admin) {
      return NextResponse.json({ error: 'Admin requis' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();

    // Get tournament results
    const { data: results, error } = await supabase
      .from('tournament_results')
      .select('*')
      .order('prediction_type');

    if (error) {
      // Table might not exist yet
      if (error.code === '42P01') {
        return NextResponse.json({ results: [], needsMigration: true });
      }
      console.error('[TournamentResults] Error fetching:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ results: results || [] });
  } catch (error) {
    console.error('[TournamentResults] GET error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/admin/tournament-results
// Save a tournament result and calculate points (admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user?.is_admin) {
      return NextResponse.json({ error: 'Admin requis' }, { status: 403 });
    }

    const body = await request.json();
    const { prediction_type, result_value } = body as TournamentResult;

    // Validate
    if (!prediction_type || !result_value) {
      return NextResponse.json({ error: 'prediction_type et result_value requis' }, { status: 400 });
    }
    if (!VALID_TYPES.includes(prediction_type)) {
      return NextResponse.json({ error: 'Type invalide' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Check if table exists by trying to upsert
    const { error: upsertError } = await supabase
      .from('tournament_results')
      .upsert(
        {
          prediction_type,
          result_value,
          entered_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'prediction_type' }
      );

    if (upsertError) {
      console.error('[TournamentResults] Upsert error:', upsertError);
      if (upsertError.code === '42P01') {
        return NextResponse.json({
          error: 'Table tournament_results manquante. Exécute la migration V6.',
          needsMigration: true
        }, { status: 500 });
      }
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    // Now calculate points for all users who predicted correctly
    const { data: predictions, error: predError } = await supabase
      .from('predictions')
      .select('user_id, prediction_value')
      .eq('prediction_type', prediction_type)
      .eq('prediction_value', result_value);

    if (predError) {
      console.error('[TournamentResults] Error fetching predictions:', predError);
      // Continue anyway - result was saved
    }

    const winners = predictions || [];
    let pointsAwarded = 0;

    // Award points to correct predictors (using upsert to avoid duplicates)
    for (const pred of winners) {
      const { error: pointsError } = await supabase
        .from('global_prediction_points')
        .upsert(
          {
            user_id: pred.user_id,
            prediction_type,
            predicted_value: pred.prediction_value,
            actual_value: result_value,
            points_awarded: POINTS_PER_CORRECT,
          },
          { onConflict: 'user_id,prediction_type' }
        );

      if (pointsError) {
        console.error('[TournamentResults] Error awarding points:', pointsError);
        // If table doesn't exist, warn but continue
        if (pointsError.code === '42P01') {
          console.warn('global_prediction_points table missing - run migration V6');
        }
      } else {
        pointsAwarded++;
      }
    }

    // Get user names for notification
    const winnerNames = await Promise.all(
      winners.map(async (w) => {
        const { data: userData } = await supabase
          .from('users')
          .select('member_name')
          .eq('id', w.user_id)
          .single();
        return userData?.member_name || w.user_id;
      })
    );

    console.log(`[TournamentResults] ${prediction_type}=${result_value}: ${pointsAwarded} points awarded to: ${winnerNames.join(', ')}`);

    return NextResponse.json({
      success: true,
      result: { prediction_type, result_value },
      winners: winnerNames,
      points_awarded: pointsAwarded * POINTS_PER_CORRECT,
    });
  } catch (error) {
    console.error('[TournamentResults] POST error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
