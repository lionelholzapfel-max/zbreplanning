import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin, requireAdmin } from '@/lib/auth/session';
import { getMatchById, parseMatchTeams } from '@/lib/matches';

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

      return NextResponse.json({
        result: {
          ...result,
          home_team: teams.home,
          away_team: teams.away,
        },
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
// Record a match result (ADMIN ONLY)
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

    // Upsert result (update if exists, insert if not)
    const { data: existing } = await supabase
      .from('match_results')
      .select('id')
      .eq('match_id', matchId)
      .single();

    if (existing) {
      // Update existing result
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
      // Create new result
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

    const teams = parseMatchTeams(match.match);

    return NextResponse.json({
      success: true,
      result: {
        match_id: matchId,
        home_score: homeScore,
        away_score: awayScore,
        match: `${teams.home} ${homeScore} - ${awayScore} ${teams.away}`,
        entered_by: admin.member_name,
      },
    });
  } catch (error) {
    console.error('[Results] POST error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
