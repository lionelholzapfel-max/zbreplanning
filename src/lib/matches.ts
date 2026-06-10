import matchesData from '@/data/matches.json';

export interface Match {
  id: number;
  date: string;
  dateDisplay: string;
  time: string;
  match: string;
  stadium: string;
  city: string;
  phase: string;
  group: string;
}

export const matches: Match[] = matchesData as Match[];

export function getMatchById(matchId: number): Match | undefined {
  return matches.find(m => m.id === matchId);
}

/**
 * Get the kickoff time for a match as a Date object
 * Assumes times are in Europe/Brussels timezone
 */
export function getMatchKickoff(match: Match): Date {
  // Parse date and time (format: "2026-06-11" and "21:00")
  const [year, month, day] = match.date.split('-').map(Number);
  const [hours, minutes] = match.time.split(':').map(Number);

  // Create date in local timezone (assumes server is in Europe/Brussels or similar)
  // For production, you'd want to use a proper timezone library
  const kickoff = new Date(year, month - 1, day, hours, minutes, 0);

  return kickoff;
}

/**
 * Check if a match has started (kickoff time has passed)
 */
export function hasMatchStarted(matchId: number): boolean {
  const match = getMatchById(matchId);
  if (!match) return true; // Assume started if match not found (safety)

  const kickoff = getMatchKickoff(match);
  const now = new Date();

  return now >= kickoff;
}

/**
 * Get time until kickoff in milliseconds (negative if already started)
 */
export function getTimeUntilKickoff(matchId: number): number {
  const match = getMatchById(matchId);
  if (!match) return -1;

  const kickoff = getMatchKickoff(match);
  const now = new Date();

  return kickoff.getTime() - now.getTime();
}

/**
 * Parse match string to get team names
 */
export function parseMatchTeams(matchString: string): { home: string; away: string } {
  const parts = matchString.split(' - ');
  if (parts.length === 2) {
    return { home: parts[0].trim(), away: parts[1].trim() };
  }
  return { home: matchString, away: '' };
}
