'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { MEMBERS } from '@/data/members';
import { useSupabase, PredictionType, Prediction } from '@/hooks/useSupabase';

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
  // Gardiens
  'Thibaut Courtois',
  'Alisson Becker',
  'Ederson',
  'Mike Maignan',
  'Gianluigi Donnarumma',
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
  { type: 'best_player', title: 'Meilleur joueur', emoji: '⭐', description: 'MVP du tournoi' },
  { type: 'best_young', title: 'Meilleur jeune', emoji: '🌟', description: 'Révélation U23' },
  { type: 'surprise_team', title: 'Équipe surprise', emoji: '🎯', description: 'Dark horse du tournoi' },
];

export default function PredictionsPage() {
  const router = useRouter();
  const { currentUser, loading, getMyPredictions, getAllPredictions, setPrediction } = useSupabase();

  const [myPredictions, setMyPredictions] = useState<Record<PredictionType, string | null>>({
    best_player: null,
    best_young: null,
    surprise_team: null,
    winner: null,
  });
  const [allPredictions, setAllPredictions] = useState<Prediction[]>([]);
  const [editingType, setEditingType] = useState<PredictionType | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    const [mine, all] = await Promise.all([
      getMyPredictions(),
      getAllPredictions(),
    ]);
    setMyPredictions(mine);
    setAllPredictions(all);
  }, [getMyPredictions, getAllPredictions]);

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
    await setPrediction(type, value);
    setMyPredictions(prev => ({ ...prev, [type]: value }));
    setEditingType(null);
    setSearchValue('');
    setSaving(false);
    // Reload all predictions
    const all = await getAllPredictions();
    setAllPredictions(all);
  };

  const getOptionsForType = (type: PredictionType): string[] => {
    if (type === 'winner' || type === 'surprise_team') {
      return TEAMS.map(t => t.name);
    }
    if (type === 'best_player') {
      return PLAYERS;
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

  if (loading || !currentUser) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar />

      {/* Hero */}
      <section className="relative py-12 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#fbbf24]/20 via-[#1a472a]/20 to-transparent" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#fbbf24]/10 rounded-full blur-3xl" />

        <div className={`max-w-7xl mx-auto relative transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <span className="text-5xl">🎰</span>
              <h1 className="text-4xl md:text-5xl font-black">
                <span className="text-white">Mes </span>
                <span className="bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] bg-clip-text text-transparent">Pronostics</span>
              </h1>
              <span className="text-5xl">🔮</span>
            </div>
            <p className="text-gray-400 text-lg">Qui va briller à la Coupe du Monde 2026 ?</p>
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
                    {editingType === cat.type ? (
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

                  {/* Other predictions */}
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

      {/* All predictions summary */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
          <span>📊</span>
          Récapitulatif de la team
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
