'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { MEMBERS } from '@/data/members';
import { useSupabase, PredictionType, Prediction } from '@/hooks/useSupabase';
import { toast } from 'sonner';

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

const PREDICTION_CATEGORIES: { type: PredictionType; title: string; emoji: string; description: string }[] = [
  { type: 'winner', title: 'Vainqueur', emoji: '🏆', description: 'Qui va soulever la coupe ?' },
  { type: 'top_scorer', title: 'Meilleur buteur', emoji: '⚽', description: 'Qui va marquer le plus ?' },
  { type: 'best_goalkeeper', title: 'Meilleur gardien', emoji: '🧤', description: 'Le mur du tournoi' },
  { type: 'best_player', title: 'Meilleur joueur', emoji: '⭐', description: 'MVP du tournoi' },
  { type: 'best_young', title: 'Meilleur jeune', emoji: '🌟', description: 'Révélation U23' },
  { type: 'surprise_team', title: 'Équipe surprise', emoji: '🎯', description: 'Dark horse du tournoi' },
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
      emoji: cat.emoji,
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
          <div
            key={stat.type}
            className="p-4 rounded-xl bg-gradient-to-br from-[#1a472a]/30 to-[#12121a] border border-[#fbbf24]/20"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{stat.emoji}</span>
              <span className="text-xs text-gray-400">{stat.title}</span>
            </div>
            <div className="flex items-center gap-2">
              {(stat.type === 'winner' || stat.type === 'surprise_team') && (
                <span className="text-xl">{getFlag(stat.topValue)}</span>
              )}
              <span className="font-bold text-white truncate">{stat.topValue}</span>
            </div>
            <div className="text-xs text-[#fbbf24] mt-1">
              {stat.topCount}/{MEMBERS.length} ({stat.percentage}%)
            </div>
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

      toast.success('Pronostic enregistré !', { icon: '🎯' });
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
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#6366f1] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar />

      {/* Hero */}
      <section className="relative py-6 sm:py-12 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#fbbf24]/20 via-[#1a472a]/20 to-transparent" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#fbbf24]/10 rounded-full blur-3xl hidden sm:block" />

        <div className={`max-w-7xl mx-auto relative transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center mb-4 sm:mb-8">
            <div className="inline-flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4">
              <span className="text-3xl sm:text-5xl">🎰</span>
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black">
                <span className="text-white">Mes </span>
                <span className="bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] bg-clip-text text-transparent">Pronostics</span>
              </h1>
              <span className="text-3xl sm:text-5xl">🔮</span>
            </div>
            <p className="text-gray-400 text-sm sm:text-lg">Qui va briller à la Coupe du Monde 2026 ?</p>
            <p className="text-xs sm:text-sm text-[#fbbf24] mt-1 sm:mt-2">💰 Chaque prono correct = +20 points</p>

            {/* Lock status banner */}
            {isLocked ? (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-500/20 rounded-full border border-gray-500/30">
                <span>🔒</span>
                <span className="text-gray-400">Pronos verrouillés depuis le premier match</span>
              </div>
            ) : timeUntilLock > 0 && timeUntilLock < 24 * 60 * 60 * 1000 && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-orange-500/20 rounded-full border border-orange-500/30 animate-pulse">
                <span>⚠️</span>
                <span className="text-orange-400">
                  Verrouillage dans {Math.floor(timeUntilLock / (60 * 60 * 1000))}h{' '}
                  {Math.floor((timeUntilLock % (60 * 60 * 1000)) / (60 * 1000))}m
                </span>
              </div>
            )}
          </div>
        </div>
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
                className={`relative overflow-hidden rounded-3xl border border-[#fbbf24]/20 bg-gradient-to-br from-[#1a472a]/30 to-[#12121a] transition-all duration-300 ${
                  mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#fbbf24]/5 rounded-full blur-2xl" />

                <div className="relative p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl">{cat.emoji}</span>
                    <div>
                      <h3 className="text-xl font-bold text-white">{cat.title}</h3>
                      <p className="text-sm text-gray-400">{cat.description}</p>
                    </div>
                  </div>

                  {/* My prediction */}
                  <div className="mb-4">
                    {isLocked ? (
                      /* Locked state - show prediction or "pas de prono" */
                      <div className="flex items-center justify-between p-4 bg-gray-500/20 rounded-xl border border-gray-500/30">
                        <div className="flex items-center gap-3">
                          {(cat.type === 'winner' || cat.type === 'surprise_team') && myPrediction && (
                            <span className="text-3xl">{getTeamFlag(myPrediction)}</span>
                          )}
                          <div>
                            <p className="text-xs text-gray-400">Mon choix</p>
                            <p className="text-lg font-bold text-gray-300">
                              {myPrediction || 'Pas de pronostic'}
                            </p>
                          </div>
                        </div>
                        <span className="text-gray-500">🔒</span>
                      </div>
                    ) : editingType === cat.type ? (
                      <div className="space-y-3">
                        {customMode ? (
                          /* Custom input mode */
                          <div className="space-y-3">
                            <p className="text-sm text-gray-400">Saisir un choix personnalisé :</p>
                            <input
                              type="text"
                              placeholder={cat.type.includes('player') || cat.type.includes('young') ? "Nom du joueur..." : "Nom de l'équipe..."}
                              value={customValue}
                              onChange={(e) => setCustomValue(e.target.value)}
                              className="w-full px-4 py-2 bg-[#1e1e2e] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#fbbf24]"
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
                                className="flex-1 px-4 py-2 bg-[#fbbf24] hover:bg-[#f59e0b] text-black font-medium rounded-xl transition-colors disabled:opacity-50"
                              >
                                Valider
                              </button>
                              <button
                                onClick={() => { setCustomMode(false); setCustomValue(''); }}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
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
                              placeholder="Rechercher..."
                              value={searchValue}
                              onChange={(e) => setSearchValue(e.target.value)}
                              className="w-full px-4 py-2 bg-[#1e1e2e] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#fbbf24]"
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
                                    className="px-3 py-2 bg-[#1e1e2e] hover:bg-[#fbbf24]/20 border border-white/10 hover:border-[#fbbf24]/50 rounded-xl text-sm text-left transition-all flex items-center gap-2"
                                  >
                                    {(cat.type === 'winner' || cat.type === 'surprise_team') && (
                                      <span>{getTeamFlag(opt)}</span>
                                    )}
                                    <span className="text-white truncate">{opt}</span>
                                  </button>
                                ))}
                              {/* Autre option */}
                              <button
                                onClick={() => setCustomMode(true)}
                                className="px-3 py-2 bg-[#6366f1]/20 hover:bg-[#6366f1]/30 border border-[#6366f1]/50 hover:border-[#6366f1] rounded-xl text-sm text-left transition-all flex items-center gap-2"
                              >
                                <span>✏️</span>
                                <span className="text-[#6366f1] font-medium">Autre...</span>
                              </button>
                            </div>
                            <button
                              onClick={() => { setEditingType(null); setSearchValue(''); }}
                              className="text-sm text-gray-400 hover:text-white"
                            >
                              Annuler
                            </button>
                          </>
                        )}
                      </div>
                    ) : myPrediction ? (
                      <div className="flex items-center justify-between p-4 bg-[#fbbf24]/20 rounded-xl border border-[#fbbf24]/30">
                        <div className="flex items-center gap-3">
                          {(cat.type === 'winner' || cat.type === 'surprise_team') && (
                            <span className="text-3xl">{getTeamFlag(myPrediction)}</span>
                          )}
                          <div>
                            <p className="text-xs text-[#fbbf24]">Mon choix</p>
                            <p className="text-lg font-bold text-white">{myPrediction}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setEditingType(cat.type)}
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-colors"
                        >
                          Modifier
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingType(cat.type)}
                        className="w-full p-4 border-2 border-dashed border-[#fbbf24]/30 hover:border-[#fbbf24] rounded-xl text-[#fbbf24] hover:bg-[#fbbf24]/10 transition-all"
                      >
                        + Faire mon pronostic
                      </button>
                    )}
                  </div>

                  {/* Other predictions - always visible (fun > anti-cheat) */}
                  {otherPredictions.length > 0 && (
                    <div className="pt-4 border-t border-white/10">
                      <p className="text-xs text-gray-500 mb-3">Choix de la team ({otherPredictions.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {otherPredictions.map(pred => (
                          <div
                            key={pred.id}
                            className="flex items-center gap-2 px-3 py-1.5 bg-[#1e1e2e] rounded-xl"
                          >
                            <div className="w-6 h-6 rounded-full overflow-hidden relative">
                              <Image
                                src={`/members/${pred.user?.member_slug || 'default'}.png`}
                                alt=""
                                fill
                                className="object-cover"
                              />
                            </div>
                            <span className="text-xs text-gray-300">{pred.user?.member_name?.split(' ')[0]}</span>
                            <span className="text-xs text-white font-medium">
                              {(cat.type === 'winner' || cat.type === 'surprise_team') && getTeamFlag(pred.prediction_value)}
                              {pred.prediction_value}
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
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <span>📊</span>
          Les pronos du groupe
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Membre</th>
                {PREDICTION_CATEGORIES.map(cat => (
                  <th key={cat.type} className="text-left py-3 px-4 text-gray-400 font-medium">
                    <span className="mr-1">{cat.emoji}</span>
                    <span className="hidden sm:inline">{cat.title}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MEMBERS.map(member => {
                const memberPredictions = allPredictions.filter(p => p.user_id === member.id);
                const getPred = (type: PredictionType) => memberPredictions.find(p => p.prediction_type === type)?.prediction_value;

                return (
                  <tr key={member.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden relative">
                          <Image src={member.photo} alt={member.name} fill className="object-cover" />
                        </div>
                        <span className={`font-medium ${member.id === currentUser.id ? 'text-[#fbbf24]' : 'text-white'}`}>
                          {member.name.split(' ')[0]}
                        </span>
                      </div>
                    </td>
                    {PREDICTION_CATEGORIES.map(cat => {
                      const pred = getPred(cat.type);
                      return (
                        <td key={cat.type} className="py-3 px-4">
                          {pred ? (
                            <span className="text-sm text-white">
                              {(cat.type === 'winner' || cat.type === 'surprise_team') && (
                                <span className="mr-1">{getTeamFlag(pred)}</span>
                              )}
                              {pred}
                            </span>
                          ) : (
                            <span className="text-gray-600 text-sm">—</span>
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
      </section>
    </div>
  );
}
