import { NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import { fetchWorldCupMatches, apiTeamNameToOurs, ApiMatch } from '@/lib/football-api';
import matches from '@/data/matches.json';

interface SyncedTeam {
  matchId: number;
  placeholder: string;
  homeTeam: string;
  awayTeam: string;
  source: 'api';
}

interface SyncResponse {
  success: boolean;
  apiConnected: boolean;
  knockoutMatchesFromApi: number;
  teamsSynced: SyncedTeam[];
  errors: string[];
}

// GET /api/knockout/sync - Fetch knockout teams from football-data.org API
export async function GET() {
  const response: SyncResponse = {
    success: false,
    apiConnected: false,
    knockoutMatchesFromApi: 0,
    teamsSynced: [],
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

    // Match API matches to our matches and extract teams
    for (const apiMatch of knockoutApiMatches) {
      // Find corresponding match in our list by date
      const apiDate = new Date(apiMatch.utcDate);
      const apiDateStr = apiDate.toISOString().split('T')[0];

      // Convert API team names to our French names
      const homeTeam = apiTeamNameToOurs(apiMatch.homeTeam.name) || apiMatch.homeTeam.name;
      const awayTeam = apiTeamNameToOurs(apiMatch.awayTeam.name) || apiMatch.awayTeam.name;

      // Skip if teams are TBD/placeholders
      if (apiMatch.homeTeam.name.includes('Winner') ||
          apiMatch.homeTeam.name.includes('Loser') ||
          apiMatch.awayTeam.name.includes('Winner') ||
          apiMatch.awayTeam.name.includes('Loser')) {
        continue;
      }

      // Find our match by date (with 1 day tolerance for timezone)
      const ourMatch = (matches as any[]).find(m => {
        const ourDate = new Date(m.date);
        const diffDays = Math.abs(apiDate.getTime() - ourDate.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays <= 1 && m.phase !== 'PHASE DE GROUPES';
      });

      if (!ourMatch) continue;

      // Upsert to match_team_overrides
      const { error } = await supabase
        .from('match_team_overrides')
        .upsert({
          match_id: ourMatch.id,
          home_team: homeTeam,
          away_team: awayTeam,
          source: 'api',
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
          source: 'api',
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
