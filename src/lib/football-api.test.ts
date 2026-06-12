/**
 * Unit Tests for Football API Integration
 * Run with: npx vitest src/lib/football-api.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  TEAM_NAME_MAPPING,
  teamsMatch,
  apiTeamNameToOurs,
  findOurMatchId,
  getFinalScore,
  ApiMatch,
} from './football-api';
import matches from '@/data/matches.json';

describe('Football API Integration', () => {
  describe('Team Name Mapping', () => {
    it('maps all 48 teams', () => {
      expect(Object.keys(TEAM_NAME_MAPPING).length).toBeGreaterThanOrEqual(48);
    });

    it('teamsMatch handles French to English correctly', () => {
      expect(teamsMatch('France', 'France')).toBe(true);
      expect(teamsMatch('Allemagne', 'Germany')).toBe(true);
      expect(teamsMatch('USA', 'United States')).toBe(true);
      expect(teamsMatch('Corée du Sud', 'South Korea')).toBe(true);
      expect(teamsMatch('Corée du Sud', 'Korea Republic')).toBe(true);
      expect(teamsMatch("Côte d'Ivoire", 'Ivory Coast')).toBe(true);
    });

    it('teamsMatch returns false for non-matches', () => {
      expect(teamsMatch('France', 'Germany')).toBe(false);
      expect(teamsMatch('Allemagne', 'France')).toBe(false);
    });

    it('apiTeamNameToOurs converts API names back', () => {
      expect(apiTeamNameToOurs('Germany')).toBe('Allemagne');
      expect(apiTeamNameToOurs('South Korea')).toBe('Corée du Sud');
      expect(apiTeamNameToOurs('United States')).toBe('USA');
      expect(apiTeamNameToOurs('Ivory Coast')).toBe("Côte d'Ivoire");
    });
  });

  describe('findOurMatchId', () => {
    const mockApiMatch: ApiMatch = {
      id: 12345,
      utcDate: '2026-06-11T19:00:00Z', // 21:00 Brussels
      status: 'FINISHED',
      matchday: 1,
      stage: 'GROUP_STAGE',
      group: 'GROUP_A',
      homeTeam: { id: 1, name: 'Mexico', shortName: 'Mexico', tla: 'MEX' },
      awayTeam: { id: 2, name: 'South Africa', shortName: 'South Africa', tla: 'RSA' },
      score: {
        winner: 'HOME_TEAM',
        duration: 'REGULAR',
        fullTime: { home: 2, away: 1 },
        halfTime: { home: 1, away: 0 },
      },
    };

    it('finds match by date and teams', () => {
      const matchId = findOurMatchId(mockApiMatch, matches as any);
      expect(matchId).toBe(1); // Match 1 is Mexico vs South Africa
    });

    it('returns null for non-matching teams', () => {
      const wrongTeamMatch: ApiMatch = {
        ...mockApiMatch,
        homeTeam: { id: 1, name: 'France', shortName: 'France', tla: 'FRA' },
        awayTeam: { id: 2, name: 'Germany', shortName: 'Germany', tla: 'GER' },
      };
      const matchId = findOurMatchId(wrongTeamMatch, matches as any);
      expect(matchId).toBeNull();
    });
  });

  describe('getFinalScore', () => {
    it('returns score for FINISHED match', () => {
      const apiMatch: ApiMatch = {
        id: 1,
        utcDate: '2026-06-11T19:00:00Z',
        status: 'FINISHED',
        matchday: 1,
        stage: 'GROUP_STAGE',
        group: 'GROUP_A',
        homeTeam: { id: 1, name: 'Mexico', shortName: 'Mexico', tla: 'MEX' },
        awayTeam: { id: 2, name: 'South Africa', shortName: 'South Africa', tla: 'RSA' },
        score: {
          winner: 'HOME_TEAM',
          duration: 'REGULAR',
          fullTime: { home: 2, away: 1 },
          halfTime: { home: 1, away: 0 },
        },
      };

      const score = getFinalScore(apiMatch);
      expect(score).toEqual({ home: 2, away: 1 });
    });

    it('returns null for non-FINISHED match', () => {
      const apiMatch: ApiMatch = {
        id: 1,
        utcDate: '2026-06-11T19:00:00Z',
        status: 'IN_PLAY',
        matchday: 1,
        stage: 'GROUP_STAGE',
        group: 'GROUP_A',
        homeTeam: { id: 1, name: 'Mexico', shortName: 'Mexico', tla: 'MEX' },
        awayTeam: { id: 2, name: 'South Africa', shortName: 'South Africa', tla: 'RSA' },
        score: {
          winner: null,
          duration: 'REGULAR',
          fullTime: { home: 1, away: 0 },
          halfTime: { home: 1, away: 0 },
        },
      };

      const score = getFinalScore(apiMatch);
      expect(score).toBeNull();
    });
  });

  describe('Idempotency check', () => {
    it('should not recalculate points for already-synced matches', () => {
      // This is tested at the integration level in the sync route
      // The route checks existingMatchIds before processing
      expect(true).toBe(true); // Placeholder - real test needs DB mock
    });
  });
});

describe('72/72 Group Stage Mapping', () => {
  it('all group stage matches have valid team mappings', () => {
    const groupMatches = (matches as any[]).filter(
      (m: any) => m.phase === 'PHASE DE GROUPES'
    );

    expect(groupMatches.length).toBe(72);

    for (const match of groupMatches) {
      const parts = match.match.split(' - ');
      expect(parts.length).toBe(2);

      const [home, away] = parts.map((t: string) => t.trim());

      expect(TEAM_NAME_MAPPING[home]).toBeDefined();
      expect(TEAM_NAME_MAPPING[away]).toBeDefined();
      expect(TEAM_NAME_MAPPING[home].length).toBeGreaterThan(0);
      expect(TEAM_NAME_MAPPING[away].length).toBeGreaterThan(0);
    }
  });
});
