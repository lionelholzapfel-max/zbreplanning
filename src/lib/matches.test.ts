/**
 * Unit Tests for Match Timezone Handling
 * CRITICAL: These tests verify that kickoff times in matches.json
 * (which are in Europe/Brussels timezone) are correctly converted
 * to UTC regardless of server timezone.
 *
 * Run with: npx vitest src/lib/matches.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  getMatchById,
  getMatchKickoff,
  getPredictionLockTime,
  isPredictionLocked,
  FIRST_MATCH_KICKOFF,
  GLOBAL_PREDICTIONS_LOCK,
  PREDICTION_LOCK_OFFSET_MS,
} from './matches';

describe('Match Timezone Handling', () => {
  describe('FIRST_MATCH_KICKOFF constant', () => {
    it('should be June 11, 2026 at 19:00 UTC (21:00 Brussels)', () => {
      // 2026-06-11T21:00:00+02:00 = 2026-06-11T19:00:00Z
      expect(FIRST_MATCH_KICKOFF.toISOString()).toBe('2026-06-11T19:00:00.000Z');
    });

    it('should lock global predictions on June 14 at 21:00 UTC (23:00 Brussels)', () => {
      // 2026-06-14T23:00:00+02:00 = 2026-06-14T21:00:00Z
      expect(GLOBAL_PREDICTIONS_LOCK.toISOString()).toBe('2026-06-14T21:00:00.000Z');
    });
  });

  describe('getMatchKickoff - Timezone Conversion', () => {
    it('Match 1: should convert "21:00" Brussels to 19:00 UTC', () => {
      const match = getMatchById(1);
      expect(match).toBeDefined();
      expect(match!.date).toBe('2026-06-11');
      expect(match!.time).toBe('21:00');

      const kickoff = getMatchKickoff(match!);
      // 21:00 Brussels (UTC+2 in summer) = 19:00 UTC
      expect(kickoff.toISOString()).toBe('2026-06-11T19:00:00.000Z');
    });

    it('Match 2: should convert "04:00" Brussels to 02:00 UTC', () => {
      const match = getMatchById(2);
      expect(match).toBeDefined();
      expect(match!.date).toBe('2026-06-12');
      expect(match!.time).toBe('04:00');

      const kickoff = getMatchKickoff(match!);
      // 04:00 Brussels (UTC+2 in summer) = 02:00 UTC
      expect(kickoff.toISOString()).toBe('2026-06-12T02:00:00.000Z');
    });

    it('Match 3: should convert "18:00" Brussels to 16:00 UTC', () => {
      const match = getMatchById(3);
      expect(match).toBeDefined();
      expect(match!.date).toBe('2026-06-18');
      expect(match!.time).toBe('18:00');

      const kickoff = getMatchKickoff(match!);
      // 18:00 Brussels (UTC+2 in summer) = 16:00 UTC
      expect(kickoff.toISOString()).toBe('2026-06-18T16:00:00.000Z');
    });
  });

  describe('getPredictionLockTime - 2 Hours Before Kickoff', () => {
    it('Match 1: lock at 17:00 UTC (19:00 Brussels)', () => {
      const match = getMatchById(1);
      const lockTime = getPredictionLockTime(match!);
      // Kickoff 19:00 UTC - 2h = 17:00 UTC
      expect(lockTime.toISOString()).toBe('2026-06-11T17:00:00.000Z');
    });

    it('Match 2: lock at 00:00 UTC (02:00 Brussels)', () => {
      const match = getMatchById(2);
      const lockTime = getPredictionLockTime(match!);
      // Kickoff 02:00 UTC - 2h = 00:00 UTC
      expect(lockTime.toISOString()).toBe('2026-06-12T00:00:00.000Z');
    });

    it('lock time should always be exactly 2 hours before kickoff', () => {
      const match = getMatchById(1);
      const kickoff = getMatchKickoff(match!);
      const lockTime = getPredictionLockTime(match!);

      const diff = kickoff.getTime() - lockTime.getTime();
      expect(diff).toBe(PREDICTION_LOCK_OFFSET_MS); // 2 hours in ms
      expect(diff).toBe(2 * 60 * 60 * 1000);
    });
  });

  describe('isPredictionLocked - Lock Detection', () => {
    it('should return false for match far in the future', () => {
      // Match 104 (Finale) is on 2026-07-19
      const isLocked = isPredictionLocked(104);
      // Since we're running this test before 2026, it should not be locked
      expect(isLocked).toBe(false);
    });

    it('should return true for nonexistent match (safety)', () => {
      const isLocked = isPredictionLocked(9999);
      expect(isLocked).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle midnight times correctly', () => {
      // Match 10: 2026-06-19 00:00 Brussels = 2026-06-18 22:00 UTC
      const match = getMatchById(10);
      expect(match).toBeDefined();
      expect(match!.time).toBe('00:00');

      const kickoff = getMatchKickoff(match!);
      expect(kickoff.toISOString()).toBe('2026-06-18T22:00:00.000Z');
    });

    it('should handle early morning times correctly', () => {
      // Match 14: 2026-06-14 03:00 Brussels = 2026-06-14 01:00 UTC
      const match = getMatchById(14);
      expect(match).toBeDefined();
      expect(match!.time).toBe('03:00');

      const kickoff = getMatchKickoff(match!);
      expect(kickoff.toISOString()).toBe('2026-06-14T01:00:00.000Z');
    });

    it('should handle half-hour times correctly', () => {
      // Match 65: 2026-06-28 01:30 Brussels = 2026-06-27 23:30 UTC
      const match = getMatchById(65);
      expect(match).toBeDefined();
      expect(match!.time).toBe('01:30');

      const kickoff = getMatchKickoff(match!);
      expect(kickoff.toISOString()).toBe('2026-06-27T23:30:00.000Z');
    });
  });
});

describe('Timezone Independence', () => {
  // This test verifies that our code works regardless of server timezone
  // by checking that Date parsing uses explicit offset, not local time

  it('should produce consistent UTC timestamps regardless of environment', () => {
    // The key insight: our code builds ISO strings with explicit +02:00 offset
    // This means the same code will produce the same UTC timestamp
    // whether running on a server in UTC, EST, or any other timezone

    const match = getMatchById(1);
    const kickoff = getMatchKickoff(match!);

    // This MUST always be the same, regardless of where this code runs
    const utcTimestamp = kickoff.getTime();
    const expectedTimestamp = Date.parse('2026-06-11T19:00:00.000Z');

    expect(utcTimestamp).toBe(expectedTimestamp);
  });
});
