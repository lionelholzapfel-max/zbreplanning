/**
 * Shared constants for World Cup 2026
 * Source of truth for phases, groups, etc.
 */

// Phase values exactly as they appear in matches.json
export const PHASES = {
  GROUP_STAGE: 'PHASE DE GROUPES',
  ROUND_OF_32: 'SEIZIÈMES DE FINALE',
  ROUND_OF_16: 'HUITIÈMES DE FINALE',
  QUARTER_FINALS: 'QUARTS DE FINALE',
  SEMI_FINALS: 'DEMI-FINALES',
  THIRD_PLACE: 'MATCH POUR LA 3e PLACE',
  FINAL: 'FINALE',
} as const;

export type Phase = typeof PHASES[keyof typeof PHASES];

// All phases in order (for UI display)
export const PHASE_ORDER: Phase[] = [
  PHASES.GROUP_STAGE,
  PHASES.ROUND_OF_32,
  PHASES.ROUND_OF_16,
  PHASES.QUARTER_FINALS,
  PHASES.SEMI_FINALS,
  PHASES.THIRD_PLACE,
  PHASES.FINAL,
];

// Phase display config for UI
export const PHASE_DISPLAY: Record<Phase, { label: string; shortLabel: string; icon: string }> = {
  [PHASES.GROUP_STAGE]: { label: 'Phase de groupes', shortLabel: 'Groupes', icon: '🏟️' },
  [PHASES.ROUND_OF_32]: { label: 'Seizièmes de finale', shortLabel: '16es', icon: '⚡' },
  [PHASES.ROUND_OF_16]: { label: 'Huitièmes de finale', shortLabel: '8es', icon: '⚔️' },
  [PHASES.QUARTER_FINALS]: { label: 'Quarts de finale', shortLabel: 'Quarts', icon: '🔥' },
  [PHASES.SEMI_FINALS]: { label: 'Demi-finales', shortLabel: 'Demis', icon: '⭐' },
  [PHASES.THIRD_PLACE]: { label: 'Match pour la 3e place', shortLabel: '3e place', icon: '🥉' },
  [PHASES.FINAL]: { label: 'Finale', shortLabel: 'Finale', icon: '🏆' },
};

// Groups (12 for World Cup 2026 with 48 teams)
export const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const;
export type Group = typeof GROUPS[number];

// Check if a phase is knockout (not group stage)
export function isKnockoutPhase(phase: string): boolean {
  return phase !== PHASES.GROUP_STAGE;
}

// Get phase badge for UI
export function getPhaseBadge(phase: string): { label: string; color: string } | null {
  const display = PHASE_DISPLAY[phase as Phase];
  if (!display) return null;

  const colors: Record<Phase, string> = {
    [PHASES.GROUP_STAGE]: 'bg-blue-500/20 text-blue-400',
    [PHASES.ROUND_OF_32]: 'bg-purple-500/20 text-purple-400',
    [PHASES.ROUND_OF_16]: 'bg-indigo-500/20 text-indigo-400',
    [PHASES.QUARTER_FINALS]: 'bg-orange-500/20 text-orange-400',
    [PHASES.SEMI_FINALS]: 'bg-pink-500/20 text-pink-400',
    [PHASES.THIRD_PLACE]: 'bg-amber-500/20 text-amber-400',
    [PHASES.FINAL]: 'bg-yellow-500/20 text-yellow-400',
  };

  return {
    label: display.shortLabel,
    color: colors[phase as Phase] || 'bg-gray-500/20 text-gray-400',
  };
}
