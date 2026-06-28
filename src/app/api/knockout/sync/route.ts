import { NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import { fetchWorldCupMatches, apiTeamNameToOurs, ApiMatch } from '@/lib/football-api';
import matches from '@/data/matches.json';

interface SyncedTeam {
  matchId: number;
  placeholder: string;
  homeTeam: string;
  awayTeam: string;
  apiTime: string;
  ourTime: string;
  source: 'auto';
}

interface UnmatchedApiMatch {
  apiId: number;
  stage: string;
  homeTeam: string;
  awayTeam: string;
  utcDate: string;
  reason: string;
}

interface SyncResponse {
  success: boolean;
  apiConnected: boolean;
  knockoutMatchesFromApi: number;
  knockoutMatchesWithTeams: number;
  teamsSynced: SyncedTeam[];
  unmatched: UnmatchedApiMatch[];
  errors: string[];
}

// Map API stages to our phase names
const STAGE_TO_PHASE: Record<string, string> = {
  'LAST_32': 'SEIZIÈMES DE FINALE',
  'ROUND_OF_32': 'SEIZIÈMES DE FINALE',
  'LAST_16': 'HUITIÈMES DE FINALE',
  'ROUND_OF_16': 'HUITIÈMES DE FINALE',
  'QUARTER_FINALS': 'QUARTS DE FINALE',
  'SEMI_FINALS': 'DEMI-FINALES',
  'THIRD_PLACE': 'MATCH POUR LA 3E PLACE',
  'FINAL': 'FINALE',
};

/**
 * Convert our match date+time to UTC timestamp
 * Our times are stored in Europe/Paris timezone (CEST = UTC+2 in summer)
 */
function ourMatchToUTC(ourMatch: any): number {
  const [year, month, day] = ourMatch.date.split('-').map(Number);
  const [hours, minutes] = ourMatch.time.split(':').map(Number);
  // During World Cup (June-July), Paris is CEST (UTC+2)
  // So 18:00 Paris time = 16:00 UTC
  return Date.UTC(year, month - 1, day, hours - 2, minutes);
}

/**
 * Find the best matching our match for an API match
 * Uses phase + exact time matching (within 30 min tolerance)
 * Returns the closest match if multiple candidates exist
 */
function findBestMatch(
  apiMatch: ApiMatch,
  availableMatches: any[],
  usedMatchIds: Set<number>
): any | null {
  const apiTime = new Date(apiMatch.utcDate).getTime();
  const apiPhase = STAGE_TO_PHASE[apiMatch.stage];

  if (!apiPhase) return null;

  // Filter by phase and not already used
  const candidates = availableMatches.filter(m =>
    m.phase === apiPhase && !usedMatchIds.has(m.id)
  );

  if (candidates.length === 0) return null;

  // Find the closest match by time
  let bestMatch = null;
  let bestDiff = Infinity;

  for (const candidate of candidates) {
    const ourTime = ourMatchToUTC(candidate);
    const diffMinutes = Math.abs(apiTime - ourTime) / (1000 * 60);

    // Must be within 90 minutes to handle timezone variations
    if (diffMinutes <= 90 && diffMinutes < bestDiff) {
      bestMatch = candidate;
      bestDiff = diffMinutes;
    }
  }

  return bestMatch;
}

// GET /api/knockout/sync - Fetch knockout teams from football-data.org API
export async function GET() {
  const response: SyncResponse = {
    success: false,
    apiConnected: false,
    knockoutMatchesFromApi: 0,
    knockoutMatchesWithTeams: 0,
    teamsSynced: [],
    unmatched: [],
    errors: [],
  };

  try {
    // Fetch all matches from API
    const apiMatches = await fetchWorldCupMatches();
    response.apiConnected = true;

    // Filter knockout matches (not group stage)
    const knockoutApiMatches = apiMatches.filter(m =>
      m.stage !== 'GROUP_STAGE' && m.stage !== 'LEAGUE_STAGE'
    );
    response.knockoutMatchesFromApi = knockoutApiMatches.length;

    if (knockoutApiMatches.length === 0) {
      response.errors.push('No knockout matches found in API yet');
      return NextResponse.json(response);
    }

    const supabase = getSupabaseAdmin();
    const syncedMatchIds = new Set<number>();

    // Match API matches to our matches and extract teams
    for (const apiMatch of knockoutApiMatches) {
      // Skip if teams are null/undefined (TBD matches)
      if (!apiMatch.homeTeam?.name || !apiMatch.awayTeam?.name) {
        response.unmatched.push({
          apiId: apiMatch.id,
          stage: apiMatch.stage,
          homeTeam: 'TBD',
          awayTeam: 'TBD',
          utcDate: apiMatch.utcDate,
          reason: 'Teams not yet determined',
        });
        continue;
      }

      // Skip if teams are TBD/placeholders
      if (apiMatch.homeTeam.name.includes('Winner') ||
          apiMatch.homeTeam.name.includes('Loser') ||
          apiMatch.awayTeam.name.includes('Winner') ||
          apiMatch.awayTeam.name.includes('Loser')) {
        response.unmatched.push({
          apiId: apiMatch.id,
          stage: apiMatch.stage,
          homeTeam: apiMatch.homeTeam.name,
          awayTeam: apiMatch.awayTeam.name,
          utcDate: apiMatch.utcDate,
          reason: 'Placeholder teams (Winner/Loser)',
        });
        continue;
      }

      response.knockoutMatchesWithTeams++;

      // Convert API team names to our French names
      const homeTeam = apiTeamNameToOurs(apiMatch.homeTeam.name) || apiMatch.homeTeam.name;
      const awayTeam = apiTeamNameToOurs(apiMatch.awayTeam.name) || apiMatch.awayTeam.name;

      // Find our match by date + time + phase (best match algorithm)
      const ourMatch = findBestMatch(apiMatch, matches as any[], syncedMatchIds);

      if (!ourMatch) {
        response.unmatched.push({
          apiId: apiMatch.id,
          stage: apiMatch.stage,
          homeTeam: apiMatch.homeTeam.name,
          awayTeam: apiMatch.awayTeam.name,
          utcDate: apiMatch.utcDate,
          reason: `No matching local match (phase: ${STAGE_TO_PHASE[apiMatch.stage] || apiMatch.stage})`,
        });
        continue;
      }

      // Mark this match as used
      syncedMatchIds.add(ourMatch.id);

      // Upsert to match_team_overrides (use 'auto' to match DB constraint)
      const { error } = await supabase
        .from('match_team_overrides')
        .upsert({
          match_id: ourMatch.id,
          home_team: homeTeam,
          away_team: awayTeam,
          source: 'auto',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'match_id' });

      if (error) {
        response.errors.push(`Match ${ourMatch.id}: ${error.message}`);
      } else {
        response.teamsSynced.push({
          matchId: ourMatch.id,
          placeholder: ourMatch.match,
          homeTeam,
          awayTeam,
          apiTime: apiMatch.utcDate,
          ourTime: `${ourMatch.date} ${ourMatch.time}`,
          source: 'auto',
        });
      }
    }

    response.success = response.errors.length === 0;
    return NextResponse.json(response);

  } catch (error) {
    response.errors.push(error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(response, { status: 500 });
  }
}

// POST /api/knockout/sync - Same as GET but requires admin auth
export async function POST() {
  const user = await getSessionUser();
  if (!user?.is_admin) {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 });
  }

  // Reuse GET logic
  return GET();
}
