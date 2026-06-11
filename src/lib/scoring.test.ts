/**
 * Unit Tests for ZbrePlanning Scoring Engine
 * Run with: npx vitest src/lib/scoring.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  getOutcome,
  getGoalDifference,
  isCorrectOutcome,
  isCorrectGoalDifference,
  isExactScore,
  calculateBasePoints,
  hasVisionaryBonus,
  hasOutsiderBonus,
  calculatePoints,
  calculateMatchPoints,
  type Prediction,
  type MatchResult,
} from './scoring';

describe('Scoring Engine', () => {
  describe('getOutcome', () => {
    it('returns home when home score is higher', () => {
      expect(getOutcome(2, 1)).toBe('home');
      expect(getOutcome(5, 0)).toBe('home');
    });

    it('returns away when away score is higher', () => {
      expect(getOutcome(1, 2)).toBe('away');
      expect(getOutcome(0, 3)).toBe('away');
    });

    it('returns draw when scores are equal', () => {
      expect(getOutcome(0, 0)).toBe('draw');
      expect(getOutcome(2, 2)).toBe('draw');
    });
  });

  describe('getGoalDifference', () => {
    it('calculates positive difference for home wins', () => {
      expect(getGoalDifference(3, 1)).toBe(2);
    });

    it('calculates negative difference for away wins', () => {
      expect(getGoalDifference(1, 3)).toBe(-2);
    });

    it('calculates zero for draws', () => {
      expect(getGoalDifference(2, 2)).toBe(0);
    });
  });

  describe('isCorrectOutcome', () => {
    it('returns true when outcome matches', () => {
      const prediction: Prediction = { user_id: '1', home_score: 2, away_score: 1 };
      const result: MatchResult = { home_score: 3, away_score: 0 };
      expect(isCorrectOutcome(prediction, result)).toBe(true);
    });

    it('returns false when outcome differs', () => {
      const prediction: Prediction = { user_id: '1', home_score: 2, away_score: 1 };
      const result: MatchResult = { home_score: 1, away_score: 2 };
      expect(isCorrectOutcome(prediction, result)).toBe(false);
    });
  });

  describe('isCorrectGoalDifference', () => {
    it('returns true when goal difference matches', () => {
      const prediction: Prediction = { user_id: '1', home_score: 2, away_score: 0 };
      const result: MatchResult = { home_score: 3, away_score: 1 };
      expect(isCorrectGoalDifference(prediction, result)).toBe(true);
    });

    it('returns false when goal difference differs', () => {
      const prediction: Prediction = { user_id: '1', home_score: 2, away_score: 0 };
      const result: MatchResult = { home_score: 2, away_score: 1 };
      expect(isCorrectGoalDifference(prediction, result)).toBe(false);
    });
  });

  describe('isExactScore', () => {
    it('returns true for exact match', () => {
      const prediction: Prediction = { user_id: '1', home_score: 2, away_score: 1 };
      const result: MatchResult = { home_score: 2, away_score: 1 };
      expect(isExactScore(prediction, result)).toBe(true);
    });

    it('returns false for different scores', () => {
      const prediction: Prediction = { user_id: '1', home_score: 2, away_score: 1 };
      const result: MatchResult = { home_score: 2, away_score: 2 };
      expect(isExactScore(prediction, result)).toBe(false);
    });
  });

  describe('calculateBasePoints', () => {
    it('returns 0 for wrong outcome', () => {
      const prediction: Prediction = { user_id: '1', home_score: 2, away_score: 1 };
      const result: MatchResult = { home_score: 0, away_score: 1 };
      expect(calculateBasePoints(prediction, result)).toBe(0);
    });

    it('returns 1 for correct outcome only', () => {
      const prediction: Prediction = { user_id: '1', home_score: 3, away_score: 0 };
      const result: MatchResult = { home_score: 2, away_score: 1 };
      expect(calculateBasePoints(prediction, result)).toBe(1);
    });

    it('returns 2 for correct outcome + correct goal difference', () => {
      const prediction: Prediction = { user_id: '1', home_score: 2, away_score: 0 };
      const result: MatchResult = { home_score: 3, away_score: 1 };
      expect(calculateBasePoints(prediction, result)).toBe(2);
    });

    it('returns 3 for exact score', () => {
      const prediction: Prediction = { user_id: '1', home_score: 2, away_score: 1 };
      const result: MatchResult = { home_score: 2, away_score: 1 };
      expect(calculateBasePoints(prediction, result)).toBe(3);
    });

    it('returns 2 for correct draw with different scores (0-0 vs 1-1)', () => {
      const prediction: Prediction = { user_id: '1', home_score: 0, away_score: 0 };
      const result: MatchResult = { home_score: 1, away_score: 1 };
      expect(calculateBasePoints(prediction, result)).toBe(2); // Same diff (0), correct outcome
    });
  });

  describe('hasVisionaryBonus', () => {
    it('returns true when only one person got exact score', () => {
      const prediction: Prediction = { user_id: '1', home_score: 2, away_score: 1 };
      const result: MatchResult = { home_score: 2, away_score: 1 };
      const allPredictions: Prediction[] = [
        { user_id: '1', home_score: 2, away_score: 1 },
        { user_id: '2', home_score: 3, away_score: 0 },
        { user_id: '3', home_score: 1, away_score: 1 },
      ];
      expect(hasVisionaryBonus(prediction, result, allPredictions)).toBe(true);
    });

    it('returns false when multiple people got exact score', () => {
      const prediction: Prediction = { user_id: '1', home_score: 2, away_score: 1 };
      const result: MatchResult = { home_score: 2, away_score: 1 };
      const allPredictions: Prediction[] = [
        { user_id: '1', home_score: 2, away_score: 1 },
        { user_id: '2', home_score: 2, away_score: 1 },
      ];
      expect(hasVisionaryBonus(prediction, result, allPredictions)).toBe(false);
    });

    it('returns false when prediction is not exact', () => {
      const prediction: Prediction = { user_id: '1', home_score: 3, away_score: 0 };
      const result: MatchResult = { home_score: 2, away_score: 1 };
      const allPredictions: Prediction[] = [
        { user_id: '1', home_score: 3, away_score: 0 },
      ];
      expect(hasVisionaryBonus(prediction, result, allPredictions)).toBe(false);
    });
  });

  describe('calculateMatchPoints - handles missing predictions', () => {
    it('only calculates points for users who predicted', () => {
      const predictions: Prediction[] = [
        { user_id: '1', home_score: 2, away_score: 1 },
        { user_id: '2', home_score: 3, away_score: 0 },
        // users 3-14 did not predict
      ];
      const result: MatchResult = { home_score: 2, away_score: 1 };

      const points = calculateMatchPoints(predictions, result, 'France', 'Allemagne');

      // Only 2 entries should be returned
      expect(points.size).toBe(2);
      expect(points.has('1')).toBe(true);
      expect(points.has('2')).toBe(true);
      expect(points.has('3')).toBe(false);
    });

    it('returns empty map when no predictions exist', () => {
      const predictions: Prediction[] = [];
      const result: MatchResult = { home_score: 2, away_score: 1 };

      const points = calculateMatchPoints(predictions, result, 'France', 'Allemagne');

      expect(points.size).toBe(0);
    });
  });

  describe('calculatePoints - full breakdown', () => {
    it('calculates all bonuses correctly', () => {
      const prediction: Prediction = { user_id: '1', home_score: 2, away_score: 1 };
      const result: MatchResult = { home_score: 2, away_score: 1 };
      const allPredictions: Prediction[] = [
        { user_id: '1', home_score: 2, away_score: 1 },
        { user_id: '2', home_score: 3, away_score: 0 },
      ];

      const breakdown = calculatePoints(prediction, result, allPredictions, 'France', 'Allemagne');

      expect(breakdown.base).toBe(3);      // exact score
      expect(breakdown.visionary).toBe(1); // only one exact
      expect(breakdown.outsider).toBe(0);  // France not outsider
      expect(breakdown.total).toBe(4);
      expect(breakdown.detail).toContain('Score exact');
      expect(breakdown.detail).toContain('Visionnaire');
    });

    it('returns 0 points for wrong prediction', () => {
      const prediction: Prediction = { user_id: '1', home_score: 0, away_score: 2 };
      const result: MatchResult = { home_score: 2, away_score: 1 };
      const allPredictions: Prediction[] = [prediction];

      const breakdown = calculatePoints(prediction, result, allPredictions, 'France', 'Allemagne');

      expect(breakdown.base).toBe(0);
      expect(breakdown.visionary).toBe(0);
      expect(breakdown.outsider).toBe(0);
      expect(breakdown.total).toBe(0);
    });
  });

  describe('Edge cases - scoring robustness', () => {
    it('handles 0-0 predictions correctly', () => {
      const prediction: Prediction = { user_id: '1', home_score: 0, away_score: 0 };
      const result: MatchResult = { home_score: 0, away_score: 0 };

      expect(isExactScore(prediction, result)).toBe(true);
      expect(calculateBasePoints(prediction, result)).toBe(3);
    });

    it('handles high-scoring games', () => {
      const prediction: Prediction = { user_id: '1', home_score: 7, away_score: 1 };
      const result: MatchResult = { home_score: 7, away_score: 1 };

      expect(calculateBasePoints(prediction, result)).toBe(3);
    });

    it('correctly identifies draw outcomes', () => {
      const pred1: Prediction = { user_id: '1', home_score: 1, away_score: 1 };
      const pred2: Prediction = { user_id: '2', home_score: 2, away_score: 2 };
      const result: MatchResult = { home_score: 0, away_score: 0 };

      // Both predicted draws, so both have correct outcome
      expect(isCorrectOutcome(pred1, result)).toBe(true);
      expect(isCorrectOutcome(pred2, result)).toBe(true);

      // pred1 and pred2 have diff of 0, same as result
      expect(isCorrectGoalDifference(pred1, result)).toBe(true);
      expect(isCorrectGoalDifference(pred2, result)).toBe(true);
    });

    it('handles member who did not predict (empty prediction list)', () => {
      // When a member didn't predict, they simply won't be in the predictions array
      // The scoring system should handle this gracefully
      const predictions: Prediction[] = [
        { user_id: '1', home_score: 2, away_score: 1 },
      ];
      const result: MatchResult = { home_score: 2, away_score: 1 };

      const pointsMap = calculateMatchPoints(predictions, result, 'France', 'Allemagne');

      // User 1 gets points, users 2-14 are not in the map (0 points by default)
      expect(pointsMap.get('1')?.total).toBe(4); // 3 + 1 visionary
      expect(pointsMap.get('2')).toBeUndefined(); // No entry = 0 points
    });
  });
});
