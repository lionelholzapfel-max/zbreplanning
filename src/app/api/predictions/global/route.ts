import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import { areGlobalPredictionsLocked, getTimeUntilGlobalLock, GLOBAL_PREDICTIONS_LOCK } from '@/lib/matches';
import { MEMBERS } from '@/data/members';

export type GlobalPredictionType = 'winner' | 'best_player' | 'best_young' | 'surprise_team';

// GET /api/predictions/global
// SECURITY: Predictions are hidden until lock time (2h before first match)
// - Before lock: return only {user_id, prediction_type} of predictors + current user's own predictions
// - After lock: return all predictions with values
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

    // Fetch all predictions from database
    // Note: Don't use join syntax - FK relationship may not be in schema cache
    const { data: predictions, error } = await supabase
      .from('predictions')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[GlobalPredictions] Error getting predictions:', error);
      return NextResponse.json(
        { error: 'Erreur base de données' },
        { status: 500 }
      );
    }

    // Get current user's predictions (always visible to them)
    const myPredictions = (predictions || [])
      .filter(p => p.user_id === user.id)
      .map(p => {
        const member = MEMBERS.find(m => m.id === p.user_id);
        return {
          ...p,
          user: member ? { member_name: member.name, member_slug: member.slug } : null,
        };
      });

    // Count predictions per type (public info: who has predicted what type)
    const countByType: Record<string, number> = {};
    (predictions || []).forEach(p => {
      countByType[p.prediction_type] = (countByType[p.prediction_type] || 0) + 1;
    });

    if (locked) {
      // AFTER LOCK: Return all predictions with values
      const enrichedPredictions = (predictions || []).map(p => {
        const member = MEMBERS.find(m => m.id === p.user_id);
        return {
          user_id: p.user_id,
          prediction_type: p.prediction_type,
          prediction_value: p.prediction_value,
          user: member ? { member_name: member.name, member_slug: member.slug } : null,
        };
      });

      return NextResponse.json({
        locked,
        lockDate: GLOBAL_PREDICTIONS_LOCK.toISOString(),
        timeUntilLock: -1,
        predictions: enrichedPredictions,
        myPredictions,
        totalPredictionsByType: countByType,
      });
    } else {
      // BEFORE LOCK: Only return who predicted what type (no values)
      // Exception: Current user sees their own predictions
      const publicPredictions = (predictions || []).map(p => {
        const member = MEMBERS.find(m => m.id === p.user_id);
        return {
          user_id: p.user_id,
          prediction_type: p.prediction_type,
          // NO prediction_value for others
          user: member ? { member_name: member.name, member_slug: member.slug } : null,
        };
      });

      return NextResponse.json({
        locked,
        lockDate: GLOBAL_PREDICTIONS_LOCK.toISOString(),
        timeUntilLock,
        predictions: publicPredictions, // Only user_ids + types, no values
        myPredictions, // Current user always sees their own
        totalPredictionsByType: countByType,
      });
    }
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
    // Global predictions lock 2 HOURS BEFORE first match kickoff
    if (areGlobalPredictionsLocked()) {
      return NextResponse.json(
        { error: 'Pronos globaux verrouillés 🔒 (2h avant le premier match)' },
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
