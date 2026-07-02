import { describe, it, expect } from 'vitest';
import {
  getOutcome,
  getGoalDifference,
  isCorrectOutcome,
  isCorrectGoalDifference,
  isExactScore,
  countExactScores,
  calculateBasePoints,
  hasVisionaryBonus,
  calculatePoints,
  calculateMatchPoints,
  Prediction,
  MatchResult,
} from '../src/lib/scoring';

describe('getOutcome', () => {
  it('returns home when home score is higher', () => {
    expect(getOutcome(2, 1)).toBe('home');
    expect(getOutcome(3, 0)).toBe('home');
  });

  it('returns away when away score is higher', () => {
    expect(getOutcome(1, 2)).toBe('away');
    expect(getOutcome(0, 3)).toBe('away');
  });

  it('returns draw when scores are equal', () => {
    expect(getOutcome(1, 1)).toBe('draw');
    expect(getOutcome(0, 0)).toBe('draw');
    expect(getOutcome(3, 3)).toBe('draw');
  });
});

describe('getGoalDifference', () => {
  it('calculates positive difference for home win', () => {
    expect(getGoalDifference(3, 1)).toBe(2);
    expect(getGoalDifference(5, 0)).toBe(5);
  });

  it('calculates negative difference for away win', () => {
    expect(getGoalDifference(1, 3)).toBe(-2);
    expect(getGoalDifference(0, 5)).toBe(-5);
  });

  it('returns zero for draw', () => {
    expect(getGoalDifference(1, 1)).toBe(0);
    expect(getGoalDifference(0, 0)).toBe(0);
  });
});

describe('isCorrectOutcome', () => {
  it('returns true when outcome matches', () => {
    expect(isCorrectOutcome(
      { user_id: '1', home_score: 2, away_score: 1 },
      { home_score: 3, away_score: 0 }
    )).toBe(true); // Both home wins

    expect(isCorrectOutcome(
      { user_id: '1', home_score: 1, away_score: 2 },
      { home_score: 0, away_score: 1 }
    )).toBe(true); // Both away wins

    expect(isCorrectOutcome(
      { user_id: '1', home_score: 1, away_score: 1 },
      { home_score: 0, away_score: 0 }
    )).toBe(true); // Both draws
  });

  it('returns false when outcome differs', () => {
    expect(isCorrectOutcome(
      { user_id: '1', home_score: 2, away_score: 1 },
      { home_score: 0, away_score: 1 }
    )).toBe(false);

    expect(isCorrectOutcome(
      { user_id: '1', home_score: 1, away_score: 1 },
      { home_score: 2, away_score: 1 }
    )).toBe(false);
  });
});

describe('isExactScore', () => {
  it('returns true for exact match', () => {
    expect(isExactScore(
      { user_id: '1', home_score: 2, away_score: 1 },
      { home_score: 2, away_score: 1 }
    )).toBe(true);

    expect(isExactScore(
      { user_id: '1', home_score: 0, away_score: 0 },
      { home_score: 0, away_score: 0 }
    )).toBe(true);
  });

  it('returns false when not exact', () => {
    expect(isExactScore(
      { user_id: '1', home_score: 2, away_score: 1 },
      { home_score: 3, away_score: 1 }
    )).toBe(false);

    expect(isExactScore(
      { user_id: '1', home_score: 2, away_score: 1 },
      { home_score: 2, away_score: 0 }
    )).toBe(false);
  });
});

describe('calculateBasePoints', () => {
  const result: MatchResult = { home_score: 2, away_score: 1 };

  it('returns 3 for exact score', () => {
    const prediction: Prediction = { user_id: '1', home_score: 2, away_score: 1 };
    expect(calculateBasePoints(prediction, result)).toBe(3);
  });

  it('returns 2 for correct outcome and goal difference', () => {
    // Same diff (+1) but different scores
    const prediction: Prediction = { user_id: '1', home_score: 3, away_score: 2 };
    expect(calculateBasePoints(prediction, result)).toBe(2);
  });

  it('returns 1 for correct outcome only', () => {
    // Home win but different diff
    const prediction: Prediction = { user_id: '1', home_score: 4, away_score: 0 };
    expect(calculateBasePoints(prediction, result)).toBe(1);
  });

  it('returns 0 for wrong outcome', () => {
    const prediction: Prediction = { user_id: '1', home_score: 1, away_score: 2 };
    expect(calculateBasePoints(prediction, result)).toBe(0);
  });

  it('handles draw exact correctly', () => {
    const drawResult: MatchResult = { home_score: 1, away_score: 1 };
    const exactDraw: Prediction = { user_id: '1', home_score: 1, away_score: 1 };
    expect(calculateBasePoints(exactDraw, drawResult)).toBe(3);

    // Different draw score - still 2 pts (correct outcome + diff of 0)
    const differentDraw: Prediction = { user_id: '1', home_score: 2, away_score: 2 };
    expect(calculateBasePoints(differentDraw, drawResult)).toBe(2);
  });

  it('handles 0-0 draw', () => {
    const zeroZero: MatchResult = { home_score: 0, away_score: 0 };
    const exactZero: Prediction = { user_id: '1', home_score: 0, away_score: 0 };
    expect(calculateBasePoints(exactZero, zeroZero)).toBe(3);
  });
});

describe('countExactScores', () => {
  const result: MatchResult = { home_score: 2, away_score: 1 };

  it('counts exact matches correctly', () => {
    const predictions: Prediction[] = [
      { user_id: '1', home_score: 2, away_score: 1 }, // exact
      { user_id: '2', home_score: 2, away_score: 1 }, // exact
      { user_id: '3', home_score: 3, away_score: 1 }, // not exact
    ];
    expect(countExactScores(predictions, result)).toBe(2);
  });

  it('returns 0 when no exact matches', () => {
    const predictions: Prediction[] = [
      { user_id: '1', home_score: 3, away_score: 0 },
      { user_id: '2', home_score: 1, away_score: 0 },
    ];
    expect(countExactScores(predictions, result)).toBe(0);
  });
});

describe('hasVisionaryBonus', () => {
  const result: MatchResult = { home_score: 2, away_score: 1 };

  it('returns true when only one person has exact score', () => {
    const predictions: Prediction[] = [
      { user_id: '1', home_score: 2, away_score: 1 }, // exact (only one)
      { user_id: '2', home_score: 3, away_score: 1 },
      { user_id: '3', home_score: 2, away_score: 0 },
    ];
    const prediction = predictions[0];
    expect(hasVisionaryBonus(prediction, result, predictions)).toBe(true);
  });

  it('returns false when multiple people have exact score', () => {
    const predictions: Prediction[] = [
      { user_id: '1', home_score: 2, away_score: 1 }, // exact
      { user_id: '2', home_score: 2, away_score: 1 }, // exact too
      { user_id: '3', home_score: 2, away_score: 0 },
    ];
    const prediction = predictions[0];
    expect(hasVisionaryBonus(prediction, result, predictions)).toBe(false);
  });

  it('returns false when prediction is not exact', () => {
    const predictions: Prediction[] = [
      { user_id: '1', home_score: 3, away_score: 1 }, // not exact
    ];
    expect(hasVisionaryBonus(predictions[0], result, predictions)).toBe(false);
  });
});

describe('calculatePoints (full breakdown)', () => {
  it('calculates maximum points (3 base + 1 visionary = 4)', () => {
    const homeTeam = 'Afrique du Sud';
    const awayTeam = 'Belgique';

    const predictions: Prediction[] = [
      { user_id: '1', home_score: 1, away_score: 0 }, // exact + visionary (solo)
      { user_id: '2', home_score: 2, away_score: 0 },
      { user_id: '3', home_score: 0, away_score: 1 },
    ];
    const result: MatchResult = { home_score: 1, away_score: 0 };

    const points = calculatePoints(predictions[0], result, predictions, homeTeam, awayTeam);

    expect(points.base).toBe(3);
    expect(points.visionary).toBe(1);
    expect(points.total).toBe(4);
    expect(points.detail).toContain('Score exact');
    expect(points.detail).toContain('Visionnaire');
  });

  it('calculates shared exact score (no visionary)', () => {
    // France (rank 2) vs Belgique (rank 3) - France is favorite
    const homeTeam = 'France';
    const awayTeam = 'Belgique';

    const predictions: Prediction[] = [
      { user_id: '1', home_score: 2, away_score: 1 },
      { user_id: '2', home_score: 2, away_score: 1 }, // same exact
      { user_id: '3', home_score: 3, away_score: 0 },
    ];
    const result: MatchResult = { home_score: 2, away_score: 1 };

    const points = calculatePoints(predictions[0], result, predictions, homeTeam, awayTeam);

    expect(points.base).toBe(3);
    expect(points.visionary).toBe(0); // Not alone
    expect(points.total).toBe(3);
  });

  it('calculates zero points for wrong outcome', () => {
    const homeTeam = 'Belgique';
    const awayTeam = 'France';

    const predictions: Prediction[] = [
      { user_id: '1', home_score: 0, away_score: 2 },
    ];
    const result: MatchResult = { home_score: 2, away_score: 1 };

    const points = calculatePoints(predictions[0], result, predictions, homeTeam, awayTeam);

    expect(points.base).toBe(0);
    expect(points.visionary).toBe(0);
    expect(points.total).toBe(0);
    expect(points.detail).toContain('Mauvais résultat');
  });
});

describe('calculateMatchPoints', () => {
  it('calculates points for all predictions', () => {
    const homeTeam = 'Belgique';
    const awayTeam = 'Maroc';

    const predictions: Prediction[] = [
      { user_id: '1', home_score: 2, away_score: 1 }, // exact
      { user_id: '2', home_score: 3, away_score: 2 }, // correct diff
      { user_id: '3', home_score: 4, away_score: 0 }, // correct outcome
      { user_id: '4', home_score: 0, away_score: 1 }, // wrong
    ];
    const result: MatchResult = { home_score: 2, away_score: 1 };

    const results = calculateMatchPoints(predictions, result, homeTeam, awayTeam);

    expect(results.get('1')?.base).toBe(3); // exact
    expect(results.get('1')?.visionary).toBe(1); // solo exact
    expect(results.get('1')?.total).toBe(4);

    expect(results.get('2')?.base).toBe(2); // diff
    expect(results.get('2')?.total).toBe(2);

    expect(results.get('3')?.base).toBe(1); // outcome
    expect(results.get('3')?.total).toBe(1);

    expect(results.get('4')?.base).toBe(0); // wrong
    expect(results.get('4')?.total).toBe(0);
  });
});

describe('edge cases', () => {
  it('handles high-scoring game', () => {
    const prediction: Prediction = { user_id: '1', home_score: 5, away_score: 4 };
    const result: MatchResult = { home_score: 5, away_score: 4 };

    expect(calculateBasePoints(prediction, result)).toBe(3);
  });

  it('handles 0-0 draw correctly', () => {
    const prediction: Prediction = { user_id: '1', home_score: 0, away_score: 0 };
    const result: MatchResult = { home_score: 0, away_score: 0 };

    expect(calculateBasePoints(prediction, result)).toBe(3);
    expect(isExactScore(prediction, result)).toBe(true);
  });

  it('differentiates between different draws (1-1 vs 2-2)', () => {
    const prediction: Prediction = { user_id: '1', home_score: 1, away_score: 1 };
    const result: MatchResult = { home_score: 2, away_score: 2 };

    // Same diff (0) but not exact
    expect(calculateBasePoints(prediction, result)).toBe(2);
    expect(isExactScore(prediction, result)).toBe(false);
  });
});
