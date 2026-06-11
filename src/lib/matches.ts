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

// Belgium timezone - CEST (UTC+2) in summer, CET (UTC+1) in winter
// World Cup 2026 is June-July, so always UTC+2
export const BELGIUM_TIMEZONE = 'Europe/Brussels';

// First match kickoff - used to lock global predictions (winner, best_player, etc.)
// Match 1: Mexique - Afrique du Sud, 11 juin 2026 à 21:00 (Europe/Brussels)
export const FIRST_MATCH_KICKOFF = new Date('2026-06-11T21:00:00+02:00');

// Global predictions lock 2 HOURS BEFORE first match kickoff
export const GLOBAL_PREDICTIONS_LOCK = new Date(FIRST_MATCH_KICKOFF.getTime() - PREDICTION_LOCK_OFFSET_MS);

export function getMatchById(matchId: number): Match | undefined {
  return matches.find(m => m.id === matchId);
}

/**
 * Get the kickoff time for a match as a Date object
 * CRITICAL: Times in matches.json are in Europe/Brussels timezone
 * This function converts them to proper UTC timestamps that work on any server
 */
export function getMatchKickoff(match: Match): Date {
  // Parse date and time (format: "2026-06-11" and "21:00")
  // These are BELGIUM times (Europe/Brussels = UTC+2 in summer June-July)

  // Build ISO string with explicit Brussels offset
  // World Cup 2026 is entirely in June-July = CEST = UTC+2
  const isoString = `${match.date}T${match.time}:00+02:00`;

  return new Date(isoString);
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
 * They lock 2 HOURS BEFORE the first match kickoff (11 juin 2026, 19:00 Brussels)
 */
export function areGlobalPredictionsLocked(): boolean {
  const now = new Date();
  return now >= GLOBAL_PREDICTIONS_LOCK;
}

/**
 * Get time until global predictions lock
 */
export function getTimeUntilGlobalLock(): number {
  const now = new Date();
  return GLOBAL_PREDICTIONS_LOCK.getTime() - now.getTime();
}

// ============================================================================
// DEBUG UTILITIES - Timezone verification
// ============================================================================

/**
 * Format a date in Belgium timezone for display
 */
export function formatBelgiumTime(date: Date): string {
  return date.toLocaleString('fr-BE', {
    timeZone: BELGIUM_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Get debug info for a match's timezone handling
 * Use this to verify timezone conversions are correct
 */
export function getMatchTimezoneDebug(matchId: number): {
  matchId: number;
  rawJson: { date: string; time: string };
  kickoffUtc: string;
  kickoffBelgium: string;
  lockUtc: string;
  lockBelgium: string;
  nowUtc: string;
  nowBelgium: string;
  isLocked: boolean;
  msUntilLock: number;
} | null {
  const match = getMatchById(matchId);
  if (!match) return null;

  const kickoff = getMatchKickoff(match);
  const lockTime = getPredictionLockTime(match);
  const now = new Date();

  return {
    matchId,
    rawJson: { date: match.date, time: match.time },
    kickoffUtc: kickoff.toISOString(),
    kickoffBelgium: formatBelgiumTime(kickoff),
    lockUtc: lockTime.toISOString(),
    lockBelgium: formatBelgiumTime(lockTime),
    nowUtc: now.toISOString(),
    nowBelgium: formatBelgiumTime(now),
    isLocked: now >= lockTime,
    msUntilLock: lockTime.getTime() - now.getTime(),
  };
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
