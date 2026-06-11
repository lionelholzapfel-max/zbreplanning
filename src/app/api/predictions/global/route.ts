import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import { areGlobalPredictionsLocked, getTimeUntilGlobalLock, FIRST_MATCH_KICKOFF } from '@/lib/matches';

export type GlobalPredictionType = 'winner' | 'best_player' | 'best_young' | 'surprise_team';

// GET /api/predictions/global
// Always returns ALL predictions (fun > anti-cheat)
// Lock status still matters for write operations (POST)
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
    const locked = areGlobalPredictionsLocked();
    const timeUntilLock = getTimeUntilGlobalLock();

    // Always return ALL predictions (decision: fun > anti-cheat)
    const { data: predictions, error } = await supabase
      .from('predictions')
      .select('*, user:users!user_id(member_name, member_slug)')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[GlobalPredictions] Error getting predictions:', error);
      return NextResponse.json(
        { error: 'Erreur base de données' },
        { status: 500 }
      );
    }

    // Count predictions per type
    const countByType: Record<string, number> = {};
    (predictions || []).forEach(p => {
      countByType[p.prediction_type] = (countByType[p.prediction_type] || 0) + 1;
    });

    return NextResponse.json({
      locked,
      lockDate: FIRST_MATCH_KICKOFF.toISOString(),
      timeUntilLock: locked ? -1 : timeUntilLock,
      predictions: predictions || [],
      myPredictions: (predictions || []).filter(p => p.user_id === user.id),
      totalPredictionsByType: countByType,
    });
  } catch (error) {
    console.error('[GlobalPredictions] GET error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// POST /api/predictions/global
// Create or update a global prediction (only if not locked)
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non connecté' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { prediction_type, prediction_value } = body;

    // Validate input
    if (!prediction_type || !prediction_value) {
      return NextResponse.json(
        { error: 'prediction_type et prediction_value requis' },
        { status: 400 }
      );
    }

    const validTypes = ['winner', 'best_player', 'best_young', 'surprise_team'];
    if (!validTypes.includes(prediction_type)) {
      return NextResponse.json(
        { error: 'Type de pronostic invalide' },
        { status: 400 }
      );
    }

    // Check if predictions are locked (ANTI-CHEAT)
    if (areGlobalPredictionsLocked()) {
      return NextResponse.json(
        { error: 'Pronos globaux verrouillés 🔒 (depuis le premier match)' },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Check if prediction exists
    const { data: existing } = await supabase
      .from('predictions')
      .select('id')
      .eq('user_id', user.id)
      .eq('prediction_type', prediction_type)
      .single();

    if (existing) {
      // Update existing prediction
      const { error: updateError } = await supabase
        .from('predictions')
        .update({
          prediction_value,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('[GlobalPredictions] Error updating prediction:', updateError);
        return NextResponse.json(
          { error: 'Erreur lors de la mise à jour' },
          { status: 500 }
        );
      }
    } else {
      // Create new prediction
      const { error: insertError } = await supabase
        .from('predictions')
        .insert({
          user_id: user.id,
          prediction_type,
          prediction_value,
        });

      if (insertError) {
        console.error('[GlobalPredictions] Error creating prediction:', insertError);
        return NextResponse.json(
          { error: 'Erreur lors de la création' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      prediction: {
        prediction_type,
        prediction_value,
      },
    });
  } catch (error) {
    console.error('[GlobalPredictions] POST error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
