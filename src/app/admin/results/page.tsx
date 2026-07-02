'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import matches from '@/data/matches.json';
import { toast } from 'sonner';

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

interface MatchResult {
  match_id: number;
  home_score: number;
  away_score: number;
}

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

export default function AdminResultsPage() {
  const router = useRouter();
  const [results, setResults] = useState<Record<number, MatchResult>>({});
  const [editingMatch, setEditingMatch] = useState<number | null>(null);
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Get matches that are past their start time
  const pastMatches = useMemo(() => {
    const now = new Date();
    return (matches as Match[]).filter(m => {
      const [year, month, day] = m.date.split('-').map(Number);
      const [hours, minutes] = m.time.split(':').map(Number);
      const kickoff = new Date(year, month - 1, day, hours, minutes);
      return now >= kickoff;
    }).sort((a, b) => {
      // Sort by date descending (most recent first)
      const dateA = new Date(a.date + 'T' + a.time);
      const dateB = new Date(b.date + 'T' + b.time);
      return dateB.getTime() - dateA.getTime();
    });
  }, []);

  // Matches without results
  const matchesWithoutResults = useMemo(() => {
    return pastMatches.filter(m => !results[m.id]);
  }, [pastMatches, results]);

  // Matches with results
  const matchesWithResults = useMemo(() => {
    return pastMatches.filter(m => results[m.id]);
  }, [pastMatches, results]);

  useEffect(() => {
    async function checkAdmin() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        if (!data.user?.is_admin) {
          toast.error('Acces reserve aux administrateurs');
          router.push('/');
          return;
        }
        setIsAdmin(true);
      } catch {
        router.push('/login');
      }
    }
    checkAdmin();
  }, [router]);

  useEffect(() => {
    async function loadResults() {
      try {
        const res = await fetch('/api/results');
        if (res.ok) {
          const data = await res.json();
          const resultsMap: Record<number, MatchResult> = {};
          (data.results || []).forEach((r: MatchResult) => {
            resultsMap[r.match_id] = r;
          });
          setResults(resultsMap);
        }
      } catch (err) {
        console.error('Error loading results:', err);
      } finally {
        setLoading(false);
      }
    }
    if (isAdmin) {
      loadResults();
    }
  }, [isAdmin]);

  const handleEditMatch = (matchId: number) => {
    const existing = results[matchId];
    setEditingMatch(matchId);
    setHomeScore(existing?.home_score?.toString() || '');
    setAwayScore(existing?.away_score?.toString() || '');
  };

  const handleSaveResult = async () => {
    if (!editingMatch) return;
    if (homeScore === '' || awayScore === '') {
      toast.error('Les deux scores sont requis');
      return;
    }

    const home = parseInt(homeScore, 10);
    const away = parseInt(awayScore, 10);

    if (isNaN(home) || isNaN(away) || home < 0 || away < 0 || home > 20 || away > 20) {
      toast.error('Scores invalides (0-20)');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_id: editingMatch,
          home_score: home,
          away_score: away,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de l\'enregistrement');
        return;
      }

      toast.success(`Résultat enregistré — ${data.points_calculated} points calculés`);

      setResults(prev => ({
        ...prev,
        [editingMatch]: { match_id: editingMatch, home_score: home, away_score: away },
      }));

      setEditingMatch(null);
      setHomeScore('');
      setAwayScore('');
    } catch (err) {
      console.error('Error saving result:', err);
      toast.error('Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingMatch(null);
    setHomeScore('');
    setAwayScore('');
  };

  if (!isAdmin || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#6366f1] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar />

      {/* Hero */}
      <section className="relative py-12 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#ef4444]/20 via-[#6366f1]/10 to-transparent" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#ef4444]/10 rounded-full blur-3xl" />

        <div className="max-w-4xl mx-auto relative">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <span className="text-5xl">🎯</span>
              <h1 className="text-4xl md:text-5xl font-black">
                <span className="text-white">Admin</span>
                <span className="bg-gradient-to-r from-[#ef4444] to-[#f59e0b] bg-clip-text text-transparent"> Résultats</span>
              </h1>
            </div>
            <p className="text-gray-400 text-lg">Entrer les scores des matchs termines</p>
          </div>
        </div>
      </section>

      {/* Matches without results */}
      {matchesWithoutResults.length > 0 && (
        <section className="max-w-4xl mx-auto px-4 pb-8">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>⚠️</span>
            Matchs sans résultat ({matchesWithoutResults.length})
          </h2>

          <div className="space-y-3">
            {matchesWithoutResults.map(match => {
              const { team1, team2 } = parseMatch(match.match);
              const isEditing = editingMatch === match.id;

              return (
                <div
                  key={match.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isEditing
                      ? 'bg-[#6366f1]/10 border-[#6366f1]/50'
                      : 'bg-[#12121a] border-[#ef4444]/30 hover:border-[#ef4444]/50'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="text-2xl">{getFlag(team1)}</span>
                      <span className="font-bold text-white">{team1}</span>
                    </div>

                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={homeScore}
                          onChange={(e) => setHomeScore(e.target.value.replace(/\D/g, '').slice(0, 2))}
                          placeholder="0"
                          className="w-14 h-14 text-center text-2xl font-black bg-[#1e1e2e] border-2 border-[#6366f1] rounded-xl text-white focus:outline-none"
                          autoFocus
                        />
                        <span className="text-gray-400 text-xl">-</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={awayScore}
                          onChange={(e) => setAwayScore(e.target.value.replace(/\D/g, '').slice(0, 2))}
                          placeholder="0"
                          className="w-14 h-14 text-center text-2xl font-black bg-[#1e1e2e] border-2 border-[#6366f1] rounded-xl text-white focus:outline-none"
                        />
                        <button
                          onClick={handleSaveResult}
                          disabled={saving}
                          className="px-4 py-2 bg-[#22c55e] text-white rounded-xl font-bold hover:bg-[#16a34a] transition-all disabled:opacity-50"
                        >
                          {saving ? '...' : '✅'}
                        </button>
                        <button
                          onClick={handleCancel}
                          className="px-4 py-2 bg-gray-600 text-white rounded-xl font-bold hover:bg-gray-500 transition-all"
                        >
                          ✖
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEditMatch(match.id)}
                        className="px-6 py-3 bg-[#ef4444]/20 text-[#ef4444] rounded-xl font-bold hover:bg-[#ef4444]/30 border border-[#ef4444]/30 transition-all"
                      >
                        Entrer score
                      </button>
                    )}

                    <div className="flex items-center gap-3 flex-1 justify-end">
                      <span className="font-bold text-white">{team2}</span>
                      <span className="text-2xl">{getFlag(team2)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-sm text-gray-400">
                    <span>{match.dateDisplay}</span>
                    <span>{match.time}</span>
                    {match.group && <span className="text-[#fbbf24]">{match.group}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Matches with results */}
      {matchesWithResults.length > 0 && (
        <section className="max-w-4xl mx-auto px-4 pb-12">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>✅</span>
            Matchs avec résultat ({matchesWithResults.length})
          </h2>

          <div className="space-y-2">
            {matchesWithResults.map(match => {
              const { team1, team2 } = parseMatch(match.match);
              const result = results[match.id];
              const isEditing = editingMatch === match.id;

              return (
                <div
                  key={match.id}
                  className={`p-3 rounded-xl border transition-all ${
                    isEditing
                      ? 'bg-[#6366f1]/10 border-[#6366f1]/50'
                      : 'bg-[#12121a] border-[#22c55e]/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{getFlag(team1)}</span>
                    <span className="font-medium text-white flex-1">{team1}</span>

                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={homeScore}
                          onChange={(e) => setHomeScore(e.target.value.replace(/\D/g, '').slice(0, 2))}
                          className="w-10 h-10 text-center text-lg font-black bg-[#1e1e2e] border-2 border-[#6366f1] rounded-lg text-white focus:outline-none"
                        />
                        <span className="text-gray-400">-</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={awayScore}
                          onChange={(e) => setAwayScore(e.target.value.replace(/\D/g, '').slice(0, 2))}
                          className="w-10 h-10 text-center text-lg font-black bg-[#1e1e2e] border-2 border-[#6366f1] rounded-lg text-white focus:outline-none"
                        />
                        <button
                          onClick={handleSaveResult}
                          disabled={saving}
                          className="px-3 py-1.5 bg-[#22c55e] text-white rounded-lg text-sm font-bold"
                        >
                          {saving ? '...' : '✅'}
                        </button>
                        <button
                          onClick={handleCancel}
                          className="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-sm font-bold"
                        >
                          ✖
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEditMatch(match.id)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-[#22c55e]/20 rounded-lg border border-[#22c55e]/30 hover:bg-[#22c55e]/30 transition-all"
                      >
                        <span className="text-lg font-bold text-white">{result?.home_score}</span>
                        <span className="text-gray-400">-</span>
                        <span className="text-lg font-bold text-white">{result?.away_score}</span>
                      </button>
                    )}

                    <span className="font-medium text-white flex-1 text-right">{team2}</span>
                    <span className="text-xl">{getFlag(team2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* No past matches */}
      {pastMatches.length === 0 && (
        <section className="max-w-4xl mx-auto px-4 pb-12 text-center">
          <span className="text-6xl mb-4 block">⏳</span>
          <p className="text-gray-400 text-lg">Aucun match n&apos;a encore eu lieu</p>
          <p className="text-gray-500">Revenez après le début du tournoi</p>
        </section>
      )}

      {/* Tournament Results Section */}
      <TournamentResultsSection />
    </div>
  );
}

// Tournament Results Component
function TournamentResultsSection() {
  const [results, setResults] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const categories = [
    { type: 'winner', title: 'Vainqueur', emoji: '🏆', description: 'Équipe championne du monde' },
    { type: 'best_player', title: 'Meilleur joueur', emoji: '⭐', description: 'MVP du tournoi (Ballon d\'Or)' },
    { type: 'best_young', title: 'Meilleur jeune', emoji: '🌟', description: 'Meilleur joueur U23' },
    { type: 'surprise_team', title: 'Équipe surprise', emoji: '🎯', description: 'Dark horse officiel' },
  ];

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/tournament-results');
        if (res.ok) {
          const data = await res.json();
          const map: Record<string, string> = {};
          (data.results || []).forEach((r: { prediction_type: string; result_value: string }) => {
            map[r.prediction_type] = r.result_value;
          });
          setResults(map);
        }
      } catch (err) {
        console.error('Error loading tournament results:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async (type: string) => {
    if (!inputValue.trim()) return;

    setSaving(true);
    try {
      const res = await fetch('/api/admin/tournament-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prediction_type: type, result_value: inputValue.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Erreur');
        return;
      }

      toast.success(
        `${categories.find(c => c.type === type)?.title} enregistré ! ${data.winners?.length || 0} membre(s) ont gagné +20 pts`,
        { icon: '🎉', duration: 5000 }
      );

      setResults(prev => ({ ...prev, [type]: inputValue.trim() }));
      setEditing(null);
      setInputValue('');
    } catch (err) {
      console.error('Error saving:', err);
      toast.error('Erreur de connexion');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse text-center text-gray-500">Chargement...</div>
      </section>
    );
  }

  return (
    <section className="max-w-4xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
        <span>🏆</span>
        Résultats du tournoi
        <span className="text-sm font-normal text-gray-400">(+20 pts par prono correct)</span>
      </h2>

      <div className="grid gap-4">
        {categories.map(cat => {
          const value = results[cat.type];
          const isEditing = editing === cat.type;

          return (
            <div
              key={cat.type}
              className="p-4 rounded-xl border border-white/10 bg-[#1e1e2e] flex items-center gap-4"
            >
              <span className="text-3xl">{cat.emoji}</span>

              <div className="flex-1">
                <h3 className="font-bold text-white">{cat.title}</h3>
                <p className="text-xs text-gray-500">{cat.description}</p>
              </div>

              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={value || 'Entrer le résultat...'}
                    className="px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#fbbf24]"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSave(cat.type)}
                    disabled={saving || !inputValue.trim()}
                    className="px-3 py-2 bg-[#22c55e] hover:bg-[#16a34a] text-white rounded-lg font-medium disabled:opacity-50"
                  >
                    {saving ? '...' : '✓'}
                  </button>
                  <button
                    onClick={() => { setEditing(null); setInputValue(''); }}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg"
                  >
                    ✕
                  </button>
                </div>
              ) : value ? (
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1.5 bg-[#22c55e]/20 border border-[#22c55e]/30 rounded-lg text-[#22c55e] font-medium">
                    {value}
                  </span>
                  <button
                    onClick={() => { setEditing(cat.type); setInputValue(value); }}
                    className="text-gray-400 hover:text-white"
                  >
                    ✏️
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditing(cat.type)}
                  className="px-4 py-2 bg-[#fbbf24]/20 hover:bg-[#fbbf24]/30 border border-[#fbbf24]/30 rounded-lg text-[#fbbf24] text-sm"
                >
                  + Entrer
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-gray-500 text-center">
        💡 À chaque saisie, les membres ayant pronostiqué correctement reçoivent automatiquement +20 points
      </p>
    </section>
  );
}
