'use client';

import { useState, useEffect, useCallback } from 'react';

interface TeamOverride {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  source: 'auto' | 'admin';
}

// Use a simple object instead of Map for better React re-render detection
type OverridesMap = Record<number, { home: string; away: string }>;

interface UseTeamOverridesReturn {
  overrides: OverridesMap;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getTeamNames: (matchId: number, defaultHome: string, defaultAway: string) => { home: string; away: string };
}

/**
 * Hook to fetch and manage knockout match team overrides
 * Replaces placeholder text (e.g., "1er Groupe A") with actual team names
 */
export function useTeamOverrides(): UseTeamOverridesReturn {
  const [overrides, setOverrides] = useState<OverridesMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverrides = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/knockout/teams');
      if (!response.ok) {
        throw new Error('Failed to fetch team overrides');
      }

      const data = await response.json();
      const newOverrides: OverridesMap = {};

      for (const override of data.overrides as TeamOverride[]) {
        newOverrides[override.matchId] = {
          home: override.homeTeam,
          away: override.awayTeam,
        };
      }

      setOverrides(newOverrides);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  /**
   * Get team names for a match, using override if available
   */
  const getTeamNames = useCallback(
    (matchId: number, defaultHome: string, defaultAway: string) => {
      const override = overrides[matchId];
      if (override) {
        return { home: override.home, away: override.away };
      }
      return { home: defaultHome, away: defaultAway };
    },
    [overrides]
  );

  return {
    overrides,
    loading,
    error,
    refresh: fetchOverrides,
    getTeamNames,
  };
}
