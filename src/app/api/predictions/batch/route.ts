import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import { getMatchById, hasMatchStarted, isPredictionLocked, parseMatchTeams, getTimeUntilLock } from '@/lib/matches';
import { MEMBERS } from '@/data/members';

// POST /api/predictions/batch
// Fetch predictions for multiple matches in one request
// Body: { match_ids: number[] }
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
    const matchIds: number[] = body.match_ids;

    if (!Array.isArray(matchIds) || matchIds.length === 0) {
      return NextResponse.json(
        { error: 'match_ids requis (array)' },
        { status: 400 }
      );
    }

    // Limit to 100 matches per request (enough for all group stage + knockout)
    const limitedIds = matchIds.slice(0, 100);

    const supabase = getSupabaseAdmin();

    // Fetch all predictions for these matches in one query
    const { data: allPredictions, error } = await supabase
      .from('match_score_predictions')
      .select('*')
      .in('match_id', limitedIds)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: 'Erreur base de données' },
        { status: 500 }
      );
    }

    // Fetch results for matches that have started
    const { data: allResults } = await supabase
      .from('match_results')
      .select('*')
      .in('match_id', limitedIds);

    const resultsMap: Record<number, { home_score: number; away_score: number }> = {};
    for (const r of allResults || []) {
      resultsMap[r.match_id] = { home_score: r.home_score, away_score: r.away_score };
    }

    // Fetch points for matches with results
    const matchIdsWithResults = Object.keys(resultsMap).map(Number);
    let pointsMap: Record<string, Record<string, { total: number; base: number; visionary: number; detail: string }>> = {};

    if (matchIdsWithResults.length > 0) {
      const { data: pointsData } = await supabase
        .from('points_log')
        .select('match_id, user_id, total_points, base_points, visionary_bonus, detail')
        .in('match_id', matchIdsWithResults);

      for (const p of pointsData || []) {
        if (!pointsMap[p.match_id]) pointsMap[p.match_id] = {};
        pointsMap[p.match_id][p.user_id] = {
          total: p.total_points,
          base: p.base_points,
          visionary: p.visionary_bonus,
          detail: p.detail || '',
        };
      }
    }

    // Group predictions by match
    const predictionsByMatch: Record<number, typeof allPredictions> = {};
    for (const p of allPredictions || []) {
      if (!predictionsByMatch[p.match_id]) predictionsByMatch[p.match_id] = [];
      predictionsByMatch[p.match_id].push(p);
    }

    // Build response for each match
    const results: Record<number, {
      myPrediction: { home_score: number; away_score: number } | null;
      allPredictions: unknown[];
      matchStarted: boolean;
      predictionLocked: boolean;
      timeUntilLock: number;
      result: { home_score: number; away_score: number } | null;
      totalPredictions: number;
    }> = {};

    for (const matchId of limitedIds) {
      const match = getMatchById(matchId);
      if (!match) continue;

      const matchPredictions = predictionsByMatch[matchId] || [];
      const matchStarted = hasMatchStarted(matchId);
      const predictionLocked = isPredictionLocked(matchId);
      const timeUntilLock = getTimeUntilLock(matchId);

      const myPredictionRaw = matchPredictions.find(p => p.user_id === user.id);
      const result = resultsMap[matchId] || null;
      const matchPoints = pointsMap[matchId] || {};

      let publicPredictions;

      if (predictionLocked) {
        // After lock: show all predictions with scores
        publicPredictions = matchPredictions.map(p => {
          const member = MEMBERS.find(m => m.id === p.user_id);
          return {
            user_id: p.user_id,
            home_score: p.home_score,
            away_score: p.away_score,
            user: member ? { member_name: member.name, member_slug: member.slug } : null,
            points: matchPoints[p.user_id] || null,
          };
        });
      } else {
        // Before lock: only show who predicted, not scores
        publicPredictions = matchPredictions.map(p => {
          const member = MEMBERS.find(m => m.id === p.user_id);
          return {
            user_id: p.user_id,
            user: member ? { member_name: member.name, member_slug: member.slug } : null,
          };
        });
      }

      results[matchId] = {
        myPrediction: myPredictionRaw
          ? { home_score: myPredictionRaw.home_score, away_score: myPredictionRaw.away_score }
          : null,
        allPredictions: publicPredictions,
        matchStarted,
        predictionLocked,
        timeUntilLock,
        result,
        totalPredictions: matchPredictions.length,
      };
    }

    return NextResponse.json({ predictions: results }, {
      headers: {
        'Cache-Control': 'private, max-age=5, stale-while-revalidate=10',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
