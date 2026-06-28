/**
 * Group standings calculation for World Cup 2026
 * Calculates standings from match results and resolves knockout team placeholders
 */

import { matches, parseMatchTeams } from './matches';
import { PHASES, GROUPS, Group } from './constants';

// ============================================================================
// TYPES
// ============================================================================

export interface TeamStanding {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  position: number; // 1, 2, 3, or 4 in the group
}

export interface GroupStandings {
  group: Group;
  standings: TeamStanding[];
  isComplete: boolean; // All 6 matches played?
}

export interface MatchResult {
  matchId: number;
  homeScore: number;
  awayScore: number;
}

export interface ThirdPlaceTeam {
  team: string;
  group: Group;
  points: number;
  goalDifference: number;
  goalsFor: number;
}

export interface KnockoutResolution {
  matchId: number;
  placeholder: string;
  homeTeam: string | null;
  awayTeam: string | null;
  isResolved: boolean;
  reason?: string;
}

// ============================================================================
// GROUP STANDINGS CALCULATION
// ============================================================================

/**
 * Get all teams in a group from group stage matches
 */
export function getGroupTeams(group: Group): string[] {
  const groupMatches = matches.filter(
    m => m.phase === PHASES.GROUP_STAGE && m.group === `GROUPE ${group}`
  );

  const teams = new Set<string>();
  for (const match of groupMatches) {
    const { home, away } = parseMatchTeams(match.match);
    if (home) teams.add(home);
    if (away) teams.add(away);
  }

  return Array.from(teams);
}

/**
 * Get group stage match IDs for a specific group
 */
export function getGroupMatchIds(group: Group): number[] {
  return matches
    .filter(m => m.phase === PHASES.GROUP_STAGE && m.group === `GROUPE ${group}`)
    .map(m => m.id);
}

/**
 * Calculate standings for a single group
 */
export function calculateGroupStandings(
  group: Group,
  results: Map<number, MatchResult>
): GroupStandings {
  const teams = getGroupTeams(group);
  const matchIds = getGroupMatchIds(group);

  // Initialize standings for each team
  const standingsMap = new Map<string, TeamStanding>();
  for (const team of teams) {
    standingsMap.set(team, {
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      position: 0,
    });
  }

  // Process each match result
  let matchesPlayed = 0;
  for (const matchId of matchIds) {
    const result = results.get(matchId);
    if (!result) continue;

    const match = matches.find(m => m.id === matchId);
    if (!match) continue;

    const { home, away } = parseMatchTeams(match.match);
    const homeStanding = standingsMap.get(home);
    const awayStanding = standingsMap.get(away);

    if (!homeStanding || !awayStanding) continue;

    matchesPlayed++;

    // Update stats
    homeStanding.played++;
    awayStanding.played++;
    homeStanding.goalsFor += result.homeScore;
    homeStanding.goalsAgainst += result.awayScore;
    awayStanding.goalsFor += result.awayScore;
    awayStanding.goalsAgainst += result.homeScore;

    if (result.homeScore > result.awayScore) {
      // Home win
      homeStanding.won++;
      homeStanding.points += 3;
      awayStanding.lost++;
    } else if (result.homeScore < result.awayScore) {
      // Away win
      awayStanding.won++;
      awayStanding.points += 3;
      homeStanding.lost++;
    } else {
      // Draw
      homeStanding.drawn++;
      awayStanding.drawn++;
      homeStanding.points += 1;
      awayStanding.points += 1;
    }
  }

  // Calculate goal difference
  for (const standing of standingsMap.values()) {
    standing.goalDifference = standing.goalsFor - standing.goalsAgainst;
  }

  // Sort standings
  const sortedStandings = Array.from(standingsMap.values()).sort((a, b) => {
    // 1. Points (descending)
    if (b.points !== a.points) return b.points - a.points;
    // 2. Goal difference (descending)
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    // 3. Goals scored (descending)
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    // 4. Alphabetical (for determinism)
    return a.team.localeCompare(b.team);
  });

  // Assign positions
  for (let i = 0; i < sortedStandings.length; i++) {
    sortedStandings[i].position = i + 1;
  }

  return {
    group,
    standings: sortedStandings,
    isComplete: matchesPlayed === 6, // Each group has 6 matches (4 teams, each plays 3)
  };
}

/**
 * Calculate standings for all groups
 */
export function calculateAllGroupStandings(
  results: Map<number, MatchResult>
): Map<Group, GroupStandings> {
  const allStandings = new Map<Group, GroupStandings>();

  for (const group of GROUPS) {
    allStandings.set(group, calculateGroupStandings(group, results));
  }

  return allStandings;
}

// ============================================================================
// THIRD PLACE TEAMS RANKING
// ============================================================================

/**
 * Get the 8 best third-place teams (for Round of 32)
 * In World Cup 2026 with 48 teams, 8 best third-place teams qualify
 */
export function getBestThirdPlaceTeams(
  allStandings: Map<Group, GroupStandings>
): ThirdPlaceTeam[] {
  const thirdPlaceTeams: ThirdPlaceTeam[] = [];

  for (const [group, standings] of allStandings) {
    if (!standings.isComplete) continue;

    const third = standings.standings.find(s => s.position === 3);
    if (third) {
      thirdPlaceTeams.push({
        team: third.team,
        group,
        points: third.points,
        goalDifference: third.goalDifference,
        goalsFor: third.goalsFor,
      });
    }
  }

  // Sort by: points > goal difference > goals scored
  thirdPlaceTeams.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    return b.goalsFor - a.goalsFor;
  });

  // Return top 8
  return thirdPlaceTeams.slice(0, 8);
}

// ============================================================================
// KNOCKOUT PLACEHOLDER RESOLUTION
// ============================================================================

/**
 * Parse a knockout placeholder to extract position and group(s)
 * Examples:
 *   "1er Groupe A" -> { position: 1, groups: ['A'] }
 *   "2e Groupe B" -> { position: 2, groups: ['B'] }
 *   "3e Groupe A/B/C/D/F" -> { position: 3, groups: ['A', 'B', 'C', 'D', 'F'] }
 */
export function parsePlaceholder(placeholder: string): {
  position: number;
  groups: Group[];
} | null {
  // Pattern: "1er Groupe X" or "2e Groupe X" or "3e Groupe X/Y/Z"
  const match1er = placeholder.match(/^1er Groupe ([A-L])$/);
  if (match1er) {
    return { position: 1, groups: [match1er[1] as Group] };
  }

  const match2e = placeholder.match(/^2e Groupe ([A-L])$/);
  if (match2e) {
    return { position: 2, groups: [match2e[1] as Group] };
  }

  const match3e = placeholder.match(/^3e Groupe ([A-L\/]+)$/);
  if (match3e) {
    const groupStr = match3e[1];
    const groups = groupStr.split('/').filter(g => /^[A-L]$/.test(g)) as Group[];
    return { position: 3, groups };
  }

  return null;
}

/**
 * Resolve a single placeholder to actual team name
 */
export function resolvePlaceholder(
  placeholder: string,
  allStandings: Map<Group, GroupStandings>,
  bestThirds: ThirdPlaceTeam[]
): string | null {
  const parsed = parsePlaceholder(placeholder);
  if (!parsed) return null;

  if (parsed.position === 3) {
    // Find the best 3rd place team from the specified groups
    for (const third of bestThirds) {
      if (parsed.groups.includes(third.group)) {
        return third.team;
      }
    }
    return null; // No matching third place team found yet
  }

  // Position 1 or 2 from a specific group
  const group = parsed.groups[0];
  const standings = allStandings.get(group);

  if (!standings || !standings.isComplete) {
    return null; // Group not complete
  }

  const team = standings.standings.find(s => s.position === parsed.position);
  return team?.team || null;
}

/**
 * Resolve a third-place placeholder, tracking used teams
 */
function resolveThirdPlace(
  eligibleGroups: Group[],
  bestThirds: ThirdPlaceTeam[],
  usedThirds: Set<string>
): string | null {
  // Find the best available third-place team from eligible groups
  for (const third of bestThirds) {
    if (eligibleGroups.includes(third.group) && !usedThirds.has(third.team)) {
      return third.team;
    }
  }
  return null;
}

/**
 * Resolve all knockout match placeholders
 * Tracks used third-place teams to avoid duplicates
 */
export function resolveKnockoutMatches(
  results: Map<number, MatchResult>
): KnockoutResolution[] {
  const allStandings = calculateAllGroupStandings(results);
  const bestThirds = getBestThirdPlaceTeams(allStandings);

  const knockoutMatches = matches.filter(m => m.phase !== PHASES.GROUP_STAGE);
  const resolutions: KnockoutResolution[] = [];

  // Track which third-place teams have been assigned
  const usedThirds = new Set<string>();

  // Sort matches by ID to process in order (ensures consistent assignment)
  const sortedMatches = [...knockoutMatches].sort((a, b) => a.id - b.id);

  for (const match of sortedMatches) {
    const { home, away } = parseMatchTeams(match.match);

    let homeTeam: string | null = null;
    let awayTeam: string | null = null;

    // Resolve home team
    const homeParsed = parsePlaceholder(home);
    if (homeParsed) {
      if (homeParsed.position === 3) {
        homeTeam = resolveThirdPlace(homeParsed.groups, bestThirds, usedThirds);
        if (homeTeam) usedThirds.add(homeTeam);
      } else {
        homeTeam = resolvePlaceholder(home, allStandings, bestThirds);
      }
    }

    // Resolve away team
    const awayParsed = parsePlaceholder(away);
    if (awayParsed) {
      if (awayParsed.position === 3) {
        awayTeam = resolveThirdPlace(awayParsed.groups, bestThirds, usedThirds);
        if (awayTeam) usedThirds.add(awayTeam);
      } else {
        awayTeam = resolvePlaceholder(away, allStandings, bestThirds);
      }
    }

    // Check if this is a later round match (depends on previous knockout results)
    const laterRoundPhases: string[] = [
      PHASES.ROUND_OF_16,
      PHASES.QUARTER_FINALS,
      PHASES.SEMI_FINALS,
      PHASES.THIRD_PLACE,
      PHASES.FINAL,
    ];
    const isLaterRound = laterRoundPhases.includes(match.phase);

    let reason: string | undefined;
    if (!homeTeam && !awayTeam) {
      if (isLaterRound) {
        reason = 'Dépend des résultats des tours précédents';
      } else {
        reason = 'Phase de groupes non terminée';
      }
    } else if (!homeTeam || !awayTeam) {
      reason = 'Résolution partielle - certains groupes non terminés';
    }

    resolutions.push({
      matchId: match.id,
      placeholder: match.match,
      homeTeam,
      awayTeam,
      isResolved: homeTeam !== null && awayTeam !== null,
      reason,
    });
  }

  return resolutions;
}

// ============================================================================
// LATER ROUND RESOLUTION (Quarter-finals, Semi-finals, Final)
// ============================================================================

/**
 * Knockout bracket mapping for World Cup 2026
 * Maps match IDs to their dependencies (winner of previous match)
 */
export const KNOCKOUT_BRACKET: Record<number, { homeFrom?: number; awayFrom?: number }> = {
  // Round of 16 (depends on Round of 32 winners)
  // Match 89: Winner of 73 vs Winner of 74
  89: { homeFrom: 73, awayFrom: 74 },
  90: { homeFrom: 75, awayFrom: 76 },
  91: { homeFrom: 77, awayFrom: 78 },
  92: { homeFrom: 79, awayFrom: 80 },
  93: { homeFrom: 81, awayFrom: 82 },
  94: { homeFrom: 83, awayFrom: 84 },
  95: { homeFrom: 85, awayFrom: 86 },
  96: { homeFrom: 87, awayFrom: 88 },

  // Quarter-finals
  97: { homeFrom: 89, awayFrom: 90 },
  98: { homeFrom: 91, awayFrom: 92 },
  99: { homeFrom: 93, awayFrom: 94 },
  100: { homeFrom: 95, awayFrom: 96 },

  // Semi-finals
  101: { homeFrom: 97, awayFrom: 98 },
  102: { homeFrom: 99, awayFrom: 100 },

  // Third place match
  103: { homeFrom: 101, awayFrom: 102 }, // Losers of semi-finals

  // Final
  104: { homeFrom: 101, awayFrom: 102 }, // Winners of semi-finals
};

/**
 * Get winner of a knockout match (if result exists)
 */
export function getMatchWinner(
  matchId: number,
  results: Map<number, MatchResult>,
  overrides: Map<number, { homeTeam: string; awayTeam: string }>
): string | null {
  const result = results.get(matchId);
  if (!result) return null;

  const override = overrides.get(matchId);
  if (!override) return null;

  if (result.homeScore > result.awayScore) {
    return override.homeTeam;
  } else if (result.awayScore > result.homeScore) {
    return override.awayTeam;
  }

  // Draw - would need penalties info, not available yet
  return null;
}

/**
 * Get loser of a knockout match (for third place match)
 */
export function getMatchLoser(
  matchId: number,
  results: Map<number, MatchResult>,
  overrides: Map<number, { homeTeam: string; awayTeam: string }>
): string | null {
  const result = results.get(matchId);
  if (!result) return null;

  const override = overrides.get(matchId);
  if (!override) return null;

  if (result.homeScore > result.awayScore) {
    return override.awayTeam;
  } else if (result.awayScore > result.homeScore) {
    return override.homeTeam;
  }

  return null;
}
