import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin, requireAdmin } from '@/lib/auth/session';
import { getMatchById, parseMatchTeams } from '@/lib/matches';
import { calculateMatchPoints, Prediction, MatchResult, PointsBreakdown } from '@/lib/scoring';
import { MEMBERS } from '@/data/members';

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
        console.error('[Results] Error getting result:', error);
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
        console.error('[Results] Error getting all results:', error);
        return NextResponse.json(
          { error: 'Erreur base de données' },
          { status: 500 }
        );
      }

      return NextResponse.json({ results: results || [] });
    }
  } catch (error) {
    console.error('[Results] GET error:', error);
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

    // Upsert result
    const { data: existing } = await supabase
      .from('match_results')
      .select('id')
      .eq('match_id', matchId)
      .single();

    if (existing) {
      const { error: updateError } = await supabase
        .from('match_results')
        .update({
          home_score: homeScore,
          away_score: awayScore,
          entered_by: admin.id,
          entered_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (updateError) {
        console.error('[Results] Error updating result:', updateError);
        return NextResponse.json(
          { error: 'Erreur lors de la mise à jour' },
          { status: 500 }
        );
      }
    } else {
      const { error: insertError } = await supabase
        .from('match_results')
        .insert({
          match_id: matchId,
          home_score: homeScore,
          away_score: awayScore,
          entered_by: admin.id,
        });

      if (insertError) {
        console.error('[Results] Error creating result:', insertError);
        return NextResponse.json(
          { error: 'Erreur lors de la création' },
          { status: 500 }
        );
      }
    }

    // Get all predictions for this match
    const { data: predictionsData, error: predError } = await supabase
      .from('match_score_predictions')
      .select('user_id, home_score, away_score')
      .eq('match_id', matchId);

    if (predError) {
      console.error('[Results] Error getting predictions:', predError);
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
        console.error('[Results] Error inserting points:', pointsError);
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

    // Check for Drère de la journée
    await updateDailyAwards(supabase, match.date);

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
    console.error('[Results] POST error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// Helper to update daily awards
async function updateDailyAwards(supabase: ReturnType<typeof getSupabaseAdmin>, dateStr: string) {
  // Get all points for matches on this date
  const { data: matchesData } = await supabase
    .from('match_results')
    .select('match_id')
    .gte('entered_at', `${dateStr}T00:00:00`)
    .lt('entered_at', `${dateStr}T23:59:59`);

  if (!matchesData || matchesData.length === 0) return;

  const matchIds = matchesData.map(m => m.match_id);

  // Get points for these matches
  const { data: pointsData } = await supabase
    .from('points_log')
    .select('user_id, total_points')
    .in('match_id', matchIds);

  if (!pointsData || pointsData.length === 0) return;

  // Sum points per user
  const userPoints: Record<string, number> = {};
  for (const p of pointsData) {
    userPoints[p.user_id] = (userPoints[p.user_id] || 0) + p.total_points;
  }

  // Find max points
  const maxPoints = Math.max(...Object.values(userPoints));
  if (maxPoints === 0) return;

  // Find users with max points (could be multiple)
  const drereUsers = Object.entries(userPoints)
    .filter(([, points]) => points === maxPoints)
    .map(([userId]) => userId);

  // Create daily awards (delete existing for today first)
  await supabase
    .from('daily_awards')
    .delete()
    .eq('award_date', dateStr)
    .eq('award_type', 'drere');

  const awards = drereUsers.map(userId => ({
    user_id: userId,
    award_date: dateStr,
    award_type: 'drere' as const,
    points_earned: maxPoints,
  }));

  await supabase.from('daily_awards').insert(awards);

  // Send notification to Drère(s)
  const drereNotifications = drereUsers.map(userId => ({
    user_id: userId,
    type: 'activity_created' as const,
    title: '👑 Tu es le Drère du jour !',
    message: `Avec ${maxPoints} pts aujourd'hui, tu portes la couronne !`,
    link: '/leaderboard',
    created_by: userId,
  }));

  await supabase.from('notifications').insert(drereNotifications);
}
