'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useSupabase } from '@/hooks/useSupabase';
import { Star, Trophy, Users, ArrowLeft, Crown, Calendar } from 'lucide-react';

type PeriodFilter = '7d' | 'month' | 'all';

interface GameStats {
  game: { id: string; name: string; default_type: string };
  king: { userId: string; userName: string; stars: number } | null;
  leaderboard: Array<{
    userId: string;
    userName: string;
    memberSlug: string;
    stars: number;
    gamesPlayed: number;
    ratio: number;
  }>;
  totalSessions: number;
  individualSessions: number;
  teamSessions: number;
  periodFilter: PeriodFilter;
}

interface GameSession {
  id: string;
  played_at: string;
  location: string | null;
  session_type: 'individual' | 'team';
  winner_id: string | null;
  game: { id: string; name: string };
  winner: { id: string; member_name: string } | null;
  participants: Array<{ user: { id: string; member_name: string } }>;
}

export default function GameDetailPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const router = useRouter();
  const { currentUser, loading: userLoading } = useSupabase();

  const [stats, setStats] = useState<GameStats | null>(null);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [mounted, setMounted] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [statsRes, sessionsRes] = await Promise.all([
        fetch(`/api/games/stats/${gameId}?period=${periodFilter}`),
        fetch(`/api/games/sessions?game_id=${gameId}&limit=50`),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (sessionsRes.ok) setSessions(await sessionsRes.json());
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }, [gameId, periodFilter]);

  useEffect(() => {
    if (!userLoading && !currentUser) {
      router.push('/login');
    }
  }, [userLoading, currentUser, router]);

  useEffect(() => {
    setMounted(true);
    if (currentUser) loadData();
  }, [currentUser, loadData]);

  const getPeriodLabel = (period: PeriodFilter) => {
    switch (period) {
      case '7d': return '7 derniers jours';
      case 'month': return 'Ce mois';
      case 'all': return 'Tout';
    }
  };

  if (!mounted || userLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/games')}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-white">
            {stats?.game?.name || 'Chargement...'}
          </h1>
        </div>

        {/* Period Filter */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">Période :</span>
            <div className="flex gap-1">
              {(['7d', 'month', 'all'] as PeriodFilter[]).map(period => (
                <button
                  key={period}
                  onClick={() => setPeriodFilter(period)}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                    periodFilter === period
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/10 text-gray-400 hover:bg-white/20'
                  }`}
                >
                  {getPeriodLabel(period)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-white">{stats.totalSessions}</p>
              <p className="text-sm text-gray-400">Parties</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-400">{stats.individualSessions}</p>
              <p className="text-sm text-gray-400">Individuelles</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-orange-400">{stats.teamSessions}</p>
              <p className="text-sm text-gray-400">En équipe</p>
            </div>
          </div>
        )}

        {/* King */}
        {stats?.king && (
          <div className="glass rounded-2xl p-4 mb-6 border border-yellow-500/30">
            <div className="flex items-center gap-3">
              <Crown className="w-8 h-8 text-yellow-400" />
              <div>
                <p className="text-sm text-gray-400">
                  Roi du {stats.game.name}
                  {periodFilter !== 'all' && (
                    <span className="ml-2 text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
                      {getPeriodLabel(periodFilter)}
                    </span>
                  )}
                </p>
                <p className="text-lg font-bold text-white">
                  {stats.king.userName}
                  <span className="ml-2 text-yellow-400 flex items-center gap-1 inline-flex">
                    <Star className="w-4 h-4 fill-yellow-400" />
                    {stats.king.stars} étoiles
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard */}
        {stats && stats.leaderboard.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-purple-400" />
              Classement
              {periodFilter !== 'all' && (
                <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
                  {getPeriodLabel(periodFilter)}
                </span>
              )}
            </h2>
            <div className="glass rounded-xl overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-sm text-gray-400">#</th>
                    <th className="text-left py-3 px-4 text-sm text-gray-400">Joueur</th>
                    <th className="text-center py-3 px-4 text-sm text-gray-400">Étoiles</th>
                    <th className="text-center py-3 px-4 text-sm text-gray-400">Parties</th>
                    <th className="text-center py-3 px-4 text-sm text-gray-400">Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.leaderboard.map((player, index) => (
                    <tr key={player.userId} className="border-b border-white/5 last:border-0">
                      <td className="py-3 px-4">
                        {index === 0 && player.stars > 0 ? (
                          <Crown className="w-5 h-5 text-yellow-400" />
                        ) : (
                          <span className="text-gray-500">{index + 1}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-white">{player.userName}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="flex items-center justify-center gap-1 text-yellow-400 font-semibold">
                          <Star className="w-4 h-4 fill-yellow-400" />
                          {player.stars}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-gray-400">{player.gamesPlayed}</td>
                      <td className="py-3 px-4 text-center text-gray-400">
                        {(player.ratio * 100).toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Sessions History */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Historique</h2>
          <div className="space-y-3">
            {sessions.map(session => (
              <div key={session.id} className="glass rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-400">
                      {format(new Date(session.played_at), 'd MMMM yyyy', { locale: fr })}
                      {session.location && ` • ${session.location}`}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    session.session_type === 'individual'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-orange-500/20 text-orange-400'
                  }`}>
                    {session.session_type === 'individual' ? 'Individuel' : 'Équipe'}
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <Users className="w-4 h-4 text-gray-500" />
                  {session.participants?.map(p => (
                    <span
                      key={p.user.id}
                      className={`text-sm px-2 py-0.5 rounded-full ${
                        p.user.id === session.winner_id
                          ? 'bg-yellow-500/20 text-yellow-400 font-medium'
                          : 'bg-gray-700/50 text-gray-300'
                      }`}
                    >
                      {p.user.member_name}
                      {p.user.id === session.winner_id && ' 🏆'}
                    </span>
                  ))}
                  {!session.winner_id && session.session_type === 'individual' && (
                    <span className="text-sm text-gray-500 italic">Égalité</span>
                  )}
                </div>
              </div>
            ))}

            {sessions.length === 0 && (
              <p className="text-center text-gray-500 py-8">
                Aucune partie enregistrée pour ce jeu
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
