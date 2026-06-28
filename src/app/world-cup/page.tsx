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
import confetti from 'canvas-confetti';
import { TeamInfoButton } from '@/components/TeamFactsSheet';
import { PHASES, PHASE_DISPLAY, PHASE_ORDER, GROUPS, isKnockoutPhase, getPhaseBadge, Phase } from '@/lib/constants';

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
  points?: { total: number; base: number; visionary: number; outsider: number; detail: string } | null;
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
const getCurrentPhase = (): string => {
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
    return knockoutMatch.phase;
  }

  // Otherwise return group stage
  return PHASES.GROUP_STAGE;
};

export default function WorldCupPage() {
  const router = useRouter();
  const { currentUser, loading: userLoading, getMatchParticipations, setMatchParticipation, getWatchLocations, addWatchLocation, toggleVoteLocation } = useSupabase();
  const { getTeamNames } = useTeamOverrides();

  const [selectedPhase, setSelectedPhase] = useState(getCurrentPhase);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [participations, setParticipations] = useState<Record<number, MatchParticipation[]>>({});
  const [locations, setLocations] = useState<Record<number, WatchLocation[]>>({});
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);
  const [newLocation, setNewLocation] = useState('');
  const [mounted, setMounted] = useState(false);
  const [loadingMatch, setLoadingMatch] = useState<number | null>(null);

  // Score predictions state
  const [scorePredictions, setScorePredictions] = useState<Record<number, MatchPredictionState>>({});
  const [editingScore, setEditingScore] = useState<{ matchId: number; home: string; away: string } | null>(null);
  const [savingScore, setSavingScore] = useState<number | null>(null);
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

  // Fire confetti burst
  const fireConfetti = useCallback(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#22c55e', '#fbbf24', '#6366f1', '#ec4899'],
    });
  }, []);

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

  // Compute group prediction stats for a match (after lock, i.e., 2h before kickoff)
  const getPredictionStats = useCallback((matchId: number, team1: string, team2: string): string | null => {
    const predState = scorePredictions[matchId];
    if (!predState?.predictionLocked || !predState.allPredictions?.length) return null;

    let team1Wins = 0;
    let team2Wins = 0;
    let draws = 0;

    for (const pred of predState.allPredictions) {
      if (pred.home_score > pred.away_score) team1Wins++;
      else if (pred.away_score > pred.home_score) team2Wins++;
      else draws++;
    }

    const total = predState.allPredictions.length;
    if (team1Wins > team2Wins && team1Wins > draws) {
      return `${team1Wins}/${total} voient une victoire de ${team1}`;
    } else if (team2Wins > team1Wins && team2Wins > draws) {
      return `${team2Wins}/${total} voient une victoire de ${team2}`;
    } else if (draws >= team1Wins && draws >= team2Wins) {
      return `${draws}/${total} voient un match nul`;
    }
    return null;
  }, [scorePredictions]);

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
    const newParticipations: Record<number, MatchParticipation[]> = {};
    const newLocations: Record<number, WatchLocation[]> = {};

    await Promise.all(matchIds.map(async (id) => {
      const [parts, locs] = await Promise.all([
        getMatchParticipations(id),
        getWatchLocations(id),
      ]);
      newParticipations[id] = parts;
      newLocations[id] = locs;
    }));

    setParticipations(prev => ({ ...prev, ...newParticipations }));
    setLocations(prev => ({ ...prev, ...newLocations }));
  }, [getMatchParticipations, getWatchLocations]);

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
        return false;
      }

      toast.success('Pronostic enregistré !', { icon: '🎯' });

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
        toast.success(wasFavorite ? 'Équipe retirée' : 'Équipe ajoutée aux favoris', { icon: '⭐' });
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
  }, []);

  // Track which matches we've already loaded predictions for to avoid infinite loops
  const loadedMatchIdsRef = useRef<Set<number>>(new Set());
  const loadingMatchIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!currentUser || filteredMatches.length === 0) return;

    // Only load data for matches we haven't loaded yet AND aren't currently loading
    const newMatchIds = filteredMatches
      .map(m => m.id)
      .filter(id => !loadedMatchIdsRef.current.has(id) && !loadingMatchIdsRef.current.has(id));

    if (newMatchIds.length === 0) return;

    // Mark as "loading" (not "loaded" yet)
    newMatchIds.forEach(id => loadingMatchIdsRef.current.add(id));

    // Load data and mark as loaded on success
    const loadAll = async () => {
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
      }
    };

    loadAll();
  }, [currentUser, filteredMatches, loadMatchData, loadScorePredictions]);

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
      // Fire confetti for the person who triggered the 5th yes!
      fireConfetti();
      toast.success('Match confirmé ! 🎉', { icon: '🎊' });
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
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#6366f1] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Chargement...</p>
        </div>
      </div>
    );
  }

  // Only redirect after loading completes and no user found
  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar />

      {/* Hero */}
      <section className="relative py-8 sm:py-16 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a472a] via-[#0d2818] to-[#0a0a0f]" />
        <div className="absolute inset-0 opacity-30 hidden sm:block">
          <div className="absolute top-10 left-10 text-6xl animate-bounce" style={{ animationDelay: '0s' }}>⚽</div>
          <div className="absolute top-20 right-20 text-5xl animate-bounce" style={{ animationDelay: '0.5s' }}>🏆</div>
          <div className="absolute bottom-10 left-1/4 text-4xl animate-bounce" style={{ animationDelay: '1s' }}>⚽</div>
          <div className="absolute bottom-20 right-1/3 text-5xl animate-bounce" style={{ animationDelay: '1.5s' }}>🎯</div>
        </div>
        <div className="absolute top-0 left-1/2 w-[800px] h-[400px] -translate-x-1/2 bg-[#fbbf24]/10 rounded-full blur-[128px]" />

        <div className={`max-w-7xl mx-auto text-center relative transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          {mounted && daysUntil !== null && daysUntil > 0 && (
            <div className="inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 bg-[#fbbf24]/20 rounded-full text-[#fbbf24] font-bold mb-4 sm:mb-6 border border-[#fbbf24]/30">
              <span className="text-lg sm:text-2xl">⏰</span>
              <span className="text-base sm:text-xl">{daysUntil} jours</span>
              <span className="text-xs sm:text-sm opacity-70 hidden xs:inline">avant le coup d&apos;envoi</span>
            </div>
          )}

          <div className="flex items-center justify-center gap-3 sm:gap-6 mb-4 sm:mb-6">
            <span className="text-4xl sm:text-6xl md:text-8xl">🏆</span>
            <div>
              <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-white">Coupe du Monde</h1>
              <p className="text-xl sm:text-3xl md:text-4xl font-bold text-[#fbbf24]">2026</p>
            </div>
            <span className="text-4xl sm:text-6xl md:text-8xl">⚽</span>
          </div>

          <div className="flex items-center justify-center gap-2 sm:gap-4 text-sm sm:text-xl text-white/80 mb-2 sm:mb-4">
            <span>🇺🇸 USA</span>
            <span className="text-[#fbbf24]">•</span>
            <span>🇲🇽 Mexique</span>
            <span className="text-[#fbbf24]">•</span>
            <span>🇨🇦 Canada</span>
          </div>

          <p className="text-gray-400 text-xs sm:text-base">11 juin - 19 juillet 2026 • 104 matchs • 48 équipes</p>
        </div>
      </section>

      {/* Phase Filters */}
      <section className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {phases.map(phase => (
            <button
              key={phase.id}
              onClick={() => {
                setSelectedPhase(phase.id);
                if (phase.id !== 'PHASE DE GROUPES') setSelectedGroup(null);
              }}
              className={`px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2 ${
                selectedPhase === phase.id
                  ? 'bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-black scale-105 shadow-lg shadow-[#fbbf24]/30'
                  : 'bg-[#1e1e2e] text-gray-300 hover:bg-[#2a2a3a] hover:text-white'
              }`}
            >
              <span>{phase.icon}</span>
              <span>{phase.label}</span>
            </button>
          ))}
        </div>

        {selectedPhase === 'PHASE DE GROUPES' && (
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => setSelectedGroup(null)}
              className={`w-10 h-10 rounded-xl font-bold transition-all ${
                !selectedGroup ? 'bg-[#6366f1] text-white' : 'bg-[#1e1e2e] text-gray-400 hover:bg-[#2a2a3a]'
              }`}
            >
              All
            </button>
            {groups.map(group => (
              <button
                key={group}
                onClick={() => setSelectedGroup(group)}
                className={`w-10 h-10 rounded-xl font-bold transition-all ${
                  selectedGroup === group ? 'bg-[#6366f1] text-white' : 'bg-[#1e1e2e] text-gray-400 hover:bg-[#2a2a3a]'
                }`}
              >
                {group}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Sticky Filter Bar - positioned below navbar */}
      <section className="sticky top-[7.5rem] md:top-16 z-30 bg-[#0a0a0f] border-b border-white/10 py-2 sm:py-3 px-3 sm:px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {/* Time filters */}
            <button
              onClick={() => setFilters(f => ({ ...f, time: 'today' }))}
              className={`flex-shrink-0 min-h-[36px] sm:min-h-[44px] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 sm:gap-2 ${
                filters.time === 'today'
                  ? 'bg-[#fbbf24] text-black'
                  : 'bg-[#1e1e2e] text-gray-300 hover:bg-[#2a2a3a]'
              }`}
              title={mounted ? `Matchs du ${todayFormatted}` : undefined}
            >
              <span>📅</span>
              <span className="hidden xs:inline">Aujourd&apos;hui</span>
              <span className="xs:hidden">Auj.</span>
            </button>
            <button
              onClick={() => setFilters(f => ({ ...f, time: 'week' }))}
              className={`flex-shrink-0 min-h-[36px] sm:min-h-[44px] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 sm:gap-2 ${
                filters.time === 'week'
                  ? 'bg-[#fbbf24] text-black'
                  : 'bg-[#1e1e2e] text-gray-300 hover:bg-[#2a2a3a]'
              }`}
              title={mounted ? `Du ${todayFormatted} au ${weekEndFormatted}` : undefined}
            >
              <span>📆</span>
              <span className="hidden xs:inline">Cette semaine</span>
              <span className="xs:hidden">Sem.</span>
            </button>
            <button
              onClick={() => setFilters(f => ({ ...f, time: 'all' }))}
              className={`flex-shrink-0 min-h-[36px] sm:min-h-[44px] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 sm:gap-2 ${
                filters.time === 'all'
                  ? 'bg-[#fbbf24] text-black'
                  : 'bg-[#1e1e2e] text-gray-300 hover:bg-[#2a2a3a]'
              }`}
            >
              <span>🌍</span>
              <span>Tous</span>
            </button>

            <div className="w-px bg-white/20 mx-0.5 sm:mx-1 flex-shrink-0" />

            {/* My teams filter */}
            <button
              onClick={() => setFilters(f => ({ ...f, myTeams: !f.myTeams }))}
              className={`flex-shrink-0 min-h-[36px] sm:min-h-[44px] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 sm:gap-2 ${
                filters.myTeams
                  ? 'bg-[#6366f1] text-white'
                  : 'bg-[#1e1e2e] text-gray-300 hover:bg-[#2a2a3a]'
              }`}
            >
              <span>⭐</span>
              <span className="hidden sm:inline">Mes équipes</span>
              {favorites.length > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  filters.myTeams ? 'bg-white/20' : 'bg-[#6366f1]/30 text-[#6366f1]'
                }`}>
                  {favorites.length}
                </span>
              )}
            </button>

            {/* To predict filter */}
            <button
              onClick={() => setFilters(f => ({ ...f, toPredictOnly: !f.toPredictOnly }))}
              className={`flex-shrink-0 min-h-[36px] sm:min-h-[44px] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 sm:gap-2 ${
                filters.toPredictOnly
                  ? 'bg-[#22c55e] text-white'
                  : 'bg-[#1e1e2e] text-gray-300 hover:bg-[#2a2a3a]'
              }`}
            >
              <span>✍️</span>
              <span className="hidden sm:inline">À pronostiquer</span>
              {toPredictCount > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  filters.toPredictOnly ? 'bg-white/20' : 'bg-[#22c55e]/30 text-[#22c55e]'
                }`}>
                  {toPredictCount}
                </span>
              )}
            </button>

            <div className="w-px bg-white/20 mx-0.5 sm:mx-1 flex-shrink-0" />

            {/* Time slot filters - based on actual World Cup 2026 schedule */}
            <button
              onClick={() => setFilters(f => ({ ...f, timeSlot: f.timeSlot === 'evening' ? 'all' : 'evening' }))}
              className={`flex-shrink-0 min-h-[36px] sm:min-h-[44px] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all flex items-center gap-1 sm:gap-2 ${
                filters.timeSlot === 'evening'
                  ? 'bg-[#f59e0b] text-black'
                  : 'bg-[#1e1e2e] text-gray-300 hover:bg-[#2a2a3a]'
              }`}
            >
              <span>🌙</span>
              <span className="hidden sm:inline">Soirée</span>
              <span className={`text-xs px-1 sm:px-1.5 py-0.5 rounded-full ${
                filters.timeSlot === 'evening' ? 'bg-black/20' : 'bg-white/10'
              }`}>
                {timeSlotCounts.evening}
              </span>
            </button>
            <button
              onClick={() => setFilters(f => ({ ...f, timeSlot: f.timeSlot === 'night' ? 'all' : 'night' }))}
              className={`flex-shrink-0 min-h-[36px] sm:min-h-[44px] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all flex items-center gap-1 sm:gap-2 ${
                filters.timeSlot === 'night'
                  ? 'bg-[#6366f1] text-white'
                  : 'bg-[#1e1e2e] text-gray-300 hover:bg-[#2a2a3a]'
              }`}
            >
              <span>🌃</span>
              <span className="hidden sm:inline">Nuit</span>
              <span className={`text-xs px-1 sm:px-1.5 py-0.5 rounded-full ${
                filters.timeSlot === 'night' ? 'bg-white/20' : 'bg-white/10'
              }`}>
                {timeSlotCounts.night}
              </span>
            </button>

            {resultsCount > 0 && (
              <>
                <div className="w-px bg-white/20 mx-0.5 sm:mx-1 flex-shrink-0" />

                {/* Results filters */}
                <button
                  onClick={() => setFilters(f => ({ ...f, resultsOnly: f.resultsOnly === 'last24h' ? 'all' : 'last24h' }))}
                  className={`flex-shrink-0 min-h-[36px] sm:min-h-[44px] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all flex items-center gap-1 sm:gap-2 ${
                    filters.resultsOnly === 'last24h'
                      ? 'bg-[#ef4444] text-white'
                      : 'bg-[#1e1e2e] text-gray-300 hover:bg-[#2a2a3a]'
                  }`}
                >
                  <span>🕐</span>
                  <span className="hidden sm:inline">24h</span>
                  <span className="sm:hidden">24h</span>
                </button>
                <button
                  onClick={() => setFilters(f => ({ ...f, resultsOnly: f.resultsOnly === 'last10' ? 'all' : 'last10' }))}
                  className={`flex-shrink-0 min-h-[36px] sm:min-h-[44px] px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all flex items-center gap-1 sm:gap-2 ${
                    filters.resultsOnly === 'last10'
                      ? 'bg-[#ef4444] text-white'
                      : 'bg-[#1e1e2e] text-gray-300 hover:bg-[#2a2a3a]'
                  }`}
                >
                  <span>🏆</span>
                  <span className="hidden sm:inline">10 derniers</span>
                  <span className="sm:hidden">10</span>
                </button>
              </>
            )}
          </div>

          {/* Active filters summary */}
          {(filters.time !== 'all' || filters.myTeams || filters.toPredictOnly || filters.timeSlot !== 'all' || filters.resultsOnly !== 'all') && (
            <div className="flex items-center justify-between mt-2 text-sm">
              <span className="text-gray-400">
                {filteredMatches.length} match{filteredMatches.length > 1 ? 's' : ''} trouvé{filteredMatches.length > 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setFilters({ time: 'all', myTeams: false, toPredictOnly: false, timeSlot: 'all', resultsOnly: 'all' })}
                className="text-[#ef4444] hover:text-[#f87171] transition-colors"
              >
                Réinitialiser
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Matches */}
      <section className="max-w-7xl mx-auto px-4 pb-12">
        <div className="space-y-4">
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

            // Lock countdown - show "🔒 dans Xh Ym" if less than 6h until lock
            const timeUntilLock = predState?.timeUntilLock ?? -1;
            const sixHoursMs = 6 * 60 * 60 * 1000;
            const showLockCountdown = !isLocked && timeUntilLock > 0 && timeUntilLock < sixHoursMs;
            const lockCountdownText = showLockCountdown ? (() => {
              const hours = Math.floor(timeUntilLock / (60 * 60 * 1000));
              const minutes = Math.floor((timeUntilLock % (60 * 60 * 1000)) / (60 * 1000));
              return hours > 0 ? `🔒 dans ${hours}h ${minutes}m` : `🔒 dans ${minutes}m`;
            })() : null;

            // Get my points if result exists
            const myPoints = hasResult && predState?.allPredictions
              ? predState.allPredictions.find(p => p.user_id === currentUser?.id)?.points
              : null;

            return (
              <div key={match.id}>
                {/* Day Separator */}
                {showDaySeparator && (
                  <div className={`flex items-center gap-4 py-4 ${index > 0 ? 'mt-6' : ''}`}>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#fbbf24]/30 to-transparent" />
                    <div className="flex items-center gap-3 px-4 py-2 bg-[#1e1e2e] rounded-full border border-[#fbbf24]/20">
                      <span className="text-lg">📅</span>
                      <span className="text-[#fbbf24] font-bold">{match.dateDisplay}</span>
                    </div>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#fbbf24]/30 to-transparent" />
                  </div>
                )}

                <div
                  className={`relative overflow-hidden rounded-3xl border transition-all duration-300 ${
                    mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                  } ${
                    yesCount > 0
                      ? 'border-[#22c55e]/30 bg-gradient-to-br from-[#1a472a]/80 to-[#0d2818]/80'
                      : 'border-[#fbbf24]/20 bg-gradient-to-br from-[#1a472a]/50 to-[#0d2818]/50'
                  }`}
                  style={{ transitionDelay: `${index * 30}ms` }}
                >
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#fbbf24]/5 rounded-full blur-2xl" />

                <div className="relative p-4 sm:p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        {match.group ? (
                          <span className="px-3 py-1 bg-[#fbbf24]/20 text-[#fbbf24] rounded-lg text-xs font-bold">{match.group}</span>
                        ) : (
                          // Show phase badge for knockout matches
                          (() => {
                            const badge = getPhaseBadge(match.phase);
                            return badge ? (
                              <span className={`px-3 py-1 rounded-lg text-xs font-bold ${badge.color}`}>
                                {badge.label}
                              </span>
                            ) : null;
                          })()
                        )}
                        <span className="px-3 py-1 bg-white/10 text-white/70 rounded-lg text-xs">Match #{match.id}</span>
                        {predState?.totalPredictions > 0 && (
                          <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                            myPrediction ? 'bg-[#6366f1]/20 text-[#6366f1]' : 'bg-gray-500/20 text-gray-400'
                          }`}>
                            🎯 {predState.totalPredictions}/14
                          </span>
                        )}
                        {hasResult && myPoints && (
                          <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                            myPoints.total >= 3 ? 'bg-[#fbbf24]/20 text-[#fbbf24]' :
                            myPoints.total > 0 ? 'bg-green-500/20 text-green-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            +{myPoints.total} pt{myPoints.total > 1 ? 's' : ''}
                          </span>
                        )}
                        {lockCountdownText && (
                          <span className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded-lg text-xs font-medium animate-pulse">
                            {lockCountdownText}
                          </span>
                        )}
                        {isLocked && !hasResult && (
                          <span className="px-3 py-1 bg-gray-500/20 text-gray-400 rounded-lg text-xs font-medium">
                            🔒 Verrouillé
                          </span>
                        )}
                      </div>

                      {/* Team names - Stacked on mobile, horizontal on desktop */}
                      {/* Mobile: compact horizontal layout */}
                      <div className="flex sm:hidden items-center justify-between gap-2 mb-2">
                        {/* Home team */}
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <span className="text-xl flex-shrink-0">{getFlag(team1)}</span>
                          <span className="text-sm font-bold text-white truncate">{team1}</span>
                          <TeamInfoButton teamName={team1} className="flex-shrink-0" />
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(team1); }}
                            disabled={loadingFavorite === team1}
                            className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-all text-sm ${
                              favorites.includes(team1) ? 'text-[#fbbf24]' : 'text-gray-500'
                            }`}
                          >
                            {favorites.includes(team1) ? '★' : '☆'}
                          </button>
                        </div>
                        {/* VS */}
                        <span className="text-gray-500 text-xs font-bold px-2 py-0.5 bg-white/5 rounded-full flex-shrink-0">VS</span>
                        {/* Away team */}
                        <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(team2); }}
                            disabled={loadingFavorite === team2}
                            className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-all text-sm ${
                              favorites.includes(team2) ? 'text-[#fbbf24]' : 'text-gray-500'
                            }`}
                          >
                            {favorites.includes(team2) ? '★' : '☆'}
                          </button>
                          <TeamInfoButton teamName={team2} className="flex-shrink-0" />
                          <span className="text-sm font-bold text-white truncate">{team2}</span>
                          <span className="text-xl flex-shrink-0">{getFlag(team2)}</span>
                        </div>
                      </div>

                      {/* Desktop: horizontal layout */}
                      <div className="hidden sm:flex items-center justify-between gap-4 mb-2">
                        {/* Home team */}
                        <div className="flex items-center gap-2">
                          <span className="text-3xl">{getFlag(team1)}</span>
                          <TeamInfoButton teamName={team1} />
                          <span className="text-xl font-bold text-white">{team1}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(team1); }}
                            disabled={loadingFavorite === team1}
                            className={`min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full transition-all text-lg ${
                              favorites.includes(team1) ? 'text-[#fbbf24]' : 'text-gray-500 hover:text-gray-300'
                            }`}
                          >
                            {favorites.includes(team1) ? '★' : '☆'}
                          </button>
                        </div>
                        {/* VS */}
                        <span className="text-gray-500 text-xl font-bold">VS</span>
                        {/* Away team */}
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(team2); }}
                            disabled={loadingFavorite === team2}
                            className={`min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full transition-all text-lg ${
                              favorites.includes(team2) ? 'text-[#fbbf24]' : 'text-gray-500 hover:text-gray-300'
                            }`}
                          >
                            {favorites.includes(team2) ? '★' : '☆'}
                          </button>
                          <span className="text-xl font-bold text-white">{team2}</span>
                          <TeamInfoButton teamName={team2} />
                          <span className="text-3xl">{getFlag(team2)}</span>
                        </div>
                      </div>

                      {/* Date/Time/Location row */}
                      <div className="flex flex-wrap items-center gap-3 text-sm mb-4">
                        <span className="flex items-center gap-1.5 text-gray-300">
                          <span>📅</span>
                          <span>{match.dateDisplay}</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-[#fbbf24] font-bold">
                          <span>⏰</span>
                          <span>{match.time}</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-gray-400">
                          <span>📍</span>
                          <span>{match.city}</span>
                        </span>
                        {lockCountdownText && (
                          <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded-lg text-xs font-medium animate-pulse">
                            {lockCountdownText}
                          </span>
                        )}
                      </div>

                      {/* PROMINENT SCORE PREDICTION SECTION */}
                      <div className={`p-4 rounded-2xl mb-4 ${
                        hasResult
                          ? 'bg-[#22c55e]/10 border border-[#22c55e]/30'
                          : isLocked
                            ? 'bg-gray-500/10 border border-gray-500/30'
                            : myPrediction
                              ? 'bg-[#6366f1]/10 border border-[#6366f1]/30'
                              : 'bg-[#fbbf24]/10 border border-[#fbbf24]/30'
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-bold flex items-center gap-2">
                            <span>🎯</span>
                            <span className={hasResult ? 'text-[#22c55e]' : isLocked ? 'text-gray-400' : myPrediction ? 'text-[#6366f1]' : 'text-[#fbbf24]'}>
                              {hasResult ? 'Résultat final' : isLocked ? 'Ton prono (verrouillé)' : myPrediction ? 'Ton prono' : 'Fais ton prono !'}
                            </span>
                          </span>
                          {hasResult && myPoints && (
                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                              myPoints.total >= 3 ? 'bg-[#fbbf24]/20 text-[#fbbf24]' :
                              myPoints.total > 0 ? 'bg-green-500/20 text-green-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {myPoints.total >= 3 && '🎯 '}+{myPoints.total} pt{myPoints.total > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-center gap-4">
                          {hasResult ? (
                            // Show actual result prominently
                            <div className="flex items-center gap-4">
                              <div className="text-center">
                                <span className="text-4xl font-black text-white">{predState.result?.home_score}</span>
                              </div>
                              <span className="text-2xl text-gray-400">-</span>
                              <div className="text-center">
                                <span className="text-4xl font-black text-white">{predState.result?.away_score}</span>
                              </div>
                              {myPrediction && (
                                <div className="ml-4 text-sm text-gray-400">
                                  <span>Ton prono : </span>
                                  <span className={`font-bold ${
                                    myPrediction.home_score === predState.result?.home_score &&
                                    myPrediction.away_score === predState.result?.away_score
                                      ? 'text-[#fbbf24]' : 'text-white'
                                  }`}>
                                    {myPrediction.home_score}-{myPrediction.away_score}
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : isLocked ? (
                            // Locked prediction display
                            <div className="flex items-center gap-4">
                              {myPrediction ? (
                                <>
                                  <span className="text-4xl font-black text-gray-400">{myPrediction.home_score}</span>
                                  <span className="text-2xl text-gray-500">-</span>
                                  <span className="text-4xl font-black text-gray-400">{myPrediction.away_score}</span>
                                  <span className="text-2xl text-gray-500">🔒</span>
                                </>
                              ) : (
                                <span className="text-gray-500 flex items-center gap-2">
                                  <span>😔</span>
                                  <span>Pas de prono enregistré</span>
                                  <span>🔒</span>
                                </span>
                              )}
                            </div>
                          ) : (
                            // Editable score inputs - BIG and prominent
                            <div className="flex items-center gap-2 sm:gap-3">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={currentHome}
                                onChange={(e) => handleScoreChange(match.id, 'home', e.target.value)}
                                onBlur={() => handleScoreBlur(match.id)}
                                placeholder="?"
                                className={`w-12 h-12 sm:w-16 sm:h-16 text-center text-2xl sm:text-3xl font-black rounded-xl sm:rounded-2xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-[#6366f1] ${
                                  currentHome
                                    ? 'bg-[#6366f1]/30 border-[#6366f1] text-white'
                                    : 'bg-[#1e1e2e] border-[#fbbf24]/50 text-[#fbbf24] placeholder-[#fbbf24]/50'
                                } ${isSaving ? 'opacity-50' : ''}`}
                                disabled={isSaving}
                              />
                              <span className="text-xl sm:text-2xl text-gray-400 font-bold">-</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={currentAway}
                                onChange={(e) => handleScoreChange(match.id, 'away', e.target.value)}
                                onBlur={() => handleScoreBlur(match.id)}
                                placeholder="?"
                                className={`w-12 h-12 sm:w-16 sm:h-16 text-center text-2xl sm:text-3xl font-black rounded-xl sm:rounded-2xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-[#6366f1] ${
                                  currentAway
                                    ? 'bg-[#6366f1]/30 border-[#6366f1] text-white'
                                    : 'bg-[#1e1e2e] border-[#fbbf24]/50 text-[#fbbf24] placeholder-[#fbbf24]/50'
                                } ${isSaving ? 'opacity-50' : ''}`}
                                disabled={isSaving}
                              />
                              {isSaving && (
                                <div className="animate-spin w-5 h-5 sm:w-6 sm:h-6 border-2 border-[#6366f1] border-t-transparent rounded-full" />
                              )}
                              {myPrediction && !editingThis && !isSaving && (
                                <span className="text-green-400 text-lg sm:text-xl">✓</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Hint text for empty state */}
                        {!isLocked && !hasResult && !myPrediction && (
                          <p className="text-center text-sm text-[#fbbf24]/70 mt-2">
                            Saisis le score que tu prédis !
                          </p>
                        )}

                        {/* Other predictions - compact display with avatars */}
                        {predState?.allPredictions && predState.allPredictions.filter(p => p.user_id !== currentUser?.id).length > 0 && (
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <p className="text-xs text-gray-500 text-center mb-2">Pronos des autres</p>
                            <div className="flex flex-wrap gap-2 justify-center">
                              {predState.allPredictions
                                .filter(p => p.user_id !== currentUser?.id)
                                .map(pred => {
                                  const member = MEMBERS.find(m => m.id === pred.user_id);
                                  return member ? (
                                    <div
                                      key={pred.user_id}
                                      className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded-lg"
                                      title={member.name}
                                    >
                                      <div className="w-5 h-5 rounded-full overflow-hidden relative">
                                        <Image src={`/members/${member.slug}.png`} alt={member.name} fill className="object-cover" />
                                      </div>
                                      <span className="text-xs text-gray-300 font-medium">
                                        {pred.home_score}-{pred.away_score}
                                      </span>
                                    </div>
                                  ) : null;
                                })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Auvio Button - visible on all today's matches */}
                      {isMatchToday(match) && (
                        isInAuvioWindow(match) ? (
                          <a
                            href="https://auvio.rtbf.be/categorie/sport~s-3/football~sc-32"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#e30613]/20 text-[#e30613] rounded-xl font-bold hover:bg-[#e30613]/30 transition-colors border border-[#e30613]/30 mb-3"
                          >
                            <span>📺</span>
                            <span>Regarder sur Auvio</span>
                          </a>
                        ) : (
                          <div
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-500/10 text-gray-500 rounded-xl font-bold border border-gray-500/20 mb-3 cursor-not-allowed"
                            title="Dispo 30 min avant le match"
                          >
                            <span>📺</span>
                            <span>Auvio</span>
                            <span className="text-xs opacity-70">(dispo 30 min avant)</span>
                          </div>
                        )
                      )}

                      {/* Group prediction stats after kickoff */}
                      {(() => {
                        const stats = getPredictionStats(match.id, team1, team2);
                        return stats && (
                          <div className="mb-3 px-3 py-1.5 bg-[#6366f1]/10 rounded-lg text-[#6366f1] text-sm font-medium inline-flex items-center gap-2">
                            <span>📊</span>
                            <span>{stats}</span>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Confirmed Badge with confetti */}
                      {yesCount >= 5 && (
                        <div className="px-3 py-1.5 bg-[#22c55e] text-white text-sm font-bold rounded-xl flex items-center gap-1.5 shadow-lg shadow-[#22c55e]/30 animate-pulse">
                          <span>🎉</span> Confirmé !
                        </div>
                      )}
                      {yesCount > 0 && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-[#22c55e]/20 rounded-xl border border-[#22c55e]/30">
                          <span className="text-lg">✓</span>
                          <span className="text-[#22c55e] font-bold">{yesCount}</span>
                          <span className="text-[#22c55e]/70 text-sm">viennent</span>
                        </div>
                      )}
                      {maybeCount > 0 && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-[#fbbf24]/20 rounded-xl border border-[#fbbf24]/30">
                          <span className="text-lg">?</span>
                          <span className="text-[#fbbf24] font-bold">{maybeCount}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Response Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-gray-400">{matchParticipants.length}/{14} ont répondu</span>
                      {yesCount < 5 && yesCount > 0 && (
                        <span className="text-[#fbbf24]">Encore {5 - yesCount} pour confirmer</span>
                      )}
                    </div>
                    <div className="h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${yesCount >= 5 ? 'bg-gradient-to-r from-[#22c55e] to-[#16a34a]' : 'bg-gradient-to-r from-[#fbbf24] to-[#f59e0b]'}`}
                        style={{ width: `${(matchParticipants.length / 14) * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Participation section - SECONDARY (smaller buttons) */}
                  <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/10">
                    <span className="text-xs text-gray-500">Tu regardes ?</span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleParticipation(match.id, 'yes')}
                        disabled={isLoading}
                        className={`min-h-[36px] px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
                          myStatus === 'yes'
                            ? 'bg-[#22c55e] text-white shadow-md shadow-[#22c55e]/30'
                            : 'bg-[#22c55e]/15 text-[#22c55e] hover:bg-[#22c55e]/25 border border-[#22c55e]/20'
                        } ${isLoading ? 'opacity-50' : ''}`}
                      >
                        <span>✓</span>
                        <span className="hidden sm:inline">Oui</span>
                      </button>
                      <button
                        onClick={() => handleParticipation(match.id, 'maybe')}
                        disabled={isLoading}
                        className={`min-h-[36px] px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
                          myStatus === 'maybe'
                            ? 'bg-[#fbbf24] text-black shadow-md shadow-[#fbbf24]/30'
                            : 'bg-[#fbbf24]/15 text-[#fbbf24] hover:bg-[#fbbf24]/25 border border-[#fbbf24]/20'
                        } ${isLoading ? 'opacity-50' : ''}`}
                      >
                        <span>🤔</span>
                        <span className="hidden sm:inline">Peut-être</span>
                      </button>
                      <button
                        onClick={() => handleParticipation(match.id, 'no')}
                        disabled={isLoading}
                        className={`min-h-[36px] px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
                          myStatus === 'no'
                            ? 'bg-[#ef4444] text-white shadow-md shadow-[#ef4444]/30'
                            : 'bg-[#ef4444]/15 text-[#ef4444] hover:bg-[#ef4444]/25 border border-[#ef4444]/20'
                        } ${isLoading ? 'opacity-50' : ''}`}
                      >
                        <span>✗</span>
                        <span className="hidden sm:inline">Non</span>
                      </button>
                    </div>

                    <button
                      onClick={() => setExpandedMatch(isExpanded ? null : match.id)}
                      className="ml-auto min-h-[36px] px-3 py-1.5 bg-white/10 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/20 transition-all flex items-center gap-1.5"
                    >
                      <span>{isExpanded ? '▲' : '▼'}</span>
                      <span>{isExpanded ? 'Moins' : 'Détails'}</span>
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-6 pt-6 border-t border-white/10 space-y-6">
                      {/* All Predictions - ALWAYS visible in expanded mode */}
                      {predState?.allPredictions && predState.allPredictions.length > 0 && (
                        <div>
                          <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            <span>🎯</span>
                            Pronostics ({predState.allPredictions.length}/14)
                            {!myPrediction && !isLocked && <span className="text-[#fbbf24] text-xs font-normal ml-2">Fais ton prono !</span>}
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {predState.allPredictions
                              .sort((a, b) => (b.points?.total || 0) - (a.points?.total || 0))
                              .map(pred => {
                                const member = MEMBERS.find(m => m.id === pred.user_id);
                                const isMe = pred.user_id === currentUser?.id;
                                const isExact = hasResult &&
                                  pred.home_score === predState.result?.home_score &&
                                  pred.away_score === predState.result?.away_score;

                                return (
                                  <div
                                    key={pred.user_id}
                                    className={`p-3 rounded-xl border transition-all ${
                                      isExact ? 'bg-[#fbbf24]/20 border-[#fbbf24]/50' :
                                      isMe ? 'bg-[#6366f1]/20 border-[#6366f1]/30' :
                                      'bg-[#1e1e2e] border-white/10'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className={`w-8 h-8 rounded-full overflow-hidden relative ${isExact ? 'ring-2 ring-[#fbbf24]' : ''}`}>
                                        <Image
                                          src={`/members/${member?.slug || 'default'}.png`}
                                          alt={member?.name || ''}
                                          fill
                                          className="object-cover"
                                        />
                                      </div>
                                      <span className={`text-sm font-medium truncate ${isMe ? 'text-[#6366f1]' : 'text-white'}`}>
                                        {member?.name.split(' ')[0] || '?'}
                                      </span>
                                      {isExact && <span className="text-sm">🎯</span>}
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-lg font-bold text-white">
                                        {pred.home_score} - {pred.away_score}
                                      </span>
                                      {pred.points && (
                                        <span className={`text-sm font-bold ${
                                          pred.points.total >= 3 ? 'text-[#fbbf24]' :
                                          pred.points.total > 0 ? 'text-green-400' :
                                          'text-red-400'
                                        }`}>
                                          +{pred.points.total}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      {/* No predictions yet hint */}
                      {(!predState?.allPredictions || predState.allPredictions.length === 0) && !isLocked && (
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <span>🎯</span>
                          <span>Aucun prono pour l&apos;instant</span>
                          <span className="text-[#fbbf24]">— Sois le premier !</span>
                        </div>
                      )}

                      <div>
                        <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                          <span>👥</span>
                          Qui regarde ce match ?
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {matchParticipants.filter(p => p.status === 'yes').map(p => {
                            const isFirst = getFirstYesParticipant(match.id) === p.user_id;
                            return (
                              <div key={p.id} className="flex items-center gap-2 px-3 py-2 bg-[#22c55e]/20 rounded-xl border border-[#22c55e]/30">
                                <div className="relative">
                                  <div className={`w-8 h-8 rounded-full overflow-hidden relative ring-2 ${isFirst ? 'ring-[#fbbf24]' : 'ring-[#22c55e]'}`}>
                                    <Image src={`/members/${p.users?.member_slug || 'default'}.png`} alt="" fill className="object-cover" />
                                  </div>
                                  {isFirst && (
                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#fbbf24] rounded-full flex items-center justify-center text-[8px] font-bold text-black" title="Premier inscrit !">
                                      🥇
                                    </div>
                                  )}
                                </div>
                                <span className="text-sm font-medium text-[#22c55e]">{p.users?.member_name?.split(' ')[0]}</span>
                                <span className="text-[#22c55e]">✓</span>
                              </div>
                            );
                          })}
                          {matchParticipants.filter(p => p.status === 'maybe').map(p => (
                            <div key={p.id} className="flex items-center gap-2 px-3 py-2 bg-[#fbbf24]/20 rounded-xl border border-[#fbbf24]/30">
                              <div className="w-8 h-8 rounded-full overflow-hidden relative ring-2 ring-[#fbbf24]">
                                <Image src={`/members/${p.users?.member_slug || 'default'}.png`} alt="" fill className="object-cover" />
                              </div>
                              <span className="text-sm font-medium text-[#fbbf24]">{p.users?.member_name?.split(' ')[0]} ?</span>
                            </div>
                          ))}
                          {matchParticipants.filter(p => p.status !== 'no').length === 0 && (
                            <p className="text-gray-500 text-sm italic">Personne inscrit - sois le premier !</p>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                          <span>📍</span>
                          Où regarder ensemble ?
                        </h4>
                        <div className="space-y-2 mb-4">
                          {matchLocations.map(loc => {
                            const proposer = loc.proposer;
                            const voters = (loc.votes || []).map(id => MEMBERS.find(m => m.id === id)).filter(Boolean);
                            const hasVoted = loc.votes?.includes(currentUser?.id || '');

                            return (
                              <div key={loc.id} className="p-4 bg-[#1e1e2e] rounded-xl border border-white/10 hover:border-[#fbbf24]/30 transition-colors">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                    <span className="text-2xl">📍</span>
                                    <div>
                                      <span className="text-white font-medium">{loc.location}</span>
                                      {proposer && (
                                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                          <span>Proposé par</span>
                                          <span className="text-[#fbbf24]">{proposer.member_name}</span>
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {hasVoted && (
                                      <span className="text-xs text-[#fbbf24] font-medium">Tu as voté</span>
                                    )}
                                    <button
                                      onClick={() => handleVoteLocation(loc.id, match.id, loc.votes || [])}
                                      className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${
                                        hasVoted
                                          ? 'bg-[#fbbf24] text-black'
                                          : 'bg-[#fbbf24]/20 text-[#fbbf24] hover:bg-[#fbbf24]/30 border border-[#fbbf24]/30'
                                      }`}
                                    >
                                      <span>{hasVoted ? '✓' : '👍'}</span>
                                      <span>{loc.votes?.length || 0}</span>
                                    </button>
                                  </div>
                                </div>
                                {voters.length > 0 && (
                                  <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                                    <span className="text-xs text-gray-500">Votes:</span>
                                    <div className="flex -space-x-1">
                                      {voters.slice(0, 5).map((voter) => (
                                        <div key={voter!.id} className="w-6 h-6 rounded-full overflow-hidden relative ring-1 ring-[#1e1e2e]" title={voter!.name}>
                                          <Image src={voter!.photo} alt={voter!.name} fill className="object-cover" />
                                        </div>
                                      ))}
                                      {voters.length > 5 && (
                                        <div className="w-6 h-6 rounded-full bg-[#fbbf24] flex items-center justify-center text-xs font-bold text-black ring-1 ring-[#1e1e2e]">
                                          +{voters.length - 5}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex gap-3">
                          <input
                            type="text"
                            value={newLocation}
                            onChange={(e) => setNewLocation(e.target.value)}
                            placeholder="Proposer un lieu..."
                            className="flex-1 px-4 py-3 bg-[#1e1e2e] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#fbbf24] transition-colors"
                            onKeyDown={(e) => { if (e.key === 'Enter') handleProposeLocation(match.id); }}
                          />
                          <button
                            onClick={() => handleProposeLocation(match.id)}
                            className="px-6 py-3 bg-[#fbbf24] text-black rounded-xl font-bold hover:bg-[#fbbf24]/80 transition-colors"
                          >
                            Proposer
                          </button>
                        </div>
                      </div>

                      <div className="p-4 bg-white/5 rounded-xl flex items-center gap-4">
                        <span className="text-3xl">🏟️</span>
                        <div>
                          <p className="text-white font-medium">{match.stadium}</p>
                          <p className="text-gray-400 text-sm">{match.city}</p>
                        </div>
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
          <div className="text-center py-16">
            <span className="text-6xl mb-4 block">🔍</span>
            <p className="text-gray-500 text-lg">Aucun match trouvé</p>
            {filters.time !== 'all' && mounted && (
              <p className="text-gray-600 text-sm mt-2">
                {filters.time === 'today'
                  ? `Pas de match le ${todayFormatted}`
                  : `Pas de match du ${todayFormatted} au ${weekEndFormatted}`}
              </p>
            )}
            {filters.time !== 'all' && (
              <button
                onClick={() => setFilters(f => ({ ...f, time: 'all' }))}
                className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
              >
                Voir tous les matchs
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
