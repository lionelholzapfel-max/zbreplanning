/**
 * Scoring Engine for ZbrePlanning
 * Pure functions for calculating prediction points
 *
 * SCORING RULES:
 * - Group stage: score prediction (0-3 pts) + visionary (+1 if solo exact)
 * - Knockout: same + qualifier bonus (+1 if correct team advances)
 *   - Score prediction is for 90 minutes (draw is possible)
 *   - Qualifier is decided by extra time or penalties
 */

import { isKnockoutPhase } from './constants';

export interface Prediction {
  user_id: string;
  home_score: number;
  away_score: number;
  qualifier_pick?: 'home' | 'away' | null;  // For knockout matches
}

export interface MatchResult {
  home_score: number;       // 90-minute score (or final for group stage)
  away_score: number;       // 90-minute score (or final for group stage)
  qualifier?: 'home' | 'away' | null;  // Who advanced (knockout only)
}

export interface PointsBreakdown {
  base: number;          // 0, 1, 2, or 3
  visionary: number;     // 0 or 1 (solo exact score)
  qualifier: number;     // 0 or 1 (correct qualifier for knockout)
  total: number;
  detail: string;        // Human-readable explanation
}

/**
 * Determine the match outcome from a score
 * Returns: 'home' | 'away' | 'draw'
 */
export function getOutcome(homeScore: number, awayScore: number): 'home' | 'away' | 'draw' {
  if (homeScore > awayScore) return 'home';
  if (awayScore > homeScore) return 'away';
  return 'draw';
}

/**
 * Calculate goal difference
 */
export function getGoalDifference(homeScore: number, awayScore: number): number {
  return homeScore - awayScore;
}

/**
 * Check if prediction matches result outcome (win/draw/loss)
 */
export function isCorrectOutcome(prediction: Prediction, result: MatchResult): boolean {
  return getOutcome(prediction.home_score, prediction.away_score) ===
         getOutcome(result.home_score, result.away_score);
}

/**
 * Check if prediction matches result goal difference
 */
export function isCorrectGoalDifference(prediction: Prediction, result: MatchResult): boolean {
  return getGoalDifference(prediction.home_score, prediction.away_score) ===
         getGoalDifference(result.home_score, result.away_score);
}

/**
 * Check if prediction is exact score
 */
export function isExactScore(prediction: Prediction, result: MatchResult): boolean {
  return prediction.home_score === result.home_score &&
         prediction.away_score === result.away_score;
}

/**
 * Count how many predictions have exact score
 */
export function countExactScores(predictions: Prediction[], result: MatchResult): number {
  return predictions.filter(p => isExactScore(p, result)).length;
}

/**
 * Calculate base points for a prediction (0, 1, 2, or 3)
 * - Wrong outcome: 0 pts
 * - Correct outcome: 1 pt
 * - Correct outcome + correct goal difference: 2 pts
 * - Exact score: 3 pts
 */
export function calculateBasePoints(prediction: Prediction, result: MatchResult): number {
  if (!isCorrectOutcome(prediction, result)) {
    return 0;
  }

  if (isExactScore(prediction, result)) {
    return 3;
  }

  if (isCorrectGoalDifference(prediction, result)) {
    return 2;
  }

  return 1;
}

/**
 * Check if this prediction qualifies for visionary bonus
 * (only ONE person got the exact score)
 */
export function hasVisionaryBonus(
  prediction: Prediction,
  result: MatchResult,
  allPredictions: Prediction[]
): boolean {
  if (!isExactScore(prediction, result)) {
    return false;
  }

  const exactCount = countExactScores(allPredictions, result);
  return exactCount === 1;
}

/**
 * Check if qualifier prediction is correct (knockout only)
 */
export function hasCorrectQualifier(
  prediction: Prediction,
  result: MatchResult
): boolean {
  if (!result.qualifier || !prediction.qualifier_pick) {
    return false;
  }
  return prediction.qualifier_pick === result.qualifier;
}

/**
 * Calculate full points breakdown for a prediction
 * @param isKnockout - Whether this is a knockout match (for qualifier bonus)
 */
export function calculatePoints(
  prediction: Prediction,
  result: MatchResult,
  allPredictions: Prediction[],
  homeTeam: string,
  awayTeam: string,
  isKnockout: boolean = false
): PointsBreakdown {
  const base = calculateBasePoints(prediction, result);
  const visionary = hasVisionaryBonus(prediction, result, allPredictions) ? 1 : 0;
  const qualifier = isKnockout && hasCorrectQualifier(prediction, result) ? 1 : 0;
  const total = base + visionary + qualifier;

  // Build detail string
  const details: string[] = [];

  if (base === 0) {
    details.push('Mauvais résultat');
  } else if (base === 3) {
    details.push('Score exact (+3)');
  } else if (base === 2) {
    details.push('Bon résultat + diff (+2)');
  } else {
    details.push('Bon résultat (+1)');
  }

  if (visionary) {
    details.push('Visionnaire (+1)');
  }

  if (qualifier) {
    details.push('Bon qualifié (+1)');
  } else if (isKnockout && prediction.qualifier_pick && !hasCorrectQualifier(prediction, result)) {
    details.push('Mauvais qualifié');
  }

  return {
    base,
    visionary,
    qualifier,
    total,
    detail: details.join(', '),
  };
}

/**
 * Calculate points for all predictions of a match
 * @param isKnockout - Whether this is a knockout match (for qualifier bonus)
 */
export function calculateMatchPoints(
  predictions: Prediction[],
  result: MatchResult,
  homeTeam: string,
  awayTeam: string,
  isKnockout: boolean = false
): Map<string, PointsBreakdown> {
  const results = new Map<string, PointsBreakdown>();

  for (const prediction of predictions) {
    const points = calculatePoints(prediction, result, predictions, homeTeam, awayTeam, isKnockout);
    results.set(prediction.user_id, points);
  }

  return results;
}

/**
 * Get emoji for points display
 */
export function getPointsEmoji(points: number): string {
  if (points >= 4) return '🔥';
  if (points === 3) return '🎯';
  if (points === 2) return '👍';
  if (points === 1) return '✓';
  return '❌';
}

/**
 * Format points for display
 */
export function formatPoints(breakdown: PointsBreakdown): string {
  if (breakdown.total === 0) {
    return '0 pt';
  }

  const emoji = getPointsEmoji(breakdown.total);
  return `+${breakdown.total} ${emoji}`;
}
