import { NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import {
  calculateAllGroupStandings,
  getBestThirdPlaceTeams,
  resolveKnockoutMatches,
  MatchResult,
  GroupStandings,
  ThirdPlaceTeam,
  KnockoutResolution,
} from '@/lib/standings';
import { GROUPS, Group } from '@/lib/constants';

interface ResolveResponse {
  success: boolean;
  groupStandings: Record<Group, GroupStandings>;
  bestThirdPlaceTeams: ThirdPlaceTeam[];
  knockoutResolutions: KnockoutResolution[];
  overridesUpdated: number;
  message: string;
}

// GET /api/knockout/resolve - Calculate standings and show what can be resolved (public)
export async function GET() {
  const supabase = getSupabaseAdmin();

  // Fetch all match results
  const { data: resultsData, error: resultsError } = await supabase
    .from('match_results')
    .select('match_id, home_score, away_score');

  if (resultsError) {
    return NextResponse.json({ error: resultsError.message }, { status: 500 });
  }

  // Convert to Map
  const results = new Map<number, MatchResult>();
  for (const r of resultsData || []) {
    results.set(r.match_id, {
      matchId: r.match_id,
      homeScore: r.home_score,
      awayScore: r.away_score,
    });
  }

  // Calculate all standings
  const allStandings = calculateAllGroupStandings(results);
  const bestThirds = getBestThirdPlaceTeams(allStandings);
  const resolutions = resolveKnockoutMatches(results);

  // Convert Map to object for JSON response
  const standingsObj: Record<Group, GroupStandings> = {} as Record<Group, GroupStandings>;
  for (const group of GROUPS) {
    standingsObj[group] = allStandings.get(group)!;
  }

  const response: ResolveResponse = {
    success: true,
    groupStandings: standingsObj,
    bestThirdPlaceTeams: bestThirds,
    knockoutResolutions: resolutions,
    overridesUpdated: 0,
    message: 'Calcul effectué. Utilisez POST pour sauvegarder les résolutions.',
  };

  return NextResponse.json(response);
}

// POST /api/knockout/resolve - Calculate and save resolved teams to match_team_overrides
export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  // Only admins can update overrides
  if (!user.is_admin) {
    return NextResponse.json({ error: 'Accès admin requis' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  // Fetch all match results
  const { data: resultsData, error: resultsError } = await supabase
    .from('match_results')
    .select('match_id, home_score, away_score');

  if (resultsError) {
    return NextResponse.json({ error: resultsError.message }, { status: 500 });
  }

  // Convert to Map
  const results = new Map<number, MatchResult>();
  for (const r of resultsData || []) {
    results.set(r.match_id, {
      matchId: r.match_id,
      homeScore: r.home_score,
      awayScore: r.away_score,
    });
  }

  // Calculate resolutions
  const allStandings = calculateAllGroupStandings(results);
  const bestThirds = getBestThirdPlaceTeams(allStandings);
  const resolutions = resolveKnockoutMatches(results);

  // Filter to only fully resolved matches
  const resolvedMatches = resolutions.filter(r => r.isResolved);

  // Upsert to match_team_overrides
  let updatedCount = 0;
  for (const resolved of resolvedMatches) {
    const { error: upsertError } = await supabase
      .from('match_team_overrides')
      .upsert(
        {
          match_id: resolved.matchId,
          home_team: resolved.homeTeam!,
          away_team: resolved.awayTeam!,
          source: 'auto',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'match_id' }
      );

    if (!upsertError) {
      updatedCount++;
    }
  }

  // Convert Map to object for JSON response
  const standingsObj: Record<Group, GroupStandings> = {} as Record<Group, GroupStandings>;
  for (const group of GROUPS) {
    standingsObj[group] = allStandings.get(group)!;
  }

  const response: ResolveResponse = {
    success: true,
    groupStandings: standingsObj,
    bestThirdPlaceTeams: bestThirds,
    knockoutResolutions: resolutions,
    overridesUpdated: updatedCount,
    message: `${updatedCount} équipes de phase finale résolues et sauvegardées.`,
  };

  return NextResponse.json(response);
}
