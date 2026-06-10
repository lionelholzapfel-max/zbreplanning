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

// ============================================================================
// PREDICTION LOCK CONFIGURATION
// Predictions lock 2 hours BEFORE kickoff to prevent last-minute copying
// ============================================================================
export const PREDICTION_LOCK_OFFSET_MS = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

// First match kickoff - used to lock global predictions (winner, best_player, etc.)
// Match 1: Mexique - Afrique du Sud, 11 juin 2026 à 21:00 (Europe/Brussels)
export const FIRST_MATCH_KICKOFF = new Date('2026-06-11T21:00:00+02:00');

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
 * Get the lock time for predictions (2 hours before kickoff)
 */
export function getPredictionLockTime(match: Match): Date {
  const kickoff = getMatchKickoff(match);
  return new Date(kickoff.getTime() - PREDICTION_LOCK_OFFSET_MS);
}

/**
 * Check if predictions are locked for a match
 * Predictions lock 2 HOURS BEFORE kickoff (not at kickoff)
 * This is the SINGLE SOURCE OF TRUTH for lock status
 */
export function isPredictionLocked(matchId: number): boolean {
  const match = getMatchById(matchId);
  if (!match) return true; // Assume locked if match not found (safety)

  const lockTime = getPredictionLockTime(match);
  const now = new Date();

  return now >= lockTime;
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
 * Get time until lock in milliseconds (negative if already locked)
 * Returns time until (kickoff - 2h)
 */
export function getTimeUntilLock(matchId: number): number {
  const match = getMatchById(matchId);
  if (!match) return -1;

  const lockTime = getPredictionLockTime(match);
  const now = new Date();

  return lockTime.getTime() - now.getTime();
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
 * Check if global predictions (winner, best_player, etc.) are locked
 * They lock at the FIRST MATCH kickoff (11 juin 2026, 21:00)
 */
export function areGlobalPredictionsLocked(): boolean {
  const now = new Date();
  return now >= FIRST_MATCH_KICKOFF;
}

/**
 * Get time until global predictions lock
 */
export function getTimeUntilGlobalLock(): number {
  const now = new Date();
  return FIRST_MATCH_KICKOFF.getTime() - now.getTime();
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
