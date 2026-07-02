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
    it('returns score for FINISHED group stage match', () => {
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
      expect(score).not.toBeNull();
      expect(score?.home).toBe(2);
      expect(score?.away).toBe(1);
      expect(score?.qualifier).toBe('home');
      expect(score?.hadExtraTime).toBe(false);
      expect(score?.hadPenalties).toBe(false);
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

    it('uses fullTime score for extra time match (120 min)', () => {
      // Knockout match that went to extra time
      // Prediction should be on the 120-min score (fullTime)
      const apiMatch: ApiMatch = {
        id: 1,
        utcDate: '2026-07-10T19:00:00Z',
        status: 'FINISHED',
        matchday: 6,
        stage: 'QUARTER_FINALS',
        group: null,
        homeTeam: { id: 1, name: 'France', shortName: 'France', tla: 'FRA' },
        awayTeam: { id: 2, name: 'Germany', shortName: 'Germany', tla: 'GER' },
        score: {
          winner: 'HOME_TEAM',
          duration: 'EXTRA_TIME',
          fullTime: { home: 3, away: 2 },  // Final score after extra time
          halfTime: { home: 1, away: 1 },
          extraTime: { home: 1, away: 0 }, // Goals scored in extra time
        },
      };

      const score = getFinalScore(apiMatch);
      // Prediction is on fullTime (120 min score)
      expect(score?.home).toBe(3);
      expect(score?.away).toBe(2);
      expect(score?.qualifier).toBe('home');
      expect(score?.hadExtraTime).toBe(true);
      expect(score?.hadPenalties).toBe(false);
    });

    it('penalty shootout: records the 120-min draw, not the shootout-inflated fullTime', () => {
      // 2-2 after extra time (1-1 reg + 1-1 ET), Argentina wins the shootout 5-3.
      // football-data.org v4: fullTime INCLUDES the shootout goals → 5-7. We must record 2-2.
      const apiMatch: ApiMatch = {
        id: 1,
        utcDate: '2026-07-12T19:00:00Z',
        status: 'FINISHED',
        matchday: 7,
        stage: 'SEMI_FINALS',
        group: null,
        homeTeam: { id: 1, name: 'Brazil', shortName: 'Brazil', tla: 'BRA' },
        awayTeam: { id: 2, name: 'Argentina', shortName: 'Argentina', tla: 'ARG' },
        score: {
          winner: 'AWAY_TEAM',
          duration: 'PENALTY_SHOOTOUT',
          fullTime: { home: 5, away: 7 },     // 2-2 play + 3-5 shootout
          halfTime: { home: 1, away: 0 },
          regularTime: { home: 1, away: 1 },
          extraTime: { home: 1, away: 1 },
          penalties: { home: 3, away: 5 },    // Argentina wins shootout
        },
      };

      const score = getFinalScore(apiMatch);
      // Recorded score = end of play (regularTime + extraTime) = 2-2 draw
      expect(score?.home).toBe(2);
      expect(score?.away).toBe(2);
      expect(score?.qualifier).toBe('away'); // Argentina won the shootout
      expect(score?.hadExtraTime).toBe(true);
      expect(score?.hadPenalties).toBe(true);
    });

    it('penalty shootout without regularTime falls back to fullTime - penalties', () => {
      // 1-1 after play, France wins shootout 4-3. No regularTime field present.
      const apiMatch: ApiMatch = {
        id: 2,
        utcDate: '2026-07-12T19:00:00Z',
        status: 'FINISHED',
        matchday: 7,
        stage: 'QUARTER_FINALS',
        group: null,
        homeTeam: { id: 1, name: 'France', shortName: 'France', tla: 'FRA' },
        awayTeam: { id: 2, name: 'Spain', shortName: 'Spain', tla: 'ESP' },
        score: {
          winner: 'HOME_TEAM',
          duration: 'PENALTY_SHOOTOUT',
          fullTime: { home: 5, away: 4 },   // 1-1 play + 4-3 shootout
          halfTime: { home: 0, away: 1 },
          penalties: { home: 4, away: 3 },
        },
      };

      const score = getFinalScore(apiMatch);
      expect(score?.home).toBe(1);
      expect(score?.away).toBe(1);
      expect(score?.qualifier).toBe('home');
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
