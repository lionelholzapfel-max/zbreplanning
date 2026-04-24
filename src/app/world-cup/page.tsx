'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import matches from '@/data/matches.json';
import { useSupabase, MatchParticipation, WatchLocation } from '@/hooks/useSupabase';
import { MEMBERS } from '@/data/members';

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

  const filteredMatches = useMemo(() => {
    return (matches as Match[]).filter(m => {
      const phaseMatch = m.phase.includes(selectedPhase) ||
        (selectedPhase === 'PHASE DE GROUPES' && m.phase === 'PHASE DE GROUPES') ||
        (selectedPhase === 'HUITIÈMES DE FINALE' && (m.phase.includes('HUITIÈME') || m.phase.includes('8E'))) ||
        (selectedPhase === 'QUARTS DE FINALE' && m.phase.includes('QUART')) ||
        (selectedPhase === 'DEMI-FINALES' && m.phase.includes('DEMI')) ||
        (selectedPhase === 'FINALE' && m.phase === 'FINALE');

      const groupMatch = !selectedGroup || m.group === `GROUPE ${selectedGroup}`;

      return phaseMatch && groupMatch;
    });
  }, [selectedPhase, selectedGroup]);

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
    }
  }, [currentUser, filteredMatches, loadMatchData]);

  const handleParticipation = async (matchId: number, status: 'yes' | 'no' | 'maybe') => {
    if (!currentUser) return;
    setLoadingMatch(matchId);

    await setMatchParticipation(matchId, status);
    const parts = await getMatchParticipations(matchId);
    setParticipations(prev => ({ ...prev, [matchId]: parts }));

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

      {/* Matches */}
      <section className="max-w-7xl mx-auto px-4 pb-12">
        <div className="space-y-4">
          {filteredMatches.map((match, index) => {
            const myStatus = getMyStatus(match.id);
            const yesCount = getParticipantCount(match.id, 'yes');
            const maybeCount = getParticipantCount(match.id, 'maybe');
            const isExpanded = expandedMatch === match.id;
            const matchLocations = locations[match.id] || [];
            const matchParticipants = participations[match.id] || [];
            const { team1, team2 } = parseMatch(match.match);
            const isLoading = loadingMatch === match.id;

            return (
              <div
                key={match.id}
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
                      <div className="flex items-center gap-2 mb-3">
                        {match.group && (
                          <span className="px-3 py-1 bg-[#fbbf24]/20 text-[#fbbf24] rounded-lg text-xs font-bold">{match.group}</span>
                        )}
                        <span className="px-3 py-1 bg-white/10 text-white/70 rounded-lg text-xs">Match #{match.id}</span>
                      </div>

                      <div className="flex items-center gap-4 mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{getFlag(team1)}</span>
                          <span className="text-xl font-bold text-white">{team1}</span>
                        </div>
                        <div className="px-4 py-2 bg-[#fbbf24]/20 rounded-xl">
                          <span className="text-[#fbbf24] font-bold">VS</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xl font-bold text-white">{team2}</span>
                          <span className="text-3xl">{getFlag(team2)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        <span className="flex items-center gap-2 text-gray-300">
                          <span className="text-lg">📅</span>
                          <span className="font-medium">{match.dateDisplay}</span>
                        </span>
                        <span className="flex items-center gap-2 text-[#fbbf24]">
                          <span className="text-lg">⏰</span>
                          <span className="font-bold">{match.time}</span>
                        </span>
                        <span className="flex items-center gap-2 text-gray-400">
                          <span className="text-lg">📍</span>
                          <span>{match.city}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Confirmed Badge */}
                      {yesCount >= 5 && (
                        <div className="px-3 py-1.5 bg-[#22c55e] text-white text-sm font-bold rounded-xl flex items-center gap-1.5 shadow-lg shadow-[#22c55e]/30">
                          <span>✓</span> Confirmé !
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
                      <div>
                        <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                          <span>👥</span>
                          Qui regarde ce match ?
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {matchParticipants.filter(p => p.status === 'yes').map(p => (
                            <div key={p.id} className="flex items-center gap-2 px-3 py-2 bg-[#22c55e]/20 rounded-xl border border-[#22c55e]/30">
                              <div className="w-8 h-8 rounded-full overflow-hidden relative ring-2 ring-[#22c55e]">
                                <Image src={`/members/${p.users?.member_slug || 'default'}.png`} alt="" fill className="object-cover" />
                              </div>
                              <span className="text-sm font-medium text-[#22c55e]">{p.users?.member_name?.split(' ')[0]}</span>
                              <span className="text-[#22c55e]">✓</span>
                            </div>
                          ))}
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
