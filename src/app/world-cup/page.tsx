'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import matches from '@/data/matches.json';
import { useSupabase, MatchParticipation, WatchLocation } from '@/hooks/useSupabase';
import { useTeamOverrides } from '@/hooks/useTeamOverrides';
import { MEMBERS } from '@/data/members';
import { toast } from 'sonner';
import { TeamInfoButton } from '@/components/TeamFactsSheet';
import { PHASES, PHASE_DISPLAY, PHASE_ORDER, GROUPS, isKnockoutPhase, getPhaseBadge, Phase } from '@/lib/constants';
import { PageHeader, EmptyState, Spinner } from '@/components/ui';
import { CountUp } from '@/components/CountUp';
import { Lock, ExternalLink, Star } from 'lucide-react';

// Filter types
type TimeFilter = 'all' | 'today' | 'week';
type TimeSlot = 'all' | 'evening' | 'night';
type ResultsFilter = 'all' | 'last24h' | 'last10';

interface FilterState {
  time: TimeFilter;
  myTeams: boolean;
  toPredictOnly: boolean;
  timeSlot: TimeSlot;
  resultsOnly: ResultsFilter;
}

interface Match {
  id: number;
  date: string;
  dateDisplay: string;
  time: string;
  match: string;
  stadium: string;
  city: string;
  phase: string;
  group: string;
}

interface ScorePrediction {
  user_id: string;
  match_id: number;
  home_score: number;
  away_score: number;
  user?: { member_name: string; member_slug: string };
  points?: { total: number; base: number; visionary: number; detail: string } | null;
}

interface MatchPredictionState {
  myPrediction: { home_score: number; away_score: number } | null;
  allPredictions: ScorePrediction[];
  matchStarted: boolean;
  predictionLocked: boolean;
  timeUntilLock: number; // milliseconds until lock (-1 if already locked)
  result: { home_score: number; away_score: number } | null;
  totalPredictions: number;
}

// Use shared phase constants - builds array from PHASE_ORDER
const phases = PHASE_ORDER.map(phase => ({
  id: phase,
  label: PHASE_DISPLAY[phase].shortLabel,
  icon: PHASE_DISPLAY[phase].icon,
}));

const groups = [...GROUPS];

const getFlag = (country: string): string => {
  const flags: Record<string, string> = {
    'Mexique': '🇲🇽', 'Afrique du Sud': '🇿🇦', 'Corée du Sud': '🇰🇷', 'République tchèque': '🇨🇿',
    'Canada': '🇨🇦', 'Bosnie-Herzégovine': '🇧🇦', 'Qatar': '🇶🇦', 'Suisse': '🇨🇭',
    'Brésil': '🇧🇷', 'Maroc': '🇲🇦', 'Haïti': '🇭🇹', 'Écosse': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    'Allemagne': '🇩🇪', 'Japon': '🇯🇵', 'Honduras': '🇭🇳', 'Turquie': '🇹🇷',
    'Argentine': '🇦🇷', 'Ouganda': '🇺🇬', 'Australie': '🇦🇺', 'Bahreïn': '🇧🇭',
    'France': '🇫🇷', 'Colombie': '🇨🇴', 'Panama': '🇵🇦', 'Nouvelle-Zélande': '🇳🇿',
    'Espagne': '🇪🇸', 'Pays-Bas': '🇳🇱', 'Équateur': '🇪🇨', 'Corée du Nord': '🇰🇵',
    'Angleterre': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Pologne': '🇵🇱', 'Sénégal': '🇸🇳', 'Slovénie': '🇸🇮',
    'Belgique': '🇧🇪', 'Croatie': '🇭🇷', 'Grèce': '🇬🇷', 'Ukraine': '🇺🇦',
    'Portugal': '🇵🇹', 'Italie': '🇮🇹', 'Irlande': '🇮🇪', 'Égypte': '🇪🇬',
    'USA': '🇺🇸', 'États-Unis': '🇺🇸', 'Chili': '🇨🇱', 'Arabie Saoudite': '🇸🇦',
    'Uruguay': '🇺🇾', 'Nigeria': '🇳🇬', 'Pérou': '🇵🇪', 'Tunisie': '🇹🇳',
    'Suède': '🇸🇪', 'Paraguay': '🇵🇾', 'Côte d\'Ivoire': '🇨🇮', 'Norvège': '🇳🇴',
    'RD Congo': '🇨🇩', 'Congo': '🇨🇩', 'Algérie': '🇩🇿', 'Autriche': '🇦🇹',
    'Cap-Vert': '🇨🇻', 'Ghana': '🇬🇭', 'Iran': '🇮🇷', 'Irak': '🇮🇶',
    'Jordanie': '🇯🇴', 'Ouzbékistan': '🇺🇿', 'Curaçao': '🇨🇼',
    'Vainqueur': '🎯', 'Perdant': '❌',
  };
  for (const [key, flag] of Object.entries(flags)) {
    if (country.includes(key)) return flag;
  }
  return '⚽';
};

const parseMatch = (matchStr: string) => {
  const parts = matchStr.split(' - ');
  if (parts.length === 2) {
    return { team1: parts[0].trim(), team2: parts[1].trim() };
  }
  return { team1: matchStr, team2: '' };
};

// Determine the current phase based on today's date
// Prioritize knockout phases over group stage when both have matches today
const getCurrentPhase = (): Phase => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Get all matches happening today or in the future
  const upcomingMatches = (matches as Match[]).filter(m => {
    const [year, month, day] = m.date.split('-').map(Number);
    const matchDate = new Date(year, month - 1, day);
    return matchDate >= today;
  });

  if (upcomingMatches.length === 0) {
    return PHASES.FINAL;
  }

  // Check if there are knockout matches today or upcoming
  // Prioritize knockout over group stage
  const knockoutMatch = upcomingMatches.find(m => m.phase !== PHASES.GROUP_STAGE);
  if (knockoutMatch) {
    return knockoutMatch.phase as Phase;
  }

  // Otherwise return group stage
  return PHASES.GROUP_STAGE;
};

export default function WorldCupPage() {
  const router = useRouter();
  const { currentUser, loading: userLoading, getMatchParticipations, getMatchParticipationsBatch, setMatchParticipation, getWatchLocations, getWatchLocationsBatch, addWatchLocation, toggleVoteLocation } = useSupabase();
  const { getTeamNames } = useTeamOverrides();

  const [selectedPhase, setSelectedPhase] = useState<Phase>(PHASES.ROUND_OF_32);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [participations, setParticipations] = useState<Record<number, MatchParticipation[]>>({});
  const [locations, setLocations] = useState<Record<number, WatchLocation[]>>({});
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);
  const [newLocation, setNewLocation] = useState('');
  const [mounted, setMounted] = useState(false);
  const [loadingMatch, setLoadingMatch] = useState<number | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Score predictions state
  const [scorePredictions, setScorePredictions] = useState<Record<number, MatchPredictionState>>({});
  const [editingScore, setEditingScore] = useState<{ matchId: number; home: string; away: string } | null>(null);
  const [savingScore, setSavingScore] = useState<number | null>(null);
  const [justSavedId, setJustSavedId] = useState<number | null>(null);
  const [shakeId, setShakeId] = useState<number | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Favorites state
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loadingFavorite, setLoadingFavorite] = useState<string | null>(null);

  // Filter state (persisted in localStorage)
  const [filters, setFilters] = useState<FilterState>({
    time: 'all',
    myTeams: false,
    toPredictOnly: false,
    timeSlot: 'all',
    resultsOnly: 'all',
  });

  // Helper to parse match datetime
  const getMatchDateTime = useCallback((match: Match): Date => {
    // Parse date like "2026-06-11" (YYYY-MM-DD) and time like "21:00"
    const [year, month, day] = match.date.split('-').map(Number);
    const [hours, minutes] = match.time.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes);
  }, []);

  // Check if match is today
  const isMatchToday = useCallback((match: Match): boolean => {
    const now = new Date();
    const kickoff = getMatchDateTime(match);
    return now.toDateString() === kickoff.toDateString();
  }, [getMatchDateTime]);

  // Check if match is in Auvio window (30min before to 2h30 after kickoff)
  const isInAuvioWindow = useCallback((match: Match): boolean => {
    const now = new Date();
    const kickoff = getMatchDateTime(match);
    const windowStart = new Date(kickoff.getTime() - 30 * 60 * 1000); // 30 min before
    const windowEnd = new Date(kickoff.getTime() + 150 * 60 * 1000); // 2h30 after
    return now >= windowStart && now <= windowEnd;
  }, [getMatchDateTime]);

  // Get the first participant (by created_at) who said yes
  const getFirstYesParticipant = useCallback((matchId: number): string | null => {
    const parts = participations[matchId]?.filter(p => p.status === 'yes') || [];
    if (parts.length === 0) return null;
    // Sort by created_at and return the first one
    const sorted = [...parts].sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateA - dateB;
    });
    return sorted[0]?.user_id || null;
  }, [participations]);

  // Helper to check if match is in time range
  const isMatchInTimeRange = useCallback((match: Match, range: TimeFilter): boolean => {
    if (range === 'all') return true;
    const matchDate = getMatchDateTime(match);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    if (range === 'today') {
      return matchDate >= todayStart && matchDate < todayEnd;
    }
    if (range === 'week') {
      return matchDate >= todayStart && matchDate < weekEnd;
    }
    return true;
  }, [getMatchDateTime]);

  // Helper to check time slot (based on actual World Cup 2026 schedule)
  // Evening: 18:00-23:59 (Belgian time)
  // Night: 00:00-06:59 (Belgian time - North American afternoon/evening matches)
  const isMatchInTimeSlot = useCallback((match: Match, slot: TimeSlot): boolean => {
    if (slot === 'all') return true;
    const [hours] = match.time.split(':').map(Number);
    if (slot === 'evening') return hours >= 18 && hours <= 23;
    if (slot === 'night') return hours >= 0 && hours < 7;
    return true;
  }, []);

  // Count matches to predict (for chip counter)
  // Excludes locked matches (2h before kickoff) - you can no longer predict
  const toPredictCount = useMemo(() => {
    return (matches as Match[]).filter(m => {
      const predState = scorePredictions[m.id];
      const isLocked = predState?.predictionLocked ?? false;
      const hasNoPrediction = !predState?.myPrediction;
      // Only count if not locked and has no prediction
      return !isLocked && hasNoPrediction;
    }).length;
  }, [scorePredictions]);

  // Count matches by time slot
  const timeSlotCounts = useMemo(() => {
    return (matches as Match[]).reduce((acc, m) => {
      const [hours] = m.time.split(':').map(Number);
      if (hours >= 18 && hours <= 23) acc.evening++;
      else if (hours >= 0 && hours < 7) acc.night++;
      return acc;
    }, { evening: 0, night: 0 });
  }, []);

  // Get matches with results (for results filter)
  const matchesWithResults = useMemo(() => {
    return (matches as Match[])
      .filter(m => {
        const predState = scorePredictions[m.id];
        return predState?.result !== null && predState?.result !== undefined;
      })
      .sort((a, b) => {
        // Sort by date descending (most recent first)
        const dateA = getMatchDateTime(a);
        const dateB = getMatchDateTime(b);
        return dateB.getTime() - dateA.getTime();
      });
  }, [scorePredictions, getMatchDateTime]);

  // Count of matches with results
  const resultsCount = matchesWithResults.length;

  // Get match IDs for last 24h or last 10 results
  const getResultsFilterMatchIds = useCallback((filter: ResultsFilter): Set<number> => {
    if (filter === 'all') return new Set();

    const now = new Date();
    const last24hStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    if (filter === 'last24h') {
      return new Set(
        matchesWithResults
          .filter(m => getMatchDateTime(m) >= last24hStart)
          .map(m => m.id)
      );
    }

    if (filter === 'last10') {
      return new Set(matchesWithResults.slice(0, 10).map(m => m.id));
    }

    return new Set();
  }, [matchesWithResults, getMatchDateTime]);

  const filteredMatches = useMemo(() => {
    const now = new Date();

    let result = (matches as Match[]).filter(m => {
      // Phase filter - exact match only (phases are unique values from constants)
      const phaseMatch = m.phase === selectedPhase;

      const groupMatch = !selectedGroup || m.group === `GROUPE ${selectedGroup}`;

      // Time filter
      const timeMatch = isMatchInTimeRange(m, filters.time);

      // Time slot filter
      const timeSlotMatch = isMatchInTimeSlot(m, filters.timeSlot);

      // My teams filter
      let myTeamsMatch = true;
      if (filters.myTeams && favorites.length > 0) {
        const { team1, team2 } = parseMatch(m.match);
        myTeamsMatch = favorites.includes(team1) || favorites.includes(team2);
      } else if (filters.myTeams && favorites.length === 0) {
        myTeamsMatch = false; // No favorites = no matches
      }

      // To predict filter - excludes locked matches (2h before kickoff)
      let toPredictMatch = true;
      if (filters.toPredictOnly) {
        const predState = scorePredictions[m.id];
        const isLocked = predState?.predictionLocked ?? false;
        const hasNoPrediction = !predState?.myPrediction;
        // Only show if not locked and has no prediction
        toPredictMatch = !isLocked && hasNoPrediction;
      }

      // Results filter - show only matches with results
      let resultsMatch = true;
      if (filters.resultsOnly !== 'all') {
        const resultsMatchIds = getResultsFilterMatchIds(filters.resultsOnly);
        resultsMatch = resultsMatchIds.has(m.id);
      }

      return phaseMatch && groupMatch && timeMatch && timeSlotMatch && myTeamsMatch && toPredictMatch && resultsMatch;
    });

    // Sort by date/time
    result.sort((a, b) => {
      const dateA = getMatchDateTime(a);
      const dateB = getMatchDateTime(b);
      // If results filter is active, sort by most recent first
      if (filters.resultsOnly !== 'all') {
        return dateB.getTime() - dateA.getTime();
      }
      // Otherwise, sort by next match first
      return dateA.getTime() - dateB.getTime();
    });

    return result;
  }, [selectedPhase, selectedGroup, filters, favorites, scorePredictions, getMatchDateTime, isMatchInTimeRange, isMatchInTimeSlot, getResultsFilterMatchIds]);

  // Load data for visible matches
  const loadMatchData = useCallback(async (matchIds: number[]) => {
    // Two batched queries for ALL matches instead of two per match (was 2×N requests).
    const [partsMap, locsMap] = await Promise.all([
      getMatchParticipationsBatch(matchIds),
      getWatchLocationsBatch(matchIds),
    ]);

    const newParticipations: Record<number, MatchParticipation[]> = {};
    const newLocations: Record<number, WatchLocation[]> = {};
    for (const id of matchIds) {
      newParticipations[id] = partsMap[id] || [];
      newLocations[id] = locsMap[id] || [];
    }

    setParticipations(prev => ({ ...prev, ...newParticipations }));
    setLocations(prev => ({ ...prev, ...newLocations }));
  }, [getMatchParticipationsBatch, getWatchLocationsBatch]);

  // Track which matches failed to load (for retry)
  const failedMatchIdsRef = useRef<Set<number>>(new Set());

  // Load a single batch of predictions (max 100 matches)
  const loadPredictionBatch = useCallback(async (matchIds: number[]): Promise<Record<number, MatchPredictionState>> => {
    const res = await fetch('/api/predictions/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ match_ids: matchIds }),
    });

    if (!res.ok) throw new Error('Batch fetch failed');

    const data = await res.json();
    const predictions: Record<number, MatchPredictionState> = {};

    for (const [matchIdStr, pred] of Object.entries(data.predictions || {})) {
      const matchId = parseInt(matchIdStr, 10);
      const p = pred as {
        myPrediction: { home_score: number; away_score: number } | null;
        allPredictions: ScorePrediction[];
        matchStarted: boolean;
        predictionLocked: boolean;
        timeUntilLock: number;
        result: { home_score: number; away_score: number } | null;
        totalPredictions: number;
      };

      predictions[matchId] = {
        myPrediction: p.myPrediction || null,
        allPredictions: p.allPredictions || [],
        matchStarted: p.matchStarted,
        predictionLocked: p.predictionLocked,
        timeUntilLock: p.timeUntilLock ?? -1,
        result: p.result || null,
        totalPredictions: p.totalPredictions || 0,
      };
    }

    return predictions;
  }, []);

  // Load score predictions for matches (splits into batches of 100 if needed)
  const loadScorePredictions = useCallback(async (matchIds: number[]) => {
    if (matchIds.length === 0) return;

    const BATCH_SIZE = 100;
    const allNewPredictions: Record<number, MatchPredictionState> = {};

    try {
      // Split into batches of 100 and load in parallel
      const batches: number[][] = [];
      for (let i = 0; i < matchIds.length; i += BATCH_SIZE) {
        batches.push(matchIds.slice(i, i + BATCH_SIZE));
      }

      const results = await Promise.all(batches.map(batch => loadPredictionBatch(batch)));

      // Merge all batch results
      for (const batchResult of results) {
        Object.assign(allNewPredictions, batchResult);
      }

      // Remove successfully loaded matches from failed set
      Object.keys(allNewPredictions).forEach(id => failedMatchIdsRef.current.delete(parseInt(id, 10)));

      // Update state
      setScorePredictions(prev => {
        const result = { ...prev };
        for (const [matchIdStr, newData] of Object.entries(allNewPredictions)) {
          const matchId = parseInt(matchIdStr, 10);
          const existing = result[matchId];

          // If we have an optimistic myPrediction that server doesn't have yet, preserve it
          if (existing?.myPrediction && !newData.myPrediction) {
            result[matchId] = { ...newData, myPrediction: existing.myPrediction };
          } else {
            result[matchId] = newData;
          }
        }
        return result;
      });
    } catch {
      // Mark as failed for potential retry
      matchIds.forEach(id => failedMatchIdsRef.current.add(id));
    }
  }, [loadPredictionBatch]);

  // Save score prediction
  const saveScorePrediction = useCallback(async (matchId: number, homeScore: number, awayScore: number) => {
    setSavingScore(matchId);
    try {
      const res = await fetch('/api/predictions/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: matchId, home_score: homeScore, away_score: awayScore }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de l\'enregistrement');
        setShakeId(matchId);
        setTimeout(() => setShakeId(null), 220);
        return false;
      }

      toast.success('Pronostic enregistré');
      setJustSavedId(matchId);
      setTimeout(() => setJustSavedId(null), 400);

      // Update local state
      setScorePredictions(prev => ({
        ...prev,
        [matchId]: {
          ...prev[matchId],
          myPrediction: { home_score: homeScore, away_score: awayScore },
          totalPredictions: (prev[matchId]?.totalPredictions || 0) + (prev[matchId]?.myPrediction ? 0 : 1),
        },
      }));

      return true;
    } catch {
      toast.error('Erreur lors de l\'enregistrement');
      setShakeId(matchId);
      setTimeout(() => setShakeId(null), 220);
      return false;
    } finally {
      setSavingScore(null);
      setEditingScore(null);
    }
  }, []);

  // Load user favorites
  const loadFavorites = useCallback(async () => {
    try {
      const res = await fetch('/api/favorites');
      if (res.ok) {
        const data = await res.json();
        setFavorites(data.favorites || []);
      }
    } catch {
      // Silently fail
    }
  }, []);

  // Toggle favorite team
  const toggleFavorite = useCallback(async (teamCode: string) => {
    setLoadingFavorite(teamCode);
    // Optimistic update
    const wasFavorite = favorites.includes(teamCode);
    setFavorites(prev => wasFavorite ? prev.filter(t => t !== teamCode) : [...prev, teamCode]);

    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_code: teamCode }),
      });

      if (!res.ok) {
        // Revert on error
        setFavorites(prev => wasFavorite ? [...prev, teamCode] : prev.filter(t => t !== teamCode));
        toast.error('Erreur lors de la mise à jour');
      } else {
        toast.success(wasFavorite ? 'Équipe retirée' : 'Équipe ajoutée aux favoris');
      }
    } catch {
      // Revert on error
      setFavorites(prev => wasFavorite ? [...prev, teamCode] : prev.filter(t => t !== teamCode));
      toast.error('Erreur réseau');
    } finally {
      setLoadingFavorite(null);
    }
  }, [favorites]);

  // Handle score input change with debounced auto-save
  const handleScoreChange = useCallback((matchId: number, field: 'home' | 'away', value: string) => {
    // Only allow numbers 0-15
    if (value !== '' && (!/^\d+$/.test(value) || parseInt(value, 10) > 15)) return;

    setEditingScore(prev => {
      if (!prev || prev.matchId !== matchId) {
        const existing = scorePredictions[matchId]?.myPrediction;
        return {
          matchId,
          home: field === 'home' ? value : (existing?.home_score?.toString() || ''),
          away: field === 'away' ? value : (existing?.away_score?.toString() || ''),
        };
      }
      return { ...prev, [field]: value };
    });

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Auto-save after 1 second of no changes
    saveTimeoutRef.current = setTimeout(() => {
      setEditingScore(current => {
        if (current && current.matchId === matchId && current.home !== '' && current.away !== '') {
          saveScorePrediction(matchId, parseInt(current.home, 10), parseInt(current.away, 10));
        }
        return current;
      });
    }, 1000);
  }, [scorePredictions, saveScorePrediction]);

  // Save immediately on blur (when user leaves the input)
  const handleScoreBlur = useCallback((matchId: number) => {
    // Clear debounce timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setEditingScore(current => {
      if (current && current.matchId === matchId && current.home !== '' && current.away !== '') {
        saveScorePrediction(matchId, parseInt(current.home, 10), parseInt(current.away, 10));
      }
      return current;
    });
  }, [saveScorePrediction]);

  useEffect(() => {
    if (!userLoading && !currentUser) {
      router.push('/login');
    }
  }, [userLoading, currentUser, router]);

  useEffect(() => {
    setMounted(true);
    // Auto-select current phase on mount (client-side)
    setSelectedPhase(getCurrentPhase());
  }, []);

  // Track which matches we've already loaded predictions for to avoid infinite loops
  const loadedMatchIdsRef = useRef<Set<number>>(new Set());
  const loadingMatchIdsRef = useRef<Set<number>>(new Set());

  // Load data + predictions for any visible matches not yet loaded.
  const loadAll = useCallback(async () => {
    if (!currentUser || filteredMatches.length === 0) return;

    // Only load data for matches we haven't loaded yet AND aren't currently loading
    const newMatchIds = filteredMatches
      .map(m => m.id)
      .filter(id => !loadedMatchIdsRef.current.has(id) && !loadingMatchIdsRef.current.has(id));

    if (newMatchIds.length === 0) return;

    // Mark as "loading" (not "loaded" yet)
    newMatchIds.forEach(id => loadingMatchIdsRef.current.add(id));

    setLoadError(false);
    try {
      await Promise.all([
        loadMatchData(newMatchIds),
        loadScorePredictions(newMatchIds),
      ]);
      // Only mark as loaded AFTER successful fetch
      newMatchIds.forEach(id => {
        loadedMatchIdsRef.current.add(id);
        loadingMatchIdsRef.current.delete(id);
      });
    } catch {
      // On failure, remove from loading so they can be retried
      newMatchIds.forEach(id => loadingMatchIdsRef.current.delete(id));
      setLoadError(true);
    }
  }, [currentUser, filteredMatches, loadMatchData, loadScorePredictions]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Load favorites when user is available
  useEffect(() => {
    if (currentUser) {
      loadFavorites();
    }
  }, [currentUser, loadFavorites]);

  // Load filters from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('worldcup-filters');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setFilters(prev => ({ ...prev, ...parsed }));
      } catch {
        // Ignore invalid JSON
      }
    }
  }, []);

  // Persist filters to localStorage
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('worldcup-filters', JSON.stringify(filters));
    }
  }, [filters, mounted]);

  const handleParticipation = async (matchId: number, status: 'yes' | 'no' | 'maybe') => {
    if (!currentUser) return;
    setLoadingMatch(matchId);

    // Get current yes count before update
    const prevYesCount = participations[matchId]?.filter(p => p.status === 'yes').length || 0;

    // Optimistic update - show change immediately
    setParticipations(prev => {
      const existing = prev[matchId] || [];
      const myExisting = existing.find(p => p.user_id === currentUser.id);
      if (myExisting) {
        // Update existing participation
        return {
          ...prev,
          [matchId]: existing.map(p =>
            p.user_id === currentUser.id ? { ...p, status } : p
          ),
        };
      } else {
        // Add new participation
        return {
          ...prev,
          [matchId]: [...existing, {
            id: `temp-${Date.now()}`,
            user_id: currentUser.id,
            match_id: matchId,
            status,
            users: { member_name: currentUser.member_name, member_slug: currentUser.member_slug },
          }],
        };
      }
    });

    // Actually save to DB
    await setMatchParticipation(matchId, status);
    // Refresh from server to get accurate data
    const parts = await getMatchParticipations(matchId);
    setParticipations(prev => ({ ...prev, [matchId]: parts }));

    // Check if we just hit 5 "yes" with this action
    const newYesCount = parts.filter(p => p.status === 'yes').length;
    if (status === 'yes' && prevYesCount < 5 && newYesCount >= 5) {
      toast.success('Match confirmé');
    }

    setLoadingMatch(null);
  };

  const handleProposeLocation = async (matchId: number) => {
    if (!currentUser || !newLocation.trim()) return;

    await addWatchLocation(matchId, newLocation.trim());
    const locs = await getWatchLocations(matchId);
    setLocations(prev => ({ ...prev, [matchId]: locs }));
    setNewLocation('');
  };

  const handleVoteLocation = async (locationId: string, matchId: number, currentVotes: string[]) => {
    if (!currentUser) return;

    await toggleVoteLocation(locationId, currentVotes, matchId);
    const locs = await getWatchLocations(matchId);
    setLocations(prev => ({ ...prev, [matchId]: locs }));
  };

  const getMyStatus = (matchId: number) => {
    if (!currentUser) return null;
    return participations[matchId]?.find(p => p.user_id === currentUser.id)?.status;
  };

  const getParticipantCount = (matchId: number, status: 'yes' | 'no' | 'maybe') => {
    return participations[matchId]?.filter(p => p.status === status).length || 0;
  };

  // Calculate days until World Cup only on client to avoid hydration mismatch
  const daysUntil = useMemo(() => {
    if (!mounted) return null; // Return null on server to avoid hydration mismatch
    const worldCupStart = new Date('2026-06-11');
    const today = new Date();
    return Math.ceil((worldCupStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }, [mounted]);

  // Format today's date only on client
  const todayFormatted = useMemo(() => {
    if (!mounted) return '';
    return new Date().toLocaleDateString('fr-FR');
  }, [mounted]);

  const weekEndFormatted = useMemo(() => {
    if (!mounted) return '';
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('fr-FR');
  }, [mounted]);

  // Show loading spinner while validating session
  if (userLoading) {
    return (
      <div className="min-h-screen bg-[var(--canvas)] flex items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  // Only redirect after loading completes and no user found
  if (!currentUser) return null;

  // Filter-bar chip style.
  const chip = (active: boolean) =>
    `shrink-0 inline-flex items-center gap-1.5 h-10 sm:h-8 px-3 rounded-full text-[12px] transition-colors ${
      active
        ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
        : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
    }`;
  // The single strong CTA of the page: the soonest match not yet predicted (and still open).
  const strongCtaMatchId = filteredMatches.find((m) => {
    const ps = scorePredictions[m.id];
    return !ps?.result && !ps?.predictionLocked && !ps?.myPrediction;
  })?.id ?? null;

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <Navbar />

      {/* Header */}
      <section className="max-w-7xl mx-auto px-4 pt-8">
        <PageHeader
          title="Coupe du Monde"
          subtitle="USA · Mexique · Canada — 104 matchs"
          action={mounted && daysUntil !== null && daysUntil > 0 ? (
            <div className="text-right shrink-0">
              <span className="score text-[28px] text-[var(--accent)]">J−{daysUntil}</span>
              <p className="eyebrow mt-1">avant le coup d&apos;envoi</p>
            </div>
          ) : undefined}
        />

        {loadError && (
          <div className="flex items-center justify-between gap-3 rounded-[10px] bg-[var(--surface-2)] border border-[var(--danger)]/30 px-4 py-3 mb-4">
            <p className="text-[13px] text-[var(--text-secondary)]">Impossible de charger les matchs — vérifie ta connexion.</p>
            <button onClick={() => loadAll()} className="shrink-0 h-8 px-3 rounded-[8px] bg-[var(--surface-3)] text-[13px] text-[var(--text-primary)] hover:bg-[var(--surface-4)] transition-colors">Réessayer</button>
          </div>
        )}
      </section>

      {/* Phase filters — segmented */}
      <section className="max-w-7xl mx-auto px-4 pt-6">
        <div className="flex justify-start sm:justify-center">
          <div className="inline-flex max-w-full overflow-x-auto scrollbar-hide rounded-[8px] bg-[var(--surface-2)] p-0.5">
            {phases.map(phase => (
              <button
                key={phase.id}
                onClick={() => {
                  setSelectedPhase(phase.id);
                  if (phase.id !== 'PHASE DE GROUPES') setSelectedGroup(null);
                }}
                className={`shrink-0 px-3 py-2.5 sm:py-1.5 rounded-[6px] text-[13px] whitespace-nowrap transition-colors ${
                  selectedPhase === phase.id
                    ? 'bg-[var(--surface-3)] top-light text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {phase.label}
              </button>
            ))}
          </div>
        </div>

        {selectedPhase === 'PHASE DE GROUPES' && (
          <div className="flex flex-wrap justify-center gap-1.5 mt-3">
            <button
              onClick={() => setSelectedGroup(null)}
              className={`h-11 sm:h-9 px-3 rounded-[6px] text-[13px] transition-colors ${
                !selectedGroup ? 'bg-[var(--surface-3)] top-light text-[var(--text-primary)]' : 'bg-[var(--surface-2)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Tous
            </button>
            {groups.map(group => (
              <button
                key={group}
                onClick={() => setSelectedGroup(group)}
                className={`w-11 h-11 sm:w-9 sm:h-9 rounded-[6px] text-[13px] transition-colors ${
                  selectedGroup === group ? 'bg-[var(--surface-3)] top-light text-[var(--text-primary)]' : 'bg-[var(--surface-2)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {group}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Sticky filter bar — one row of chips */}
      <section data-shot="filters" className="sticky top-14 z-30 bg-[var(--canvas)]/95 backdrop-blur-sm border-b border-[var(--hairline)] py-2.5 px-4 mt-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            <button onClick={() => setFilters(f => ({ ...f, time: 'today' }))} className={chip(filters.time === 'today')} title={mounted ? `Matchs du ${todayFormatted}` : undefined}>Aujourd&apos;hui</button>
            <button onClick={() => setFilters(f => ({ ...f, time: 'week' }))} className={chip(filters.time === 'week')} title={mounted ? `Du ${todayFormatted} au ${weekEndFormatted}` : undefined}>Cette semaine</button>
            <button onClick={() => setFilters(f => ({ ...f, time: 'all' }))} className={chip(filters.time === 'all')}>Tous</button>

            <button onClick={() => setFilters(f => ({ ...f, myTeams: !f.myTeams }))} className={chip(filters.myTeams)}>
              Mes équipes{favorites.length > 0 && <span className="opacity-70">{favorites.length}</span>}
            </button>
            <button onClick={() => setFilters(f => ({ ...f, toPredictOnly: !f.toPredictOnly }))} className={chip(filters.toPredictOnly)}>
              À pronostiquer{toPredictCount > 0 && <span className="opacity-70">{toPredictCount}</span>}
            </button>

            <button onClick={() => setFilters(f => ({ ...f, timeSlot: f.timeSlot === 'evening' ? 'all' : 'evening' }))} className={chip(filters.timeSlot === 'evening')}>
              Soirée<span className="opacity-70">{timeSlotCounts.evening}</span>
            </button>
            <button onClick={() => setFilters(f => ({ ...f, timeSlot: f.timeSlot === 'night' ? 'all' : 'night' }))} className={chip(filters.timeSlot === 'night')}>
              Nuit<span className="opacity-70">{timeSlotCounts.night}</span>
            </button>

            {resultsCount > 0 && (
              <>
                <button onClick={() => setFilters(f => ({ ...f, resultsOnly: f.resultsOnly === 'last24h' ? 'all' : 'last24h' }))} className={chip(filters.resultsOnly === 'last24h')}>Résultats 24h</button>
                <button onClick={() => setFilters(f => ({ ...f, resultsOnly: f.resultsOnly === 'last10' ? 'all' : 'last10' }))} className={chip(filters.resultsOnly === 'last10')}>10 derniers</button>
              </>
            )}
          </div>

          {(filters.time !== 'all' || filters.myTeams || filters.toPredictOnly || filters.timeSlot !== 'all' || filters.resultsOnly !== 'all') && (
            <div className="flex items-center justify-between mt-2 text-[12px]">
              <span className="text-[var(--text-tertiary)]">
                {filteredMatches.length} match{filteredMatches.length > 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setFilters({ time: 'all', myTeams: false, toPredictOnly: false, timeSlot: 'all', resultsOnly: 'all' })}
                className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
              >
                Réinitialiser
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Matches */}
      <section className="max-w-7xl mx-auto px-4 pb-12">
        <div key={selectedPhase + '-' + (selectedGroup ?? 'all')} className="space-y-3 animate-view-enter">
          {filteredMatches.map((match, index) => {
            // Day separator logic
            const prevMatch = index > 0 ? filteredMatches[index - 1] : null;
            const showDaySeparator = !prevMatch || prevMatch.date !== match.date;
            const myStatus = getMyStatus(match.id);
            const yesCount = getParticipantCount(match.id, 'yes');
            const maybeCount = getParticipantCount(match.id, 'maybe');
            const isExpanded = expandedMatch === match.id;
            const matchLocations = locations[match.id] || [];
            const matchParticipants = participations[match.id] || [];
            // Parse default teams from match string, then check for overrides (for knockout matches)
            const defaultTeams = parseMatch(match.match);
            const resolvedTeams = getTeamNames(match.id, defaultTeams.team1, defaultTeams.team2);
            const team1 = resolvedTeams.home;
            const team2 = resolvedTeams.away;
            const isLoading = loadingMatch === match.id;

            // Score prediction state
            const predState = scorePredictions[match.id];
            const isLocked = predState?.predictionLocked || false;
            const hasResult = !!predState?.result;
            const myPrediction = predState?.myPrediction;
            const editingThis = editingScore?.matchId === match.id;
            const currentHome = editingThis ? editingScore.home : (myPrediction?.home_score?.toString() || '');
            const currentAway = editingThis ? editingScore.away : (myPrediction?.away_score?.toString() || '');
            const isSaving = savingScore === match.id;

            // Lock countdown - show "dans Xh Ym" (with Lock icon) if less than 6h until lock
            const timeUntilLock = predState?.timeUntilLock ?? -1;
            const sixHoursMs = 6 * 60 * 60 * 1000;
            const showLockCountdown = !isLocked && timeUntilLock > 0 && timeUntilLock < sixHoursMs;
            const lockCountdownText = showLockCountdown ? (() => {
              const hours = Math.floor(timeUntilLock / (60 * 60 * 1000));
              const minutes = Math.floor((timeUntilLock % (60 * 60 * 1000)) / (60 * 1000));
              return hours > 0 ? `dans ${hours}h ${minutes}m` : `dans ${minutes}m`;
            })() : null;

            // Get my points if result exists
            const myPoints = hasResult && predState?.allPredictions
              ? predState.allPredictions.find(p => p.user_id === currentUser?.id)?.points
              : null;

            // Live: between kickoff and +2h30, with no final result yet
            const kickoffMs = getMatchDateTime(match).getTime();
            const isLive = !hasResult && Date.now() >= kickoffMs && Date.now() < kickoffMs + 2.5 * 60 * 60 * 1000;

            return (
              <div key={match.id}>
                {/* Day separator */}
                {showDaySeparator && (
                  <div className={`flex items-center gap-3 ${index > 0 ? 'pt-8' : 'pt-2'} pb-3`}>
                    <span className="eyebrow">{match.dateDisplay}</span>
                    <div className="flex-1 h-px bg-[var(--hairline)]" />
                  </div>
                )}

                <div
                  data-shot={hasResult ? 'match-done' : isLive ? 'match-live' : (!isLocked ? 'match-open' : undefined)}
                  className={`rounded-[10px] bg-[var(--surface-1)] top-light transition-all duration-300 ${
                    mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                  } ${isLive ? 'ring-1 ring-[var(--live)]/40' : ''} ${justSavedId === match.id ? 'animate-accent-flash' : ''}`}
                  style={{ transitionDelay: `${Math.min(index, 20) * 30}ms` }}
                >
                  <div className="relative p-4 sm:p-5">
                    {/* Row 1 — time / place + status */}
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="score text-[13px] text-[var(--text-tertiary)]">{match.time}</span>
                        <span className="hidden sm:inline text-[12px] text-[var(--text-tertiary)] truncate">· {match.city}</span>
                        {match.group ? (
                          <span className="eyebrow hidden sm:inline">{match.group}</span>
                        ) : (() => {
                          const badge = getPhaseBadge(match.phase);
                          return badge ? <span className="eyebrow hidden sm:inline">{badge.label}</span> : null;
                        })()}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isLive && (
                          <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-[var(--live)]">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-live absolute inline-flex h-full w-full rounded-full bg-[var(--live)]" />
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--live)]" />
                            </span>
                            Live
                          </span>
                        )}
                        {hasResult && <span className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">Terminé</span>}
                        {showLockCountdown && !isLocked && !hasResult && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
                            <Lock className="w-3.5 h-3.5" />{lockCountdownText}
                          </span>
                        )}
                        {isLocked && !hasResult && <Lock className="w-3.5 h-3.5 text-[var(--text-tertiary)]" strokeWidth={1.75} />}
                      </div>
                    </div>

                    {/* Row 2 — teams + score */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-[17px] sm:text-[20px] shrink-0">{getFlag(team1)}</span>
                        <span className="text-[14px] sm:text-[15px] font-medium text-[var(--text-primary)] truncate">{team1}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(team1); }}
                          disabled={loadingFavorite === team1}
                          className={`shrink-0 p-1.5 -m-0.5 sm:p-2.5 sm:-m-1 transition-colors ${favorites.includes(team1) ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
                          aria-label="Favori"
                        >
                          <Star className="w-3.5 h-3.5" strokeWidth={1.75} fill={favorites.includes(team1) ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                      <div className="shrink-0 px-2">
                        {hasResult ? (
                          <span className="score text-[28px] text-[var(--text-primary)] whitespace-nowrap">
                            {predState.result?.home_score}<span className="text-[var(--text-tertiary)] mx-1.5">:</span>{predState.result?.away_score}
                          </span>
                        ) : (
                          <span className="score text-[28px] text-[var(--text-tertiary)]">—</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(team2); }}
                          disabled={loadingFavorite === team2}
                          className={`shrink-0 p-1.5 -m-0.5 sm:p-2.5 sm:-m-1 transition-colors ${favorites.includes(team2) ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
                          aria-label="Favori"
                        >
                          <Star className="w-3.5 h-3.5" strokeWidth={1.75} fill={favorites.includes(team2) ? 'currentColor' : 'none'} />
                        </button>
                        <span className="text-[14px] sm:text-[15px] font-medium text-[var(--text-primary)] truncate text-right">{team2}</span>
                        <span className="text-[17px] sm:text-[20px] shrink-0">{getFlag(team2)}</span>
                      </div>
                    </div>

                    {/* Row 3 — my prediction / score input (the signature moment) */}
                    <div className="mt-4">
                      {hasResult ? (
                        myPrediction ? (
                          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-2)] px-3 py-1.5">
                            <span className="text-[12px] text-[var(--text-tertiary)]">Ton prono</span>
                            <span className="score text-[13px] text-[var(--text-secondary)]">{myPrediction.home_score}-{myPrediction.away_score}</span>
                            {myPoints && (
                              <span className={`score text-[13px] ${myPoints.total > 0 ? 'text-[var(--accent)]' : myPoints.total < 0 ? 'text-[var(--danger)]' : 'text-[var(--text-tertiary)]'}`}>
                                {myPoints.total > 0 ? `+${myPoints.total}` : myPoints.total} pt{Math.abs(myPoints.total) > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[12px] text-[var(--text-tertiary)]">Pas de prono enregistré</span>
                        )
                      ) : isLocked ? (
                        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--surface-2)] px-3 py-1.5 opacity-50">
                          <Lock className="w-3 h-3 text-[var(--text-tertiary)]" strokeWidth={1.75} />
                          {myPrediction ? (
                            <>
                              <span className="text-[12px] text-[var(--text-tertiary)]">Ton prono</span>
                              <span className="score text-[13px] text-[var(--text-secondary)]">{myPrediction.home_score}-{myPrediction.away_score}</span>
                            </>
                          ) : (
                            <span className="text-[12px] text-[var(--text-tertiary)]">Pas de prono</span>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className={`flex items-center gap-2 ${shakeId === match.id ? 'animate-shake' : ''}`}>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={currentHome}
                              onChange={(e) => handleScoreChange(match.id, 'home', e.target.value)}
                              onBlur={() => handleScoreBlur(match.id)}
                              placeholder="–"
                              disabled={isSaving}
                              className={`w-14 h-14 text-center score text-[24px] rounded-[8px] bg-[var(--surface-2)] border border-[var(--hairline)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)] focus:border-[var(--accent)] transition-colors ${isSaving ? 'opacity-50' : ''}`}
                            />
                            <span className="score text-[20px] text-[var(--text-tertiary)]">:</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={currentAway}
                              onChange={(e) => handleScoreChange(match.id, 'away', e.target.value)}
                              onBlur={() => handleScoreBlur(match.id)}
                              placeholder="–"
                              disabled={isSaving}
                              className={`w-14 h-14 text-center score text-[24px] rounded-[8px] bg-[var(--surface-2)] border border-[var(--hairline)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)] focus:border-[var(--accent)] transition-colors ${isSaving ? 'opacity-50' : ''}`}
                            />
                          </div>
                          <button
                            onClick={() => saveScorePrediction(match.id, parseInt(currentHome, 10), parseInt(currentAway, 10))}
                            disabled={isSaving || currentHome === '' || currentAway === ''}
                            className={`h-14 px-5 rounded-[8px] text-[14px] font-medium transition-colors disabled:opacity-40 ${
                              match.id === strongCtaMatchId
                                ? 'bg-[var(--accent)] text-[#0A0C0B] hover:opacity-90'
                                : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--accent)]'
                            }`}
                          >
                            {isSaving ? '…' : 'Valider'}
                          </button>
                          {myPrediction && !editingThis && !isSaving && (
                            <span className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-muted)] px-3 py-1.5 text-[12px] text-[var(--accent)] animate-badge-in">
                              Prono enregistré
                              <span className="score"><CountUp value={myPrediction.home_score} durationMs={400} />-<CountUp value={myPrediction.away_score} durationMs={400} /></span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Others' predictions — compact reveal */}
                    {predState?.allPredictions && predState.allPredictions.filter(p => p.user_id !== currentUser?.id).length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                        {predState.allPredictions.filter(p => p.user_id !== currentUser?.id).map(pred => {
                          const member = MEMBERS.find(m => m.id === pred.user_id);
                          return member ? (
                            <div key={pred.user_id} className="flex items-center gap-1.5">
                              <div className="relative w-5 h-5 rounded-full overflow-hidden ring-1 ring-[var(--hairline)]">
                                <Image src={`/members/${member.slug}.webp`} alt={member.name} fill sizes="20px" className="object-cover object-top" />
                              </div>
                              <span className="text-[12px] text-[var(--text-tertiary)]">{member.name.split(' ')[0]}</span>
                              <span className="score text-[13px] text-[var(--text-secondary)]">{pred.home_score}-{pred.away_score}</span>
                            </div>
                          ) : null;
                        })}
                      </div>
                    )}

                    {/* Auvio */}
                    {isMatchToday(match) && (
                      isInAuvioWindow(match) ? (
                        <a
                          href="https://auvio.rtbf.be/categorie/sport~s-3/football~sc-32"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                        >
                          Regarder sur Auvio
                          <ExternalLink className="w-3 h-3" strokeWidth={1.75} />
                        </a>
                      ) : (
                        <span className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-[var(--text-tertiary)]">
                          Auvio <span className="text-[12px]">(dispo 30 min avant)</span>
                        </span>
                      )
                    )}

                    {/* Participation — segmented v2 (Je regarde / Peut-être / Non) */}
                    <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="relative inline-grid grid-cols-3 rounded-[8px] bg-[var(--surface-2)] p-0.5">
                          {(() => {
                            const partIndex = myStatus === 'yes' ? 0 : myStatus === 'maybe' ? 1 : myStatus === 'no' ? 2 : -1;
                            return partIndex >= 0 ? (
                              <span
                                aria-hidden
                                className="pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 rounded-[6px] bg-[var(--accent-muted)] top-light transition-transform duration-150 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]"
                                style={{ width: 'calc((100% - 4px) / 3)', transform: `translateX(${partIndex * 100}%)` }}
                              />
                            ) : null;
                          })()}
                          {([['yes', 'Je regarde'], ['maybe', 'Peut-être'], ['no', 'Non']] as const).map(([k, label]) => (
                            <button
                              key={k}
                              onClick={() => handleParticipation(match.id, k)}
                              disabled={isLoading}
                              className={`relative z-10 text-center px-3 py-2.5 sm:py-1.5 rounded-[6px] text-[13px] transition-colors ${
                                myStatus === k
                                  ? 'text-[var(--accent)]'
                                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                              } ${isLoading ? 'opacity-50' : ''}`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        {(yesCount > 0 || maybeCount > 0) && (
                          <span className="text-[12px] text-[var(--text-tertiary)]">
                            {yesCount > 0 && `${yesCount} regarde${yesCount > 1 ? 'nt' : ''}`}
                            {yesCount > 0 && maybeCount > 0 && ' · '}
                            {maybeCount > 0 && `${maybeCount} peut-être`}
                          </span>
                        )}
                        {(() => {
                          const confirmed = (participations[match.id] || []).filter(p => p.status === 'yes');
                          return confirmed.length > 0 ? (
                            <div className="flex -space-x-2">
                              {confirmed.slice(0, 6).map(p => {
                                const member = MEMBERS.find(m => m.id === p.user_id);
                                return member ? (
                                  <div key={p.user_id} className="relative w-5 h-5 rounded-full overflow-hidden ring-1 ring-[var(--hairline)]">
                                    <Image src={`/members/${member.slug}.webp`} alt={member.name} fill sizes="20px" className="object-cover object-top" />
                                  </div>
                                ) : null;
                              })}
                            </div>
                          ) : null;
                        })()}
                      </div>
                      <button
                        onClick={() => setExpandedMatch(isExpanded ? null : match.id)}
                        className="py-2.5 -my-1 text-[13px] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                      >
                        {isExpanded ? 'Moins' : 'Détails'}
                      </button>
                    </div>

                    {/* Détails — v2 panel with team facts */}
                    {isExpanded && (
                      <div className="mt-3 rounded-[10px] bg-[var(--surface-2)] top-light p-4">
                        <p className="eyebrow mb-2">Facts équipes</p>
                        <div className="flex flex-wrap gap-4">
                          <TeamInfoButton teamName={team1} label={team1} />
                          <TeamInfoButton teamName={team2} label={team2} />
                        </div>
                      </div>
                    )}
                </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredMatches.length === 0 && (
          <EmptyState
            title="Aucun match trouvé"
            description={
              filters.time !== 'all' && mounted
                ? filters.time === 'today'
                  ? `Pas de match le ${todayFormatted}`
                  : `Pas de match du ${todayFormatted} au ${weekEndFormatted}`
                : undefined
            }
            action={
              filters.time !== 'all' ? (
                <button
                  onClick={() => setFilters(f => ({ ...f, time: 'all' }))}
                  className="px-4 py-2 rounded-[8px] text-[13px] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                >
                  Voir tous les matchs
                </button>
              ) : undefined
            }
          />
        )}
      </section>
    </div>
  );
}
