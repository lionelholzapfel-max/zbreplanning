import { describe, test, expect } from 'vitest';
import {
  getMatchDateTime,
  isMatchInTimeRange,
  isMatchInTimeSlot,
  parseMatch,
  isMyTeamsMatch,
  countTimeSlots,
  Match
} from './matchFilters';

// Helper to create test matches
const createMatch = (overrides: Partial<Match> = {}): Match => ({
  id: 1,
  date: '2026-06-11', // ISO format: YYYY-MM-DD
  time: '21:00',
  match: 'Belgique - Croatie',
  phase: 'PHASE DE GROUPES',
  group: 'GROUPE A',
  ...overrides,
});

describe('getMatchDateTime', () => {
  test('parses ISO date format correctly', () => {
    const match = createMatch({ date: '2026-06-11', time: '21:00' });
    const dt = getMatchDateTime(match);
    expect(dt.getFullYear()).toBe(2026);
    expect(dt.getMonth()).toBe(5); // June = 5 (0-indexed)
    expect(dt.getDate()).toBe(11);
    expect(dt.getHours()).toBe(21);
    expect(dt.getMinutes()).toBe(0);
  });

  test('handles midnight correctly', () => {
    const match = createMatch({ date: '2026-06-12', time: '00:00' });
    const dt = getMatchDateTime(match);
    expect(dt.getDate()).toBe(12);
    expect(dt.getHours()).toBe(0);
  });
});

describe('isMatchInTimeRange', () => {
  test('returns true for "all" range', () => {
    const match = createMatch();
    expect(isMatchInTimeRange(match, 'all')).toBe(true);
  });

  test('"today" filter matches match on same day', () => {
    const now = new Date(2026, 5, 11, 10, 0); // June 11, 2026, 10:00
    const match = createMatch({ date: '2026-06-11', time: '21:00' });
    expect(isMatchInTimeRange(match, 'today', now)).toBe(true);
  });

  test('"today" filter excludes match on different day', () => {
    const now = new Date(2026, 5, 11, 10, 0); // June 11, 2026
    const match = createMatch({ date: '2026-06-12', time: '21:00' }); // June 12
    expect(isMatchInTimeRange(match, 'today', now)).toBe(false);
  });

  test('"week" filter matches match within 7 days', () => {
    const now = new Date(2026, 5, 11, 10, 0); // June 11, 2026
    const match = createMatch({ date: '2026-06-15', time: '21:00' }); // June 15 (4 days later)
    expect(isMatchInTimeRange(match, 'week', now)).toBe(true);
  });

  test('"week" filter excludes match beyond 7 days', () => {
    const now = new Date(2026, 5, 11, 10, 0); // June 11, 2026
    const match = createMatch({ date: '2026-06-20', time: '21:00' }); // June 20 (9 days later)
    expect(isMatchInTimeRange(match, 'week', now)).toBe(false);
  });

  test('"week" filter excludes past matches', () => {
    const now = new Date(2026, 5, 11, 10, 0); // June 11, 2026
    const match = createMatch({ date: '2026-06-10', time: '21:00' }); // June 10 (yesterday)
    expect(isMatchInTimeRange(match, 'week', now)).toBe(false);
  });

  test('"today" filter handles night match crossing midnight (Belgian time)', () => {
    // Match at 03:00 on June 12 (North American evening match)
    // If user is checking on June 12, it should show as "today"
    const now = new Date(2026, 5, 12, 1, 0); // June 12, 2026, 01:00
    const match = createMatch({ date: '2026-06-12', time: '03:00' });
    expect(isMatchInTimeRange(match, 'today', now)).toBe(true);
  });
});

describe('isMatchInTimeSlot', () => {
  test('returns true for "all" slot', () => {
    const match = createMatch({ time: '15:00' });
    expect(isMatchInTimeSlot(match, 'all')).toBe(true);
  });

  test('"evening" slot matches 18:00', () => {
    const match = createMatch({ time: '18:00' });
    expect(isMatchInTimeSlot(match, 'evening')).toBe(true);
  });

  test('"evening" slot matches 21:00', () => {
    const match = createMatch({ time: '21:00' });
    expect(isMatchInTimeSlot(match, 'evening')).toBe(true);
  });

  test('"evening" slot matches 23:00', () => {
    const match = createMatch({ time: '23:00' });
    expect(isMatchInTimeSlot(match, 'evening')).toBe(true);
  });

  test('"evening" slot excludes 00:00 (night)', () => {
    const match = createMatch({ time: '00:00' });
    expect(isMatchInTimeSlot(match, 'evening')).toBe(false);
  });

  test('"night" slot matches 00:00', () => {
    const match = createMatch({ time: '00:00' });
    expect(isMatchInTimeSlot(match, 'night')).toBe(true);
  });

  test('"night" slot matches 03:00', () => {
    const match = createMatch({ time: '03:00' });
    expect(isMatchInTimeSlot(match, 'night')).toBe(true);
  });

  test('"night" slot matches 06:00', () => {
    const match = createMatch({ time: '06:00' });
    expect(isMatchInTimeSlot(match, 'night')).toBe(true);
  });

  test('"night" slot excludes 07:00', () => {
    const match = createMatch({ time: '07:00' });
    expect(isMatchInTimeSlot(match, 'night')).toBe(false);
  });

  test('"night" slot excludes 18:00 (evening)', () => {
    const match = createMatch({ time: '18:00' });
    expect(isMatchInTimeSlot(match, 'night')).toBe(false);
  });
});

describe('parseMatch', () => {
  test('parses standard match format', () => {
    const result = parseMatch('Belgique - Croatie');
    expect(result.team1).toBe('Belgique');
    expect(result.team2).toBe('Croatie');
  });

  test('handles whitespace', () => {
    const result = parseMatch('  France  -  Allemagne  ');
    expect(result.team1).toBe('France');
    expect(result.team2).toBe('Allemagne');
  });

  test('handles placeholder matches', () => {
    const result = parseMatch('Vainqueur G1 - Vainqueur G2');
    expect(result.team1).toBe('Vainqueur G1');
    expect(result.team2).toBe('Vainqueur G2');
  });

  test('handles invalid format gracefully', () => {
    const result = parseMatch('Invalid Match String');
    expect(result.team1).toBe('Invalid Match String');
    expect(result.team2).toBe('');
  });
});

describe('isMyTeamsMatch', () => {
  test('returns true when team1 is favorite', () => {
    const match = createMatch({ match: 'Belgique - Croatie' });
    expect(isMyTeamsMatch(match, ['Belgique'])).toBe(true);
  });

  test('returns true when team2 is favorite', () => {
    const match = createMatch({ match: 'France - Belgique' });
    expect(isMyTeamsMatch(match, ['Belgique'])).toBe(true);
  });

  test('returns true when both teams are favorites', () => {
    const match = createMatch({ match: 'Belgique - France' });
    expect(isMyTeamsMatch(match, ['Belgique', 'France'])).toBe(true);
  });

  test('returns false when no favorites set', () => {
    const match = createMatch({ match: 'Belgique - Croatie' });
    expect(isMyTeamsMatch(match, [])).toBe(false);
  });

  test('returns false when neither team is favorite', () => {
    const match = createMatch({ match: 'France - Allemagne' });
    expect(isMyTeamsMatch(match, ['Belgique', 'Croatie'])).toBe(false);
  });
});

describe('countTimeSlots', () => {
  test('counts evening and night matches correctly', () => {
    const matches: Match[] = [
      createMatch({ id: 1, time: '18:00' }), // evening
      createMatch({ id: 2, time: '21:00' }), // evening
      createMatch({ id: 3, time: '00:00' }), // night
      createMatch({ id: 4, time: '03:00' }), // night
      createMatch({ id: 5, time: '22:00' }), // evening
    ];
    const counts = countTimeSlots(matches);
    expect(counts.evening).toBe(3);
    expect(counts.night).toBe(2);
  });

  test('handles empty array', () => {
    const counts = countTimeSlots([]);
    expect(counts.evening).toBe(0);
    expect(counts.night).toBe(0);
  });

  test('handles times at boundaries', () => {
    const matches: Match[] = [
      createMatch({ id: 1, time: '06:00' }), // night (last night hour)
      createMatch({ id: 2, time: '06:59' }), // night
      createMatch({ id: 3, time: '17:59' }), // neither
      createMatch({ id: 4, time: '18:00' }), // evening (first evening hour)
      createMatch({ id: 5, time: '23:59' }), // evening
    ];
    const counts = countTimeSlots(matches);
    expect(counts.evening).toBe(2);
    expect(counts.night).toBe(2);
  });
});
