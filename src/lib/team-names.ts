import { getSupabaseAdmin } from '@/lib/auth/session';
import { getMatchById, parseMatchTeams } from '@/lib/matches';

/**
 * Resolve the REAL team names for a match, for USER-FACING TEXT (e.g. notifications).
 * Knockout matches store placeholders in matches.json ("Vainqueur M73") — the real
 * names live in `match_team_overrides` (populated from football-data.org). This reads
 * the override (service role) and falls back to the static placeholder.
 *
 * NEVER used in scoring / points computation — text display only.
 */
export async function getResolvedTeamNames(
  matchId: number
): Promise<{ home: string; away: string }> {
  const match = getMatchById(matchId);
  const fallback = match ? parseMatchTeams(match.match) : { home: '', away: '' };

  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('match_team_overrides')
      .select('home_team, away_team')
      .eq('match_id', matchId)
      .maybeSingle();

    if (data?.home_team && data?.away_team) {
      return { home: data.home_team, away: data.away_team };
    }
  } catch {
    // Fall back to the static placeholder on any error.
  }

  return fallback;
}
