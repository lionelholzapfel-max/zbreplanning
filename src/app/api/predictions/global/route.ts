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
    console.log('[GlobalPredictions] POST - User:', user?.id, user?.member_name);

    if (!user) {
      console.log('[GlobalPredictions] POST - No user session');
      return NextResponse.json(
        { error: 'Non connecté' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { prediction_type, prediction_value } = body;
    console.log('[GlobalPredictions] POST - Input:', { prediction_type, prediction_value });

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

    // Check if prediction already exists
    const { data: existing } = await supabase
      .from('predictions')
      .select('id')
      .eq('user_id', user.id)
      .eq('prediction_type', prediction_type)
      .single();

    let saved;
    let saveError;

    if (existing) {
      // UPDATE existing prediction
      console.log('[GlobalPredictions] Updating existing prediction:', existing.id);
      const { data, error } = await supabase
        .from('predictions')
        .update({
          prediction_value,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();
      saved = data;
      saveError = error;
    } else {
      // INSERT new prediction
      console.log('[GlobalPredictions] Creating new prediction');
      const { data, error } = await supabase
        .from('predictions')
        .insert({
          user_id: user.id,
          prediction_type,
          prediction_value,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      saved = data;
      saveError = error;
    }

    console.log('[GlobalPredictions] Save result:', {
      saved,
      error: saveError?.message,
      code: saveError?.code,
      details: saveError?.details
    });

    if (saveError) {
      console.error('[GlobalPredictions] Error saving prediction:', saveError);
      return NextResponse.json(
        {
          error: `Erreur sauvegarde: ${saveError.message}`,
          code: saveError.code,
          details: saveError.details,
        },
        { status: 500 }
      );
    }

    console.log('[GlobalPredictions] Success! Saved:', saved);
    return NextResponse.json({
      success: true,
      prediction: saved,
    });
  } catch (error) {
    console.error('[GlobalPredictions] POST error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
