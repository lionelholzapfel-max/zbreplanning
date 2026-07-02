import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin, requireAdmin } from '@/lib/auth/session';
import { getMatchById, parseMatchTeams } from '@/lib/matches';
import { calculateMatchPoints, Prediction, MatchResult, PointsBreakdown } from '@/lib/scoring';
import { MEMBERS } from '@/data/members';
import { getCompetitionDay, updateDailyAwards } from '@/lib/awards';

// GET /api/results?match_id=X
// Get result for a specific match (public)
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

    const supabase = getSupabaseAdmin();

    if (matchIdParam) {
      // Get specific match result
      const matchId = parseInt(matchIdParam, 10);
      if (isNaN(matchId)) {
        return NextResponse.json(
          { error: 'match_id invalide' },
          { status: 400 }
        );
      }

      const { data: result, error } = await supabase
        .from('match_results')
        .select('*, entered_by_user:users!entered_by(member_name)')
        .eq('match_id', matchId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json({ result: null });
        }
        return NextResponse.json(
          { error: 'Erreur base de données' },
          { status: 500 }
        );
      }

      const match = getMatchById(matchId);
      const teams = match ? parseMatchTeams(match.match) : { home: '', away: '' };

      // Also get points for this match
      const { data: pointsLog } = await supabase
        .from('points_log')
        .select('*')
        .eq('match_id', matchId);

      return NextResponse.json({
        result: {
          ...result,
          home_team: teams.home,
          away_team: teams.away,
        },
        points: pointsLog || [],
      });
    } else {
      // Get all results
      const { data: results, error } = await supabase
        .from('match_results')
        .select('*')
        .order('match_id', { ascending: true });

      if (error) {
        return NextResponse.json(
          { error: 'Erreur base de données' },
          { status: 500 }
        );
      }

      return NextResponse.json({ results: results || [] });
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// POST /api/results
// Record a match result and calculate points (ADMIN ONLY)
export async function POST(request: NextRequest) {
  try {
    // Require admin
    let admin;
    try {
      admin = await requireAdmin();
    } catch {
      return NextResponse.json(
        { error: 'Accès réservé aux administrateurs' },
        { status: 403 }
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

    const supabase = getSupabaseAdmin();
    const teams = parseMatchTeams(match.match);

    // Upsert result atomically (avoids the select-then-insert race on double submit)
    const { error: upsertError } = await supabase
      .from('match_results')
      .upsert(
        {
          match_id: matchId,
          home_score: homeScore,
          away_score: awayScore,
          entered_by: admin.id,
          entered_at: new Date().toISOString(),
          source: 'admin',
        },
        { onConflict: 'match_id' }
      );

    if (upsertError) {
      console.error(`[results] Upsert failed for match ${matchId}:`, upsertError.message);
      return NextResponse.json(
        { error: 'Erreur lors de l\'enregistrement du résultat' },
        { status: 500 }
      );
    }

    // Get all predictions for this match
    const { data: predictionsData, error: predError } = await supabase
      .from('match_score_predictions')
      .select('user_id, home_score, away_score')
      .eq('match_id', matchId);

    if (predError) {
      console.error(`[results] Failed to read predictions for match ${matchId}:`, predError.message);
      return NextResponse.json(
        { error: 'Erreur lors du calcul des points' },
        { status: 500 }
      );
    }

    const predictions: Prediction[] = predictionsData || [];
    const result: MatchResult = { home_score: homeScore, away_score: awayScore };

    // Calculate points for all predictions
    const pointsMap = calculateMatchPoints(predictions, result, teams.home, teams.away);

    // Delete existing points log for this match (in case of update)
    await supabase
      .from('points_log')
      .delete()
      .eq('match_id', matchId);

    // Insert new points log entries
    const pointsLogEntries: Array<{
      user_id: string;
      match_id: number;
      base_points: number;
      visionary_bonus: number;
      total_points: number;
      detail: string;
    }> = [];

    const pointsResults: Record<string, PointsBreakdown> = {};

    for (const [userId, breakdown] of pointsMap) {
      pointsLogEntries.push({
        user_id: userId,
        match_id: matchId,
        base_points: breakdown.base,
        visionary_bonus: breakdown.visionary,
        total_points: breakdown.total,
        detail: breakdown.detail,
      });
      pointsResults[userId] = breakdown;
    }

    if (pointsLogEntries.length > 0) {
      const { error: pointsError } = await supabase
        .from('points_log')
        .insert(pointsLogEntries);

      if (pointsError) {
        console.error(`[results] Failed to insert points_log for match ${matchId}:`, pointsError.message);
        return NextResponse.json(
          { error: 'Erreur lors de l\'enregistrement des points' },
          { status: 500 }
        );
      }
    }

    // Send notifications to all members
    const notifications = MEMBERS.map(member => {
      const points = pointsResults[member.id];
      const pointsText = points
        ? `+${points.total} pt${points.total > 1 ? 's' : ''}`
        : 'pas de prono';

      return {
        user_id: member.id,
        type: 'match_response' as const,
        title: `${teams.home} ${homeScore}-${awayScore} ${teams.away}`,
        message: `Résultat enregistré — ${pointsText}`,
        link: '/leaderboard',
        created_by: admin.id,
        related_id: matchId.toString(),
      };
    });

    await supabase.from('notifications').insert(notifications);

    // Check for Drère de la journée (using competition day: 06:00 to 05:59 next day)
    const competitionDay = getCompetitionDay(match.date, match.time);
    await updateDailyAwards(supabase, competitionDay);

    return NextResponse.json({
      success: true,
      result: {
        match_id: matchId,
        home_score: homeScore,
        away_score: awayScore,
        match: `${teams.home} ${homeScore} - ${awayScore} ${teams.away}`,
        entered_by: admin.member_name,
      },
      points_calculated: pointsLogEntries.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// getCompetitionDay + updateDailyAwards now live in '@/lib/awards' (single source of
// truth shared with the auto-sync: computes Drère + Mzi, no crown-notif spam).
