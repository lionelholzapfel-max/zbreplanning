import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import { getMatchById, hasMatchStarted, isPredictionLocked, parseMatchTeams, getTimeUntilLock } from '@/lib/matches';
import { MEMBERS } from '@/data/members';
import { isKnockoutPhase } from '@/lib/constants';

// GET /api/predictions/score?match_id=X
// SECURITY: Scores are hidden until lock time (2h before kickoff)
// - Before lock: return only {user_id} of predictors + current user's own prediction
// - After lock: return all predictions with scores
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

    // Fetch all predictions from database
    // Note: Don't use FK join - may fail in Supabase schema cache
    const { data: predictions, error } = await supabase
      .from('match_score_predictions')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Predictions] Error getting predictions:', error);
      return NextResponse.json(
        { error: 'Erreur base de données' },
        { status: 500 }
      );
    }

    // Find current user's prediction
    const myPredictionRaw = (predictions || []).find(p => p.user_id === user.id);

    // SECURITY: Before lock, HIDE other users' scores from API response
    // Only return {user_id, user info} for others, full data for current user
    let publicPredictions;

    if (predictionLocked) {
      // AFTER LOCK: Return all predictions with scores
      // Enrich with member info from MEMBERS data
      const { data: result } = await supabase
        .from('match_results')
        .select('*')
        .eq('match_id', matchId)
        .single();

      // Get points if result exists
      let pointsMap: Record<string, { total: number; base: number; visionary: number; qualifier: number; detail: string }> = {};
      if (result) {
        const { data: pointsData } = await supabase
          .from('points_log')
          .select('user_id, total_points, base_points, visionary_bonus, qualifier_bonus, detail')
          .eq('match_id', matchId);

        if (pointsData) {
          pointsData.forEach(p => {
            pointsMap[p.user_id] = {
              total: p.total_points,
              base: p.base_points,
              visionary: p.visionary_bonus,
              qualifier: p.qualifier_bonus || 0,
              detail: p.detail || '',
            };
          });
        }
      }

      const isKnockout = isKnockoutPhase(match.phase);

      // Enrich predictions with member info and points
      publicPredictions = (predictions || []).map(p => {
        const member = MEMBERS.find(m => m.id === p.user_id);
        return {
          user_id: p.user_id,
          home_score: p.home_score,
          away_score: p.away_score,
          qualifier_pick: isKnockout ? p.qualifier_pick : undefined,
          user: member ? { member_name: member.name, member_slug: member.slug } : null,
          points: pointsMap[p.user_id] || null,
        };
      });

      return NextResponse.json({
        match: {
          id: match.id,
          ...parseMatchTeams(match.match),
          date: match.dateDisplay,
          time: match.time,
          phase: match.phase,
          isKnockout,
        },
        matchStarted,
        predictionLocked,
        timeUntilLock: -1,
        predictions: publicPredictions,
        predictorCount: publicPredictions.length,
        myPrediction: myPredictionRaw
          ? {
              home_score: myPredictionRaw.home_score,
              away_score: myPredictionRaw.away_score,
              qualifier_pick: isKnockout ? myPredictionRaw.qualifier_pick : undefined,
            }
          : null,
        result: result ? {
          ...result,
          qualifier: isKnockout ? result.qualifier : undefined,
        } : null,
      });
    } else {
      // BEFORE LOCK: Only return who predicted (user_id + avatar info), NOT their scores
      // Exception: Current user sees their own score
      const isKnockout = isKnockoutPhase(match.phase);

      publicPredictions = (predictions || []).map(p => {
        const member = MEMBERS.find(m => m.id === p.user_id);
        return {
          user_id: p.user_id,
          user: member ? { member_name: member.name, member_slug: member.slug } : null,
          // NO home_score, NO away_score for others
        };
      });

      return NextResponse.json({
        match: {
          id: match.id,
          ...parseMatchTeams(match.match),
          date: match.dateDisplay,
          time: match.time,
          phase: match.phase,
          isKnockout,
        },
        matchStarted,
        predictionLocked,
        timeUntilLock,
        predictions: publicPredictions, // Only user_ids, no scores
        predictorCount: publicPredictions.length,
        myPrediction: myPredictionRaw
          ? {
              home_score: myPredictionRaw.home_score,
              away_score: myPredictionRaw.away_score,
              qualifier_pick: isKnockout ? myPredictionRaw.qualifier_pick : undefined,
            }
          : null,
        result: null, // No result before lock anyway
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
    const { match_id, home_score, away_score, qualifier_pick } = body;

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

    // Validate qualifier_pick for knockout matches
    if (qualifier_pick !== undefined && qualifier_pick !== null &&
        qualifier_pick !== 'home' && qualifier_pick !== 'away') {
      return NextResponse.json(
        { error: 'qualifier_pick invalide (home ou away)' },
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

    const isKnockout = isKnockoutPhase(match.phase);

    // For knockout matches, qualifier_pick is required
    if (isKnockout && !qualifier_pick) {
      return NextResponse.json(
        { error: 'Choix du qualifié requis pour les matchs à élimination directe' },
        { status: 400 }
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
          qualifier_pick: isKnockout ? qualifier_pick : null,
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
          qualifier_pick: isKnockout ? qualifier_pick : null,
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
        qualifier_pick: isKnockout ? qualifier_pick : undefined,
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
