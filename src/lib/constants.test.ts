/**
 * Tests for phase constants and match data consistency
 * Run with: npx vitest src/lib/constants.test.ts
 */

import { describe, it, expect } from 'vitest';
import { PHASES, PHASE_ORDER, PHASE_DISPLAY, isKnockoutPhase, getPhaseBadge } from './constants';
import matches from '@/data/matches.json';

describe('Phase Constants', () => {
  it('all phases in PHASE_ORDER have display config', () => {
    for (const phase of PHASE_ORDER) {
      expect(PHASE_DISPLAY[phase]).toBeDefined();
      expect(PHASE_DISPLAY[phase].label).toBeTruthy();
      expect(PHASE_DISPLAY[phase].shortLabel).toBeTruthy();
      expect(PHASE_DISPLAY[phase].icon).toBeTruthy();
    }
  });

  it('PHASE_ORDER contains all PHASES values', () => {
    const phasesValues = Object.values(PHASES);
    expect(PHASE_ORDER).toHaveLength(phasesValues.length);
    for (const phase of phasesValues) {
      expect(PHASE_ORDER).toContain(phase);
    }
  });

  it('isKnockoutPhase correctly identifies knockout phases', () => {
    expect(isKnockoutPhase(PHASES.GROUP_STAGE)).toBe(false);
    expect(isKnockoutPhase(PHASES.ROUND_OF_32)).toBe(true);
    expect(isKnockoutPhase(PHASES.ROUND_OF_16)).toBe(true);
    expect(isKnockoutPhase(PHASES.QUARTER_FINALS)).toBe(true);
    expect(isKnockoutPhase(PHASES.SEMI_FINALS)).toBe(true);
    expect(isKnockoutPhase(PHASES.THIRD_PLACE)).toBe(true);
    expect(isKnockoutPhase(PHASES.FINAL)).toBe(true);
  });

  it('getPhaseBadge returns valid badge for all phases', () => {
    for (const phase of PHASE_ORDER) {
      const badge = getPhaseBadge(phase);
      expect(badge).not.toBeNull();
      expect(badge?.label).toBeTruthy();
      expect(badge?.color).toBeTruthy();
    }
  });
});

describe('Match Data vs Phase Constants', () => {
  const matchPhases = [...new Set((matches as { phase: string }[]).map(m => m.phase))];

  it('all match phases are defined in PHASES constant', () => {
    const definedPhases = Object.values(PHASES);
    for (const phase of matchPhases) {
      expect(definedPhases).toContain(phase);
    }
  });

  it('every phase in PHASE_ORDER has at least one match', () => {
    for (const phase of PHASE_ORDER) {
      const matchCount = (matches as { phase: string }[]).filter(m => m.phase === phase).length;
      expect(matchCount).toBeGreaterThan(0);
    }
  });

  it('total matches is 104 (World Cup 2026 format)', () => {
    expect(matches).toHaveLength(104);
  });

  it('has correct match counts per phase', () => {
    const counts: Record<string, number> = {};
    for (const match of matches as { phase: string }[]) {
      counts[match.phase] = (counts[match.phase] || 0) + 1;
    }

    expect(counts[PHASES.GROUP_STAGE]).toBe(72);      // 12 groups × 6 matches
    expect(counts[PHASES.ROUND_OF_32]).toBe(16);      // 32 teams → 16 matches
    expect(counts[PHASES.ROUND_OF_16]).toBe(8);       // 16 teams → 8 matches
    expect(counts[PHASES.QUARTER_FINALS]).toBe(4);    // 8 teams → 4 matches
    expect(counts[PHASES.SEMI_FINALS]).toBe(2);       // 4 teams → 2 matches
    expect(counts[PHASES.THIRD_PLACE]).toBe(1);       // 1 match
    expect(counts[PHASES.FINAL]).toBe(1);             // 1 match
  });

  it('filter logic: exact match works for all phases', () => {
    // Simulate the filter logic from world-cup page
    for (const selectedPhase of PHASE_ORDER) {
      const filteredMatches = (matches as { phase: string }[]).filter(
        m => m.phase === selectedPhase
      );
      expect(filteredMatches.length).toBeGreaterThan(0);
    }
  });
});
