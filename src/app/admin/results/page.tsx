'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import matches from '@/data/matches.json';
import { toast } from 'sonner';
import { PageHeader, Spinner } from '@/components/ui';
import { useTeamOverrides } from '@/hooks/useTeamOverrides';

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
  const { getTeamNames } = useTeamOverrides();
  const [showAllHistory, setShowAllHistory] = useState(false);
  const HISTORY_LIMIT = 20;

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

  // Recent results first; the rest sits behind "Voir tout l'historique".
  const visibleWithResults = showAllHistory ? matchesWithResults : matchesWithResults.slice(0, HISTORY_LIMIT);
  const hiddenResultsCount = matchesWithResults.length - visibleWithResults.length;

  if (!isAdmin || loading) {
    return (
      <div className="min-h-screen bg-[var(--canvas)] flex items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--canvas)] pb-24">
      <Navbar />

      {/* Header */}
      <section className="max-w-4xl mx-auto px-4 pt-8">
        <PageHeader title="Admin — Résultats" subtitle="Entrer les scores des matchs terminés" />
      </section>

      {/* Matches without results */}
      {matchesWithoutResults.length > 0 && (
        <section className="max-w-4xl mx-auto px-4 pb-8 pt-2">
          <p className="eyebrow mb-3">Matchs sans résultat · {matchesWithoutResults.length}</p>
          <div className="rounded-[10px] bg-[var(--surface-1)] top-light overflow-hidden">
            {matchesWithoutResults.map(match => {
              const def = parseMatch(match.match);
              const { home: team1, away: team2 } = getTeamNames(match.id, def.team1, def.team2);
              const isEditing = editingMatch === match.id;

              return (
                <div key={match.id} className="px-4 py-3 border-b border-[var(--hairline)] last:border-b-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-lg shrink-0">{getFlag(team1)}</span>
                      <span className="text-[14px] font-medium text-[var(--text-primary)] truncate">{team1}</span>
                    </div>

                    {isEditing ? (
                      <div className="flex items-center gap-2 shrink-0 order-last w-full sm:w-auto sm:order-none">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={homeScore}
                          onChange={(e) => setHomeScore(e.target.value.replace(/\D/g, '').slice(0, 2))}
                          placeholder="–"
                          className="w-11 h-11 text-center score text-[20px] rounded-[8px] bg-[var(--surface-2)] border border-[var(--hairline)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)] focus:border-[var(--accent)]"
                          autoFocus
                        />
                        <span className="score text-[16px] text-[var(--text-tertiary)]">:</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={awayScore}
                          onChange={(e) => setAwayScore(e.target.value.replace(/\D/g, '').slice(0, 2))}
                          placeholder="–"
                          className="w-11 h-11 text-center score text-[20px] rounded-[8px] bg-[var(--surface-2)] border border-[var(--hairline)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)] focus:border-[var(--accent)]"
                        />
                        <button onClick={handleSaveResult} disabled={saving} className="h-9 px-3 rounded-[8px] bg-[var(--accent)] text-[#0A0C0B] text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50">{saving ? '…' : 'Valider'}</button>
                        <button onClick={handleCancel} className="h-9 px-3 rounded-[8px] bg-[var(--surface-2)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Annuler</button>
                      </div>
                    ) : (
                      <button onClick={() => handleEditMatch(match.id)} className="shrink-0 h-10 sm:h-8 px-3 rounded-[8px] text-[13px] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">Entrer score</button>
                    )}

                    <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                      <span className="text-[14px] font-medium text-[var(--text-primary)] truncate text-right">{team2}</span>
                      <span className="text-lg shrink-0">{getFlag(team2)}</span>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-3 text-[12px] text-[var(--text-tertiary)]">
                    <span>{match.dateDisplay}</span>
                    <span className="score">{match.time}</span>
                    {match.group && <span>{match.group}</span>}
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
          <p className="eyebrow mb-3">{showAllHistory ? `Tous les résultats · ${matchesWithResults.length}` : `Derniers résultats · ${visibleWithResults.length}`}</p>
          <div className="rounded-[10px] bg-[var(--surface-1)] top-light overflow-hidden">
            {visibleWithResults.map(match => {
              const def = parseMatch(match.match);
              const { home: team1, away: team2 } = getTeamNames(match.id, def.team1, def.team2);
              const result = results[match.id];
              const isEditing = editingMatch === match.id;

              return (
                <div key={match.id} className="flex flex-wrap items-center gap-2 sm:gap-3 px-4 py-2.5 border-b border-[var(--hairline)] last:border-b-0">
                  <span className="text-sm sm:text-base shrink-0">{getFlag(team1)}</span>
                  <span className="text-[14px] text-[var(--text-primary)] flex-1 min-w-0 truncate">{team1}</span>

                  {isEditing ? (
                    <div className="flex items-center gap-2 shrink-0 order-last w-full sm:w-auto sm:order-none">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={homeScore}
                        onChange={(e) => setHomeScore(e.target.value.replace(/\D/g, '').slice(0, 2))}
                        className="w-12 h-12 sm:w-10 sm:h-10 text-center score text-[18px] rounded-[8px] bg-[var(--surface-2)] border border-[var(--hairline)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)] focus:border-[var(--accent)]"
                      />
                      <span className="score text-[var(--text-tertiary)]">:</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={awayScore}
                        onChange={(e) => setAwayScore(e.target.value.replace(/\D/g, '').slice(0, 2))}
                        className="w-12 h-12 sm:w-10 sm:h-10 text-center score text-[18px] rounded-[8px] bg-[var(--surface-2)] border border-[var(--hairline)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)] focus:border-[var(--accent)]"
                      />
                      <button onClick={handleSaveResult} disabled={saving} className="h-10 sm:h-8 px-3 rounded-[8px] bg-[var(--accent)] text-[#0A0C0B] text-[13px] font-medium hover:opacity-90 disabled:opacity-50">{saving ? '…' : 'OK'}</button>
                      <button onClick={handleCancel} className="h-10 sm:h-8 px-3 rounded-[8px] bg-[var(--surface-2)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Annuler</button>
                    </div>
                  ) : (
                    <button onClick={() => handleEditMatch(match.id)} className="shrink-0 inline-flex items-center gap-1.5 h-10 sm:h-8 px-3 rounded-[8px] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] transition-colors">
                      <span className="score text-[15px] text-[var(--text-primary)]">{result?.home_score}</span>
                      <span className="text-[var(--text-tertiary)]">:</span>
                      <span className="score text-[15px] text-[var(--text-primary)]">{result?.away_score}</span>
                    </button>
                  )}

                  <span className="text-[14px] text-[var(--text-primary)] flex-1 min-w-0 truncate text-right">{team2}</span>
                  <span className="text-sm sm:text-base shrink-0">{getFlag(team2)}</span>
                </div>
              );
            })}
          </div>
          {hiddenResultsCount > 0 && (
            <button
              onClick={() => setShowAllHistory(true)}
              className="mt-3 w-full h-11 sm:h-10 rounded-[8px] bg-[var(--surface-2)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Voir tout l&apos;historique · {hiddenResultsCount} de plus
            </button>
          )}
          {showAllHistory && matchesWithResults.length > HISTORY_LIMIT && (
            <button
              onClick={() => setShowAllHistory(false)}
              className="mt-3 w-full h-11 sm:h-10 rounded-[8px] text-[13px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
            >
              Réduire
            </button>
          )}
        </section>
      )}

      {/* No past matches */}
      {pastMatches.length === 0 && (
        <section className="max-w-4xl mx-auto px-4 pb-12 py-16 text-center">
          <p className="text-[var(--text-secondary)] font-medium">Aucun match n&apos;a encore eu lieu</p>
          <p className="mt-1 text-[13px] text-[var(--text-tertiary)]">Reviens après le début du tournoi.</p>
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
        <div className="flex justify-center py-6"><Spinner size={20} /></div>
      </section>
    );
  }

  return (
    <section className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-4 flex items-baseline gap-3">
        <h2 className="display text-[22px] text-[var(--text-primary)]">Résultats du tournoi</h2>
        <span className="text-[12px] text-[var(--text-tertiary)]">+20 pts par prono correct</span>
      </div>

      <div className="rounded-[10px] bg-[var(--surface-1)] top-light overflow-hidden">
        {categories.map(cat => {
          const value = results[cat.type];
          const isEditing = editing === cat.type;

          return (
            <div key={cat.type} className="flex items-center gap-4 px-4 py-3 border-b border-[var(--hairline)] last:border-b-0">
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[var(--text-primary)]">{cat.title}</p>
                <p className="text-[12px] text-[var(--text-tertiary)]">{cat.description}</p>
              </div>

              {isEditing ? (
                <div className="flex items-center gap-2 shrink-0">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={value || 'Résultat…'}
                    className="h-9 px-3 rounded-[8px] bg-[var(--surface-2)] border border-[var(--hairline)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)] focus:border-[var(--accent)]"
                    autoFocus
                  />
                  <button onClick={() => handleSave(cat.type)} disabled={saving || !inputValue.trim()} className="h-9 px-3 rounded-[8px] bg-[var(--accent)] text-[#0A0C0B] text-[13px] font-medium hover:opacity-90 disabled:opacity-50">{saving ? '…' : 'OK'}</button>
                  <button onClick={() => { setEditing(null); setInputValue(''); }} className="h-9 px-3 rounded-[8px] bg-[var(--surface-2)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Annuler</button>
                </div>
              ) : value ? (
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[14px] font-medium text-[var(--accent)]">{value}</span>
                  <button onClick={() => { setEditing(cat.type); setInputValue(value); }} className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">Modifier</button>
                </div>
              ) : (
                <button onClick={() => setEditing(cat.type)} className="shrink-0 h-10 sm:h-8 px-3 rounded-[8px] text-[13px] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">Entrer</button>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[12px] text-[var(--text-tertiary)]">
        À chaque saisie, les membres ayant pronostiqué correctement reçoivent +20 points.
      </p>
    </section>
  );
}
