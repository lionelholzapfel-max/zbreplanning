'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { MEMBERS } from '@/data/members';
import { useSupabase, PredictionType, Prediction } from '@/hooks/useSupabase';
import { toast } from 'sonner';
import { PageHeader, Badge, Avatar } from '@/components/ui';
import { Trophy, Target, Shield, Star, Sparkles, Rocket, Lock, type LucideIcon } from 'lucide-react';

// World Cup 2026 Teams - 48 équipes (qualifiées + probables)
const TEAMS = [
  // Hôtes (qualifiés automatiquement)
  { name: 'USA', flag: '🇺🇸' },
  { name: 'Mexique', flag: '🇲🇽' },
  { name: 'Canada', flag: '🇨🇦' },
  // Europe (16 places)
  { name: 'France', flag: '🇫🇷' },
  { name: 'Angleterre', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { name: 'Espagne', flag: '🇪🇸' },
  { name: 'Allemagne', flag: '🇩🇪' },
  { name: 'Portugal', flag: '🇵🇹' },
  { name: 'Belgique', flag: '🇧🇪' },
  { name: 'Pays-Bas', flag: '🇳🇱' },
  { name: 'Italie', flag: '🇮🇹' },
  { name: 'Croatie', flag: '🇭🇷' },
  { name: 'Suisse', flag: '🇨🇭' },
  { name: 'Danemark', flag: '🇩🇰' },
  { name: 'Autriche', flag: '🇦🇹' },
  { name: 'Ukraine', flag: '🇺🇦' },
  { name: 'Serbie', flag: '🇷🇸' },
  { name: 'Pologne', flag: '🇵🇱' },
  { name: 'Turquie', flag: '🇹🇷' },
  { name: 'Écosse', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  { name: 'Slovénie', flag: '🇸🇮' },
  // Amérique du Sud (6 places)
  { name: 'Argentine', flag: '🇦🇷' },
  { name: 'Brésil', flag: '🇧🇷' },
  { name: 'Uruguay', flag: '🇺🇾' },
  { name: 'Colombie', flag: '🇨🇴' },
  { name: 'Équateur', flag: '🇪🇨' },
  { name: 'Paraguay', flag: '🇵🇾' },
  { name: 'Chili', flag: '🇨🇱' },
  { name: 'Venezuela', flag: '🇻🇪' },
  // Afrique (9 places)
  { name: 'Maroc', flag: '🇲🇦' },
  { name: 'Sénégal', flag: '🇸🇳' },
  { name: 'Nigeria', flag: '🇳🇬' },
  { name: 'Égypte', flag: '🇪🇬' },
  { name: 'Cameroun', flag: '🇨🇲' },
  { name: 'Algérie', flag: '🇩🇿' },
  { name: 'Côte d\'Ivoire', flag: '🇨🇮' },
  { name: 'Ghana', flag: '🇬🇭' },
  { name: 'Tunisie', flag: '🇹🇳' },
  { name: 'Mali', flag: '🇲🇱' },
  { name: 'Afrique du Sud', flag: '🇿🇦' },
  // Asie (8 places)
  { name: 'Japon', flag: '🇯🇵' },
  { name: 'Corée du Sud', flag: '🇰🇷' },
  { name: 'Australie', flag: '🇦🇺' },
  { name: 'Iran', flag: '🇮🇷' },
  { name: 'Arabie Saoudite', flag: '🇸🇦' },
  { name: 'Qatar', flag: '🇶🇦' },
  { name: 'Irak', flag: '🇮🇶' },
  { name: 'Ouzbékistan', flag: '🇺🇿' },
  { name: 'Chine', flag: '🇨🇳' },
  // CONCACAF (hors hôtes)
  { name: 'Panama', flag: '🇵🇦' },
  { name: 'Costa Rica', flag: '🇨🇷' },
  { name: 'Jamaïque', flag: '🇯🇲' },
  // Océanie
  { name: 'Nouvelle-Zélande', flag: '🇳🇿' },
];

// Famous players - Candidats Ballon d'Or / Meilleur joueur CDM
const PLAYERS = [
  // Attaquants stars
  'Kylian Mbappé',
  'Erling Haaland',
  'Vinicius Jr',
  'Harry Kane',
  'Lionel Messi',
  'Cristiano Ronaldo',
  'Mohamed Salah',
  'Lautaro Martínez',
  'Victor Osimhen',
  'Julián Álvarez',
  'Darwin Núñez',
  'Randal Kolo Muani',
  'Marcus Rashford',
  'Rafael Leão',
  'Khvicha Kvaratskhelia',
  // Milieux offensifs
  'Jude Bellingham',
  'Kevin De Bruyne',
  'Bruno Fernandes',
  'Cole Palmer',
  'Bukayo Saka',
  'Phil Foden',
  'Jamal Musiala',
  'Florian Wirtz',
  'Lamine Yamal',
  'Pedri',
  'Martin Ødegaard',
  'Bernardo Silva',
  'Antoine Griezmann',
  'Ousmane Dembélé',
  'Leroy Sané',
  // Milieux défensifs
  'Rodri',
  'Aurélien Tchouaméni',
  'N\'Golo Kanté',
  'Declan Rice',
  'Federico Valverde',
  'Toni Kroos',
  'Eduardo Camavinga',
  // Défenseurs
  'Rúben Dias',
  'Virgil van Dijk',
  'William Saliba',
  'Antonio Rüdiger',
  'Achraf Hakimi',
  'Theo Hernández',
  'João Cancelo',
];

// Top scorers candidates - Buteurs potentiels
const STRIKERS = [
  'Kylian Mbappé',
  'Erling Haaland',
  'Harry Kane',
  'Vinicius Jr',
  'Lautaro Martínez',
  'Victor Osimhen',
  'Julián Álvarez',
  'Darwin Núñez',
  'Randal Kolo Muani',
  'Marcus Rashford',
  'Rafael Leão',
  'Lionel Messi',
  'Cristiano Ronaldo',
  'Mohamed Salah',
  'Romelu Lukaku',
  'Olivier Giroud',
  'Dusan Vlahovic',
  'Alexander Isak',
  'Ivan Toney',
  'Cody Gakpo',
  'Memphis Depay',
  'Antoine Griezmann',
  'Kai Havertz',
  'Rasmus Højlund',
  'Benjamin Šeško',
  'Alvaro Morata',
  'Karim Benzema',
  'Robert Lewandowski',
];

// Goalkeepers - Meilleurs gardiens
const GOALKEEPERS = [
  'Thibaut Courtois',
  'Alisson Becker',
  'Ederson',
  'Mike Maignan',
  'Gianluigi Donnarumma',
  'Manuel Neuer',
  'Marc-André ter Stegen',
  'Jan Oblak',
  'Emiliano Martínez',
  'Jordan Pickford',
  'Yann Sommer',
  'Kepa Arrizabalaga',
  'Andriy Lunin',
  'Gregor Kobel',
  'David Raya',
  'Bono (Yassine Bounou)',
  'Diogo Costa',
  'Dominik Livakovic',
  'Wojciech Szczęsny',
  'Kasper Schmeichel',
  'Hugo Lloris',
  'Unai Simón',
];

// Young players (U23) - Nés après le 1er janvier 2003
const YOUNG_PLAYERS = [
  'Lamine Yamal',
  'Florian Wirtz',
  'Jude Bellingham',
  'Jamal Musiala',
  'Endrick',
  'Kobbie Mainoo',
  'Warren Zaïre-Emery',
  'Pau Cubarsí',
  'Alejandro Garnacho',
  'Mathys Tel',
  'Arda Güler',
  'Savinho',
  'João Neves',
  'Adam Wharton',
  'Désiré Doué',
  'Benjamin Šeško',
  'Xavi Simons',
  'Gavi',
  'Pedri',
  'Cole Palmer',
  'Evan Ferguson',
  'Kaoru Mitoma',
  'Moisés Caicedo',
  'Romeo Lavia',
  'Josko Gvardiol',
  'Jurriën Timber',
  'Eduardo Camavinga',
  'Aurélien Tchouaméni',
  'Khvicha Kvaratskhelia',
  'Yeremy Pino',
  'Nico Williams',
  'Rasmus Højlund',
  'Amadou Onana',
  'Ibrahima Konaté',
  'Wesley Fofana',
  'Castello Lukeba',
];

const PREDICTION_CATEGORIES: { type: PredictionType; title: string; icon: LucideIcon; description: string }[] = [
  { type: 'winner', title: 'Vainqueur', icon: Trophy, description: 'Qui va soulever la coupe ?' },
  { type: 'top_scorer', title: 'Meilleur buteur', icon: Target, description: 'Qui va marquer le plus ?' },
  { type: 'best_goalkeeper', title: 'Meilleur gardien', icon: Shield, description: 'Le mur du tournoi' },
  { type: 'best_player', title: 'Meilleur joueur', icon: Star, description: 'MVP du tournoi' },
  { type: 'best_young', title: 'Meilleur jeune', icon: Sparkles, description: 'Révélation U23' },
  { type: 'surprise_team', title: 'Équipe surprise', icon: Rocket, description: 'Dark horse du tournoi' },
];

// Community Stats Component
function CommunityStats({ predictions }: { predictions: Prediction[] }) {
  // Calculate most popular prediction for each category
  const stats = PREDICTION_CATEGORIES.map(cat => {
    const catPreds = predictions.filter(p => p.prediction_type === cat.type);
    if (catPreds.length === 0) return null;

    // Count occurrences
    const counts: Record<string, number> = {};
    catPreds.forEach(p => {
      counts[p.prediction_value] = (counts[p.prediction_value] || 0) + 1;
    });

    // Find the most popular
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return null;

    const [topValue, topCount] = sorted[0];
    const totalPredictions = catPreds.length;

    return {
      type: cat.type,
      title: cat.title,
      topValue,
      topCount,
      total: totalPredictions,
      percentage: Math.round((topCount / MEMBERS.length) * 100),
    };
  }).filter(Boolean);

  if (stats.length === 0) return null;

  // Get team flags for display
  const getFlag = (name: string) => {
    const team = TEAMS.find(t => t.name === name);
    return team?.flag || '';
  };

  return (
    <section className="max-w-7xl mx-auto px-4 py-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(stat => stat && (
          <div key={stat.type} className="rounded-[10px] bg-[var(--surface-1)] top-light p-4">
            <p className="eyebrow">{stat.title}</p>
            <div className="mt-2 flex items-center gap-1.5 min-w-0">
              {(stat.type === 'winner' || stat.type === 'surprise_team') && (
                <span className="shrink-0">{getFlag(stat.topValue)}</span>
              )}
              <span className="text-[15px] font-medium text-[var(--text-primary)] truncate">{stat.topValue}</span>
            </div>
            <p className="mt-2">
              <span className="score text-[20px] text-[var(--text-primary)]">{stat.topCount}</span>
              <span className="ml-1 text-[12px] text-[var(--text-tertiary)]">/{MEMBERS.length} · {stat.percentage}%</span>
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function PredictionsPage() {
  const router = useRouter();
  const { currentUser, loading } = useSupabase();

  const [myPredictions, setMyPredictions] = useState<Record<PredictionType, string | null>>({
    best_player: null,
    best_young: null,
    surprise_team: null,
    winner: null,
    top_scorer: null,
    best_goalkeeper: null,
  });
  const [allPredictions, setAllPredictions] = useState<Prediction[]>([]);
  const [editingType, setEditingType] = useState<PredictionType | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);

  // Lock state
  const [isLocked, setIsLocked] = useState(false);
  const [lockDate, setLockDate] = useState<Date | null>(null);
  const [timeUntilLock, setTimeUntilLock] = useState<number>(-1);
  const [totalByType, setTotalByType] = useState<Record<string, number>>({});

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/predictions/global');
      if (!res.ok) return;

      const data = await res.json();
      setIsLocked(data.locked);
      setLockDate(data.lockDate ? new Date(data.lockDate) : null);
      setTimeUntilLock(data.timeUntilLock || -1);

      // API now always returns all predictions (fun > anti-cheat)
      setAllPredictions(data.predictions || []);
      setTotalByType(data.totalPredictionsByType || {});

      // Extract my predictions from the list
      const mine: Record<PredictionType, string | null> = {
        best_player: null, best_young: null, surprise_team: null, winner: null, top_scorer: null, best_goalkeeper: null,
      };
      (data.myPredictions || []).forEach((p: Prediction) => {
        mine[p.prediction_type as PredictionType] = p.prediction_value;
      });
      setMyPredictions(mine);
    } catch (err) {
      console.error('Error loading predictions:', err);
    }
  }, []);

  useEffect(() => {
    if (!loading && !currentUser) {
      router.push('/login');
      return;
    }
    if (currentUser) {
      loadData();
      setMounted(true);
    }
  }, [currentUser, loading, router, loadData]);

  const handleSelectPrediction = async (type: PredictionType, value: string) => {
    setSaving(true);
    try {
      console.log('[Predictions] Saving:', { type, value });
      const res = await fetch('/api/predictions/global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prediction_type: type, prediction_value: value }),
      });

      const data = await res.json();
      console.log('[Predictions] Response:', { status: res.status, data });

      if (!res.ok) {
        toast.error(data.error || `Erreur ${res.status}: ${JSON.stringify(data)}`);
        return;
      }

      toast.success('Pronostic enregistré');
      setMyPredictions(prev => ({ ...prev, [type]: value }));
      setEditingType(null);
      setSearchValue('');

      // Reload data to get updated counts
      await loadData();
    } catch (err) {
      console.error('[Predictions] Error saving:', err);
      toast.error(`Erreur de connexion: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setSaving(false);
    }
  };

  const getOptionsForType = (type: PredictionType): string[] => {
    if (type === 'winner' || type === 'surprise_team') {
      return TEAMS.map(t => t.name);
    }
    if (type === 'best_player') {
      return PLAYERS;
    }
    if (type === 'top_scorer') {
      return STRIKERS;
    }
    if (type === 'best_goalkeeper') {
      return GOALKEEPERS;
    }
    return YOUNG_PLAYERS;
  };

  const getPredictionsByType = (type: PredictionType) => {
    return allPredictions.filter(p => p.prediction_type === type);
  };

  const getTeamFlag = (name: string) => {
    const team = TEAMS.find(t => t.name === name);
    return team?.flag || '⚽';
  };

  // Show loading spinner while validating session
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--canvas)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <Navbar />

      {/* Header */}
      <section className="max-w-7xl mx-auto px-4 pt-8">
        <PageHeader
          title="Pronostics"
          subtitle="Vainqueur, buteur, révélation — verrouillés depuis le premier match"
          action={<Badge variant="accent">+20 pts / prono correct</Badge>}
        />
        {!isLocked && timeUntilLock > 0 && timeUntilLock < 24 * 60 * 60 * 1000 && (
          <p className="-mt-2 mb-6 text-[12px] text-[var(--text-tertiary)]">
            Verrouillage dans {Math.floor(timeUntilLock / (60 * 60 * 1000))}h {Math.floor((timeUntilLock % (60 * 60 * 1000)) / (60 * 1000))}m
          </p>
        )}
      </section>

      {/* My Predictions */}
      <section className="max-w-7xl mx-auto px-4 pb-8">
        <div className="grid md:grid-cols-2 gap-6">
          {PREDICTION_CATEGORIES.map((cat, index) => {
            const myPrediction = myPredictions[cat.type];
            const otherPredictions = getPredictionsByType(cat.type).filter(p => p.user_id !== currentUser.id);

            return (
              <div
                key={cat.type}
                className={`rounded-[10px] bg-[var(--surface-1)] top-light transition-all duration-300 ${
                  mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
                style={{ transitionDelay: `${index * 60}ms` }}
              >
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <cat.icon className="w-4 h-4 text-[var(--text-tertiary)]" strokeWidth={1.75} />
                    <div>
                      <p className="eyebrow">{cat.title}</p>
                      <p className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">{cat.description}</p>
                    </div>
                  </div>

                  {/* My prediction */}
                  <div className="mb-4">
                    {isLocked ? (
                      /* Locked state - show prediction or "pas de prono" */
                      <div className="flex items-center justify-between p-3 rounded-[8px] bg-[var(--surface-2)]">
                        <div className="flex items-center gap-2 min-w-0">
                          {(cat.type === 'winner' || cat.type === 'surprise_team') && myPrediction && (
                            <span className="text-lg shrink-0">{getTeamFlag(myPrediction)}</span>
                          )}
                          <div className="min-w-0">
                            <p className="eyebrow">Mon choix</p>
                            <p className="text-[16px] font-medium text-[var(--text-secondary)] truncate">{myPrediction || 'Pas de pronostic'}</p>
                          </div>
                        </div>
                        <Lock className="w-3 h-3 text-[var(--text-tertiary)] shrink-0" strokeWidth={1.75} />
                      </div>
                    ) : editingType === cat.type ? (
                      <div className="space-y-3">
                        {customMode ? (
                          /* Custom input mode */
                          <div className="space-y-3">
                            <p className="text-[13px] text-[var(--text-secondary)]">Saisir un choix personnalisé</p>
                            <input
                              type="text"
                              placeholder={cat.type.includes('player') || cat.type.includes('young') ? "Nom du joueur…" : "Nom de l'équipe…"}
                              value={customValue}
                              onChange={(e) => setCustomValue(e.target.value)}
                              className="w-full h-9 px-3 rounded-[8px] bg-[var(--surface-2)] border border-[var(--hairline)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)] focus:border-[var(--accent)]"
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  if (customValue.trim()) {
                                    handleSelectPrediction(cat.type, customValue.trim());
                                    setCustomMode(false);
                                    setCustomValue('');
                                  }
                                }}
                                disabled={saving || !customValue.trim()}
                                className="flex-1 h-9 rounded-[8px] bg-[var(--accent)] text-[#0A0C0B] text-[13px] font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
                              >
                                Valider
                              </button>
                              <button
                                onClick={() => { setCustomMode(false); setCustomValue(''); }}
                                className="h-9 px-3 rounded-[8px] bg-[var(--surface-2)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                              >
                                Retour
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Normal selection mode */
                          <>
                            <input
                              type="text"
                              placeholder="Rechercher…"
                              value={searchValue}
                              onChange={(e) => setSearchValue(e.target.value)}
                              className="w-full h-9 px-3 rounded-[8px] bg-[var(--surface-2)] border border-[var(--hairline)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)] focus:border-[var(--accent)]"
                              autoFocus
                            />
                            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                              {getOptionsForType(cat.type)
                                .filter(opt => opt.toLowerCase().includes(searchValue.toLowerCase()))
                                .map(opt => (
                                  <button
                                    key={opt}
                                    onClick={() => handleSelectPrediction(cat.type, opt)}
                                    disabled={saving}
                                    className="px-3 py-2 rounded-[8px] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[13px] text-left transition-colors flex items-center gap-2"
                                  >
                                    {(cat.type === 'winner' || cat.type === 'surprise_team') && (
                                      <span>{getTeamFlag(opt)}</span>
                                    )}
                                    <span className="text-[var(--text-primary)] truncate">{opt}</span>
                                  </button>
                                ))}
                              <button
                                onClick={() => setCustomMode(true)}
                                className="px-3 py-2 rounded-[8px] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[13px] text-left font-medium text-[var(--accent)] transition-colors"
                              >
                                Autre…
                              </button>
                            </div>
                            <button
                              onClick={() => { setEditingType(null); setSearchValue(''); }}
                              className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                            >
                              Annuler
                            </button>
                          </>
                        )}
                      </div>
                    ) : myPrediction ? (
                      <div className="flex items-center justify-between p-3 rounded-[8px] bg-[var(--surface-2)]">
                        <div className="flex items-center gap-2 min-w-0">
                          {(cat.type === 'winner' || cat.type === 'surprise_team') && (
                            <span className="text-lg shrink-0">{getTeamFlag(myPrediction)}</span>
                          )}
                          <div className="min-w-0">
                            <p className="eyebrow">Mon choix</p>
                            <p className="text-[16px] font-medium text-[var(--text-primary)] truncate">{myPrediction}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setEditingType(cat.type)}
                          className="shrink-0 text-[13px] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                        >
                          Modifier
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingType(cat.type)}
                        className="w-full py-3 rounded-[8px] bg-[var(--surface-2)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                      >
                        Faire mon pronostic
                      </button>
                    )}
                  </div>

                  {/* Other predictions - always visible (fun > anti-cheat) */}
                  {otherPredictions.length > 0 && (
                    <div className="pt-4 border-t border-[var(--hairline)]">
                      <p className="eyebrow mb-3">Choix de la team · {otherPredictions.length}</p>
                      <div className="flex flex-wrap gap-2">
                        {otherPredictions.map((pred, idx) => (
                          <div
                            key={pred.user_id ?? pred.user?.member_slug ?? idx}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[var(--surface-2)]"
                          >
                            <div className="relative w-4 h-4 rounded-full overflow-hidden">
                              <Image src={`/members/${pred.user?.member_slug || 'default'}.png`} alt="" fill sizes="16px" className="object-cover object-top" />
                            </div>
                            <span className="text-[12px] text-[var(--text-tertiary)]">{pred.user?.member_name?.split(' ')[0]}</span>
                            <span className="text-[12px] font-medium text-[var(--text-secondary)]">
                              {(cat.type === 'winner' || cat.type === 'surprise_team') && getTeamFlag(pred.prediction_value)} {pred.prediction_value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Community Stats */}
      {allPredictions.length > 0 && (
        <CommunityStats predictions={allPredictions} />
      )}

      {/* All predictions summary - ALWAYS visible (14 members × 4 categories) */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="display text-[22px] text-[var(--text-primary)] mb-4">Les pronos du groupe</h2>

        {/* Desktop: table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--hairline)]">
                <th className="text-left py-2.5 px-3"><span className="eyebrow">Membre</span></th>
                {PREDICTION_CATEGORIES.map(cat => (
                  <th key={cat.type} className="text-left py-2.5 px-3">
                    <span className="eyebrow hidden sm:inline">{cat.title}</span>
                    <span className="eyebrow sm:hidden">{cat.title.split(' ').pop()}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MEMBERS.map(member => {
                const memberPredictions = allPredictions.filter(p => p.user_id === member.id);
                const getPred = (type: PredictionType) => memberPredictions.find(p => p.prediction_type === type)?.prediction_value;
                const isMe = member.id === currentUser.id;

                return (
                  <tr key={member.id} className={`border-b border-[var(--hairline)] last:border-b-0 transition-colors ${isMe ? 'bg-[var(--surface-1)]' : 'hover:bg-[var(--surface-1)]'}`}>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar slug={member.slug} name={member.name} size={28} />
                        <span className={`text-[14px] font-medium ${isMe ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                          {member.name.split(' ')[0]}
                        </span>
                      </div>
                    </td>
                    {PREDICTION_CATEGORIES.map(cat => {
                      const pred = getPred(cat.type);
                      return (
                        <td key={cat.type} className="py-2.5 px-3">
                          {pred ? (
                            <span className="text-[13px] text-[var(--text-secondary)]">
                              {(cat.type === 'winner' || cat.type === 'surprise_team') && (
                                <span className="mr-1">{getTeamFlag(pred)}</span>
                              )}
                              {pred}
                            </span>
                          ) : (
                            <span className="text-[13px] text-[var(--text-tertiary)]">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile: cartes empilées par membre */}
        <div className="md:hidden space-y-2">
          {MEMBERS.map(member => {
            const memberPredictions = allPredictions.filter(p => p.user_id === member.id);
            const getPred = (type: PredictionType) => memberPredictions.find(p => p.prediction_type === type)?.prediction_value;
            const isMe = member.id === currentUser.id;

            return (
              <div key={member.id} className="rounded-[10px] bg-[var(--surface-1)] top-light p-3">
                <div className="flex items-center gap-2.5 mb-3">
                  <Avatar slug={member.slug} name={member.name} size={28} />
                  <span className={`text-[14px] font-medium ${isMe ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                    {member.name.split(' ')[0]}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  {PREDICTION_CATEGORIES.map(cat => {
                    const pred = getPred(cat.type);
                    return (
                      <div key={cat.type}>
                        <span className="eyebrow block">{cat.title.split(' ').pop()}</span>
                        {pred ? (
                          <span className="text-[13px] text-[var(--text-secondary)]">
                            {(cat.type === 'winner' || cat.type === 'surprise_team') && (
                              <span className="mr-1">{getTeamFlag(pred)}</span>
                            )}
                            {pred}
                          </span>
                        ) : (
                          <span className="text-[13px] text-[var(--text-tertiary)]">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
