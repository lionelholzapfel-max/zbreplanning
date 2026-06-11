// Match filtering utilities - extracted for testing

export interface Match {
  id: number;
  date: string; // "DD/MM/YYYY" format (Belgian date format)
  time: string; // "HH:MM" format (Belgian timezone - Europe/Brussels)
  match: string;
  phase: string;
  group: string;
}

export type TimeFilter = 'all' | 'today' | 'week';
export type TimeSlot = 'all' | 'evening' | 'night';

/**
 * Parse match datetime from Belgian date/time strings
 * Times in matches.json are already in Europe/Brussels timezone
 */
export function getMatchDateTime(match: Match): Date {
  const [day, month, year] = match.date.split('/').map(Number);
  const [hours, minutes] = match.time.split(':').map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}

/**
 * Check if match is within time range (today/week)
 * Uses local browser timezone which should match Europe/Brussels for Belgian users
 */
export function isMatchInTimeRange(match: Match, range: TimeFilter, now: Date = new Date()): boolean {
  if (range === 'all') return true;

  const matchDate = getMatchDateTime(match);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (range === 'today') {
    return matchDate >= todayStart && matchDate < todayEnd;
  }
  if (range === 'week') {
    return matchDate >= todayStart && matchDate < weekEnd;
  }
  return true;
}

/**
 * Check if match is in time slot
 * Based on actual World Cup 2026 schedule in Belgian timezone:
 * - Evening (Soirée): 18:00-23:59
 * - Night (Nuit): 00:00-06:59 (North American afternoon/evening matches)
 */
export function isMatchInTimeSlot(match: Match, slot: TimeSlot): boolean {
  if (slot === 'all') return true;
  const [hours] = match.time.split(':').map(Number);
  if (slot === 'evening') return hours >= 18 && hours <= 23;
  if (slot === 'night') return hours >= 0 && hours < 7;
  return true;
}

/**
 * Parse match string to extract team names
 * Format: "Team1 - Team2"
 */
export function parseMatch(matchStr: string): { team1: string; team2: string } {
  const parts = matchStr.split(' - ');
  if (parts.length === 2) {
    return { team1: parts[0].trim(), team2: parts[1].trim() };
  }
  return { team1: matchStr, team2: '' };
}

/**
 * Check if match involves any favorite teams
 */
export function isMyTeamsMatch(match: Match, favorites: string[]): boolean {
  if (favorites.length === 0) return false;
  const { team1, team2 } = parseMatch(match.match);
  return favorites.includes(team1) || favorites.includes(team2);
}

/**
 * Count matches by time slot
 */
export function countTimeSlots(matches: Match[]): { evening: number; night: number } {
  return matches.reduce((acc, m) => {
    const [hours] = m.time.split(':').map(Number);
    if (hours >= 18 && hours <= 23) acc.evening++;
    else if (hours >= 0 && hours < 7) acc.night++;
    return acc;
  }, { evening: 0, night: 0 });
}
