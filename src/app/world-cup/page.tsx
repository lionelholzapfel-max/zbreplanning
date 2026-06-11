'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import matches from '@/data/matches.json';
import { useSupabase, MatchParticipation, WatchLocation } from '@/hooks/useSupabase';
import { MEMBERS } from '@/data/members';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

// Filter types
type TimeFilter = 'all' | 'today' | 'week';
type TimeSlot = 'all' | 'morning' | 'afternoon' | 'evening';

interface FilterState {
  time: TimeFilter;
  myTeams: boolean;
  toPredictOnly: boolean;
  timeSlot: TimeSlot;
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

const phases = [
  { id: 'PHASE DE GROUPES', label: 'Groupes', icon: '🏟️' },
  { id: 'HUITIÈMES DE FINALE', label: '8e', icon: '⚔️' },
  { id: 'QUARTS DE FINALE', label: 'Quarts', icon: '🔥' },
  { id: 'DEMI-FINALES', label: 'Demis', icon: '⭐' },
  { id: 'FINALE', label: 'Finale', icon: '🏆' },
];

const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

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

export default function WorldCupPage() {
  const router = useRouter();
  const { currentUser, loading: userLoading, getMatchParticipations, setMatchParticipation, getWatchLocations, addWatchLocation, toggleVoteLocation } = useSupabase();

  const [selectedPhase, setSelectedPhase] = useState('PHASE DE GROUPES');
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
  });

  // Helper to parse match datetime
  const getMatchDateTime = useCallback((match: Match): Date => {
    // Parse date like "11/06/2026" and time like "21:00"
    const [day, month, year] = match.date.split('/').map(Number);
    const [hours, minutes] = match.time.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes);
  }, []);

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

  // Helper to check time slot
  const isMatchInTimeSlot = useCallback((match: Match, slot: TimeSlot): boolean => {
    if (slot === 'all') return true;
    const [hours] = match.time.split(':').map(Number);
    if (slot === 'morning') return hours >= 6 && hours < 14;
    if (slot === 'afternoon') return hours >= 14 && hours < 18;
    if (slot === 'evening') return hours >= 18 || hours < 6;
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

  const filteredMatches = useMemo(() => {
    const now = new Date();

    let result = (matches as Match[]).filter(m => {
      // Phase filter
      const phaseMatch = m.phase.includes(selectedPhase) ||
        (selectedPhase === 'PHASE DE GROUPES' && m.phase === 'PHASE DE GROUPES') ||
        (selectedPhase === 'HUITIÈMES DE FINALE' && (m.phase.includes('HUITIÈME') || m.phase.includes('8E'))) ||
        (selectedPhase === 'QUARTS DE FINALE' && m.phase.includes('QUART')) ||
        (selectedPhase === 'DEMI-FINALES' && m.phase.includes('DEMI')) ||
        (selectedPhase === 'FINALE' && m.phase === 'FINALE');

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

      return phaseMatch && groupMatch && timeMatch && timeSlotMatch && myTeamsMatch && toPredictMatch;
    });

    // Sort by date/time (next match first)
    result.sort((a, b) => {
      const dateA = getMatchDateTime(a);
      const dateB = getMatchDateTime(b);
      return dateA.getTime() - dateB.getTime();
    });

    return result;
  }, [selectedPhase, selectedGroup, filters, favorites, scorePredictions, getMatchDateTime, isMatchInTimeRange, isMatchInTimeSlot]);

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

  // Load score predictions for matches
  const loadScorePredictions = useCallback(async (matchIds: number[]) => {
    const newPredictions: Record<number, MatchPredictionState> = {};

    await Promise.all(matchIds.map(async (matchId) => {
      try {
        const res = await fetch(`/api/predictions/score?match_id=${matchId}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.predictionLocked) {
          // Predictions are locked (2h before kickoff) - we have all predictions
          newPredictions[matchId] = {
            myPrediction: data.predictions?.find((p: ScorePrediction) => p.user_id === currentUser?.id) || null,
            allPredictions: data.predictions || [],
            matchStarted: data.matchStarted,
            predictionLocked: true,
            timeUntilLock: -1,
            result: data.result,
            totalPredictions: data.predictions?.length || 0,
          };
        } else {
          // Predictions still open
          newPredictions[matchId] = {
            myPrediction: data.myPrediction,
            allPredictions: [],
            matchStarted: false,
            predictionLocked: false,
            timeUntilLock: data.timeUntilLock || -1,
            result: null,
            totalPredictions: data.totalPredictions || 0,
          };
        }
      } catch (err) {
        console.error(`Error loading predictions for match ${matchId}:`, err);
      }
    }));

    setScorePredictions(prev => ({ ...prev, ...newPredictions }));
  }, [currentUser?.id]);

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
    } catch (err) {
      console.error('Error saving prediction:', err);
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
    } catch (err) {
      console.error('Error loading favorites:', err);
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

  useEffect(() => {
    if (!userLoading && !currentUser) {
      router.push('/login');
    }
  }, [userLoading, currentUser, router]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (currentUser && filteredMatches.length > 0) {
      const matchIds = filteredMatches.map(m => m.id);
      loadMatchData(matchIds);
      loadScorePredictions(matchIds);
    }
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

    await setMatchParticipation(matchId, status);
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

  const worldCupStart = new Date('2026-06-11');
  const today = new Date();
  const daysUntil = Math.ceil((worldCupStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (userLoading || !currentUser) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar />

      {/* Hero */}
      <section className="relative py-16 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a472a] via-[#0d2818] to-[#0a0a0f]" />
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-10 left-10 text-6xl animate-bounce" style={{ animationDelay: '0s' }}>⚽</div>
          <div className="absolute top-20 right-20 text-5xl animate-bounce" style={{ animationDelay: '0.5s' }}>🏆</div>
          <div className="absolute bottom-10 left-1/4 text-4xl animate-bounce" style={{ animationDelay: '1s' }}>⚽</div>
          <div className="absolute bottom-20 right-1/3 text-5xl animate-bounce" style={{ animationDelay: '1.5s' }}>🎯</div>
        </div>
        <div className="absolute top-0 left-1/2 w-[800px] h-[400px] -translate-x-1/2 bg-[#fbbf24]/10 rounded-full blur-[128px]" />

        <div className={`max-w-7xl mx-auto text-center relative transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          {daysUntil > 0 && (
            <div className="inline-flex items-center gap-3 px-6 py-3 bg-[#fbbf24]/20 rounded-full text-[#fbbf24] font-bold mb-6 border border-[#fbbf24]/30">
              <span className="text-2xl">⏰</span>
              <span className="text-xl">{daysUntil} jours</span>
              <span className="text-sm opacity-70">avant le coup d&apos;envoi</span>
            </div>
          )}

          <div className="flex items-center justify-center gap-6 mb-6">
            <span className="text-6xl md:text-8xl">🏆</span>
            <div>
              <h1 className="text-5xl md:text-7xl font-black text-white">Coupe du Monde</h1>
              <p className="text-3xl md:text-4xl font-bold text-[#fbbf24]">2026</p>
            </div>
            <span className="text-6xl md:text-8xl">⚽</span>
          </div>

          <div className="flex items-center justify-center gap-4 text-xl text-white/80 mb-4">
            <span>🇺🇸 USA</span>
            <span className="text-[#fbbf24]">•</span>
            <span>🇲🇽 Mexique</span>
            <span className="text-[#fbbf24]">•</span>
            <span>🇨🇦 Canada</span>
          </div>

          <p className="text-gray-400">11 juin - 19 juillet 2026 • 104 matchs • 48 équipes</p>
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
      <section className="sticky top-[7.5rem] md:top-16 z-30 bg-[#0a0a0f] border-b border-white/10 py-3 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {/* Time filters */}
            <button
              onClick={() => setFilters(f => ({ ...f, time: 'today' }))}
              className={`flex-shrink-0 min-h-[44px] px-4 py-2 rounded-full font-medium transition-all flex items-center gap-2 ${
                filters.time === 'today'
                  ? 'bg-[#fbbf24] text-black'
                  : 'bg-[#1e1e2e] text-gray-300 hover:bg-[#2a2a3a]'
              }`}
            >
              <span>📅</span>
              <span>Aujourd&apos;hui</span>
            </button>
            <button
              onClick={() => setFilters(f => ({ ...f, time: 'week' }))}
              className={`flex-shrink-0 min-h-[44px] px-4 py-2 rounded-full font-medium transition-all flex items-center gap-2 ${
                filters.time === 'week'
                  ? 'bg-[#fbbf24] text-black'
                  : 'bg-[#1e1e2e] text-gray-300 hover:bg-[#2a2a3a]'
              }`}
            >
              <span>📆</span>
              <span>Cette semaine</span>
            </button>
            <button
              onClick={() => setFilters(f => ({ ...f, time: 'all' }))}
              className={`flex-shrink-0 min-h-[44px] px-4 py-2 rounded-full font-medium transition-all flex items-center gap-2 ${
                filters.time === 'all'
                  ? 'bg-[#fbbf24] text-black'
                  : 'bg-[#1e1e2e] text-gray-300 hover:bg-[#2a2a3a]'
              }`}
            >
              <span>🌍</span>
              <span>Tous</span>
            </button>

            <div className="w-px bg-white/20 mx-1 flex-shrink-0" />

            {/* My teams filter */}
            <button
              onClick={() => setFilters(f => ({ ...f, myTeams: !f.myTeams }))}
              className={`flex-shrink-0 min-h-[44px] px-4 py-2 rounded-full font-medium transition-all flex items-center gap-2 ${
                filters.myTeams
                  ? 'bg-[#6366f1] text-white'
                  : 'bg-[#1e1e2e] text-gray-300 hover:bg-[#2a2a3a]'
              }`}
            >
              <span>⭐</span>
              <span>Mes équipes</span>
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
              className={`flex-shrink-0 min-h-[44px] px-4 py-2 rounded-full font-medium transition-all flex items-center gap-2 ${
                filters.toPredictOnly
                  ? 'bg-[#22c55e] text-white'
                  : 'bg-[#1e1e2e] text-gray-300 hover:bg-[#2a2a3a]'
              }`}
            >
              <span>✍️</span>
              <span>À pronostiquer</span>
              {toPredictCount > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  filters.toPredictOnly ? 'bg-white/20' : 'bg-[#22c55e]/30 text-[#22c55e]'
                }`}>
                  {toPredictCount}
                </span>
              )}
            </button>

            <div className="w-px bg-white/20 mx-1 flex-shrink-0" />

            {/* Time slot filters */}
            <button
              onClick={() => setFilters(f => ({ ...f, timeSlot: f.timeSlot === 'morning' ? 'all' : 'morning' }))}
              className={`flex-shrink-0 min-h-[44px] px-4 py-2 rounded-full font-medium transition-all flex items-center gap-2 ${
                filters.timeSlot === 'morning'
                  ? 'bg-[#f59e0b] text-black'
                  : 'bg-[#1e1e2e] text-gray-300 hover:bg-[#2a2a3a]'
              }`}
            >
              <span>🌅</span>
              <span>Matin</span>
            </button>
            <button
              onClick={() => setFilters(f => ({ ...f, timeSlot: f.timeSlot === 'afternoon' ? 'all' : 'afternoon' }))}
              className={`flex-shrink-0 min-h-[44px] px-4 py-2 rounded-full font-medium transition-all flex items-center gap-2 ${
                filters.timeSlot === 'afternoon'
                  ? 'bg-[#f59e0b] text-black'
                  : 'bg-[#1e1e2e] text-gray-300 hover:bg-[#2a2a3a]'
              }`}
            >
              <span>☀️</span>
              <span>Après-midi</span>
            </button>
            <button
              onClick={() => setFilters(f => ({ ...f, timeSlot: f.timeSlot === 'evening' ? 'all' : 'evening' }))}
              className={`flex-shrink-0 min-h-[44px] px-4 py-2 rounded-full font-medium transition-all flex items-center gap-2 ${
                filters.timeSlot === 'evening'
                  ? 'bg-[#f59e0b] text-black'
                  : 'bg-[#1e1e2e] text-gray-300 hover:bg-[#2a2a3a]'
              }`}
            >
              <span>🌙</span>
              <span>Soir</span>
            </button>
          </div>

          {/* Active filters summary */}
          {(filters.time !== 'all' || filters.myTeams || filters.toPredictOnly || filters.timeSlot !== 'all') && (
            <div className="flex items-center justify-between mt-2 text-sm">
              <span className="text-gray-400">
                {filteredMatches.length} match{filteredMatches.length > 1 ? 's' : ''} trouvé{filteredMatches.length > 1 ? 's' : ''}
              </span>
              <button
                onClick={() => setFilters({ time: 'all', myTeams: false, toPredictOnly: false, timeSlot: 'all' })}
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
            const { team1, team2 } = parseMatch(match.match);
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

                <div className="relative p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        {match.group && (
                          <span className="px-3 py-1 bg-[#fbbf24]/20 text-[#fbbf24] rounded-lg text-xs font-bold">{match.group}</span>
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

                      {/* Team names row */}
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-3xl">{getFlag(team1)}</span>
                          <span className="text-lg sm:text-xl font-bold text-white">{team1}</span>
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
                        <span className="text-gray-500 text-xl font-bold">VS</span>
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
                          <span className="text-lg sm:text-xl font-bold text-white">{team2}</span>
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
                            <div className="flex items-center gap-3">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={currentHome}
                                onChange={(e) => handleScoreChange(match.id, 'home', e.target.value)}
                                placeholder="?"
                                className={`w-16 h-16 text-center text-3xl font-black rounded-2xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-[#6366f1] ${
                                  currentHome
                                    ? 'bg-[#6366f1]/30 border-[#6366f1] text-white'
                                    : 'bg-[#1e1e2e] border-[#fbbf24]/50 text-[#fbbf24] placeholder-[#fbbf24]/50'
                                } ${isSaving ? 'opacity-50' : ''}`}
                                disabled={isSaving}
                              />
                              <span className="text-2xl text-gray-400 font-bold">-</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={currentAway}
                                onChange={(e) => handleScoreChange(match.id, 'away', e.target.value)}
                                placeholder="?"
                                className={`w-16 h-16 text-center text-3xl font-black rounded-2xl border-2 transition-all focus:outline-none focus:ring-2 focus:ring-[#6366f1] ${
                                  currentAway
                                    ? 'bg-[#6366f1]/30 border-[#6366f1] text-white'
                                    : 'bg-[#1e1e2e] border-[#fbbf24]/50 text-[#fbbf24] placeholder-[#fbbf24]/50'
                                } ${isSaving ? 'opacity-50' : ''}`}
                                disabled={isSaving}
                              />
                              {isSaving && (
                                <div className="animate-spin w-6 h-6 border-2 border-[#6366f1] border-t-transparent rounded-full" />
                              )}
                              {myPrediction && !editingThis && !isSaving && (
                                <span className="text-green-400 text-xl">✓</span>
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
                      </div>

                      {/* Auvio Button - visible 30min before to 2h30 after kickoff */}
                      {isInAuvioWindow(match) && (
                        <a
                          href="https://auvio.rtbf.be/categorie/sport~s-3/football~sc-32"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-[#e30613]/20 text-[#e30613] rounded-xl font-bold hover:bg-[#e30613]/30 transition-colors border border-[#e30613]/30 mb-3"
                        >
                          <span>📺</span>
                          <span>Regarder sur Auvio</span>
                        </a>
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

                  <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/10">
                    <span className="text-sm text-gray-400 font-medium">Tu regardes ?</span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleParticipation(match.id, 'yes')}
                        disabled={isLoading}
                        className={`px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${
                          myStatus === 'yes'
                            ? 'bg-[#22c55e] text-white shadow-lg shadow-[#22c55e]/30'
                            : 'bg-[#22c55e]/20 text-[#22c55e] hover:bg-[#22c55e]/30 border border-[#22c55e]/30'
                        } ${isLoading ? 'opacity-50' : ''}`}
                      >
                        <span>✓</span>
                        <span>Oui !</span>
                      </button>
                      <button
                        onClick={() => handleParticipation(match.id, 'maybe')}
                        disabled={isLoading}
                        className={`px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${
                          myStatus === 'maybe'
                            ? 'bg-[#fbbf24] text-black shadow-lg shadow-[#fbbf24]/30'
                            : 'bg-[#fbbf24]/20 text-[#fbbf24] hover:bg-[#fbbf24]/30 border border-[#fbbf24]/30'
                        } ${isLoading ? 'opacity-50' : ''}`}
                      >
                        <span>🤔</span>
                        <span>Peut-être</span>
                      </button>
                      <button
                        onClick={() => handleParticipation(match.id, 'no')}
                        disabled={isLoading}
                        className={`px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${
                          myStatus === 'no'
                            ? 'bg-[#ef4444] text-white shadow-lg shadow-[#ef4444]/30'
                            : 'bg-[#ef4444]/20 text-[#ef4444] hover:bg-[#ef4444]/30 border border-[#ef4444]/30'
                        } ${isLoading ? 'opacity-50' : ''}`}
                      >
                        <span>✗</span>
                        <span>Non</span>
                      </button>
                    </div>

                    <button
                      onClick={() => setExpandedMatch(isExpanded ? null : match.id)}
                      className="ml-auto px-4 py-2 bg-white/10 rounded-xl text-white/70 hover:text-white hover:bg-white/20 transition-all flex items-center gap-2"
                    >
                      <span>{isExpanded ? '▲' : '▼'}</span>
                      <span>{isExpanded ? 'Moins' : 'Détails'}</span>
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-6 pt-6 border-t border-white/10 space-y-6">
                      {/* All Predictions (visible after kickoff) */}
                      {isLocked && predState?.allPredictions && predState.allPredictions.length > 0 && (
                        <div>
                          <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                            <span>🎯</span>
                            Pronostics ({predState.allPredictions.length}/14)
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

                      {/* Before kickoff: show prediction count hint */}
                      {!isLocked && predState && (
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <span>🎯</span>
                          <span>{predState.totalPredictions}/14 ont déjà pronostiqué</span>
                          {!myPrediction && <span className="text-[#fbbf24]">— Fais ton prono !</span>}
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
          </div>
        )}
      </section>
    </div>
  );
}
