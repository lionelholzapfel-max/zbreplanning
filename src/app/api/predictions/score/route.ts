import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import { getMatchById, hasMatchStarted, isPredictionLocked, parseMatchTeams, getTimeUntilLock, PREDICTION_LOCK_OFFSET_MS } from '@/lib/matches';

// GET /api/predictions/score?match_id=X
// Returns all predictions if match has started, otherwise only current user's prediction
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non connecté' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const matchIdParam = searchParams.get('match_id');

    if (!matchIdParam) {
      return NextResponse.json(
        { error: 'match_id requis' },
        { status: 400 }
      );
    }

    const matchId = parseInt(matchIdParam, 10);
    if (isNaN(matchId)) {
      return NextResponse.json(
        { error: 'match_id invalide' },
        { status: 400 }
      );
    }

    const match = getMatchById(matchId);
    if (!match) {
      return NextResponse.json(
        { error: 'Match non trouvé' },
        { status: 404 }
      );
    }

    const supabase = getSupabaseAdmin();
    const matchStarted = hasMatchStarted(matchId);
    const predictionLocked = isPredictionLocked(matchId);
    const timeUntilLock = getTimeUntilLock(matchId);

    if (predictionLocked) {
      // Predictions are locked (2h before kickoff) - return ALL predictions with user info
      const { data: predictions, error } = await supabase
        .from('match_score_predictions')
        .select('*, user:users!user_id(member_name, member_slug)')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[Predictions] Error getting predictions:', error);
        return NextResponse.json(
          { error: 'Erreur base de données' },
          { status: 500 }
        );
      }

      // Also get the actual result if available
      const { data: result } = await supabase
        .from('match_results')
        .select('*')
        .eq('match_id', matchId)
        .single();

      // Get points if result exists
      let pointsMap: Record<string, { total: number; base: number; visionary: number; outsider: number; detail: string }> = {};
      if (result) {
        const { data: pointsData } = await supabase
          .from('points_log')
          .select('user_id, total_points, base_points, visionary_bonus, outsider_bonus, detail')
          .eq('match_id', matchId);

        if (pointsData) {
          pointsData.forEach(p => {
            pointsMap[p.user_id] = {
              total: p.total_points,
              base: p.base_points,
              visionary: p.visionary_bonus,
              outsider: p.outsider_bonus,
              detail: p.detail || '',
            };
          });
        }
      }

      // Enrich predictions with points
      const enrichedPredictions = (predictions || []).map(p => ({
        ...p,
        points: pointsMap[p.user_id] || null,
      }));

      return NextResponse.json({
        match: {
          id: match.id,
          ...parseMatchTeams(match.match),
          date: match.dateDisplay,
          time: match.time,
        },
        matchStarted,
        predictionLocked: true,
        predictions: enrichedPredictions,
        result: result || null,
      });
    } else {
      // Predictions still open - return ONLY current user's prediction (anti-cheat)
      const { data: myPrediction, error } = await supabase
        .from('match_score_predictions')
        .select('*')
        .eq('match_id', matchId)
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('[Predictions] Error getting my prediction:', error);
        return NextResponse.json(
          { error: 'Erreur base de données' },
          { status: 500 }
        );
      }

      // Get count of predictions without revealing content
      const { count } = await supabase
        .from('match_score_predictions')
        .select('*', { count: 'exact', head: true })
        .eq('match_id', matchId);

      return NextResponse.json({
        match: {
          id: match.id,
          ...parseMatchTeams(match.match),
          date: match.dateDisplay,
          time: match.time,
        },
        matchStarted: false,
        predictionLocked: false,
        timeUntilLock, // milliseconds until predictions lock
        myPrediction: myPrediction || null,
        totalPredictions: count || 0,
      });
    }
  } catch (error) {
    console.error('[Predictions] GET error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// POST /api/predictions/score
// Create or update a score prediction (only if match hasn't started)
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
    const { match_id, home_score, away_score } = body;

    // Validate input
    if (match_id === undefined || home_score === undefined || away_score === undefined) {
      return NextResponse.json(
        { error: 'match_id, home_score et away_score requis' },
        { status: 400 }
      );
    }

    const matchId = parseInt(match_id, 10);
    const homeScore = parseInt(home_score, 10);
    const awayScore = parseInt(away_score, 10);

    if (isNaN(matchId) || isNaN(homeScore) || isNaN(awayScore)) {
      return NextResponse.json(
        { error: 'Valeurs invalides' },
        { status: 400 }
      );
    }

    if (homeScore < 0 || awayScore < 0 || homeScore > 20 || awayScore > 20) {
      return NextResponse.json(
        { error: 'Scores invalides (0-20)' },
        { status: 400 }
      );
    }

    // Check if match exists
    const match = getMatchById(matchId);
    if (!match) {
      return NextResponse.json(
        { error: 'Match non trouvé' },
        { status: 404 }
      );
    }

    // Check if predictions are locked (ANTI-CHEAT)
    // Predictions lock 2 HOURS BEFORE kickoff
    if (isPredictionLocked(matchId)) {
      return NextResponse.json(
        { error: 'Pronos verrouillés 🔒 (2h avant le match)' },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Upsert prediction
    const { data: existing } = await supabase
      .from('match_score_predictions')
      .select('id')
      .eq('user_id', user.id)
      .eq('match_id', matchId)
      .single();

    if (existing) {
      // Update existing prediction
      const { error: updateError } = await supabase
        .from('match_score_predictions')
        .update({
          home_score: homeScore,
          away_score: awayScore,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('[Predictions] Error updating prediction:', updateError);
        return NextResponse.json(
          { error: 'Erreur lors de la mise à jour' },
          { status: 500 }
        );
      }
    } else {
      // Create new prediction
      const { error: insertError } = await supabase
        .from('match_score_predictions')
        .insert({
          user_id: user.id,
          match_id: matchId,
          home_score: homeScore,
          away_score: awayScore,
        });

      if (insertError) {
        console.error('[Predictions] Error creating prediction:', insertError);
        return NextResponse.json(
          { error: 'Erreur lors de la création' },
          { status: 500 }
        );
      }
    }

    const teams = parseMatchTeams(match.match);

    return NextResponse.json({
      success: true,
      prediction: {
        match_id: matchId,
        home_score: homeScore,
        away_score: awayScore,
        match: `${teams.home} ${homeScore} - ${awayScore} ${teams.away}`,
      },
    });
  } catch (error) {
    console.error('[Predictions] POST error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
