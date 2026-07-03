'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Image from 'next/image';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useSupabase } from '@/hooks/useSupabase';
import { toast } from 'sonner';
import { Star, Trophy, Users, Plus, ChevronRight, Pencil, Trash2, TrendingUp, Activity } from 'lucide-react';
import { EmptyState } from '@/components/ui';

type PeriodFilter = '7d' | 'month' | 'all';

interface Game {
  id: string;
  name: string;
  default_type: 'individual' | 'team';
  created_at: string;
}

interface GameSession {
  id: string;
  game_id: string;
  played_at: string;
  location: string | null;
  session_type: 'individual' | 'team';
  winner_id: string | null;
  created_by: string;
  game: { id: string; name: string };
  winner: { id: string; member_name: string; member_slug: string } | null;
  participants: Array<{ user: { id: string; member_name: string; member_slug: string } }>;
}

interface User {
  id: string;
  member_name: string;
  member_slug: string;
}

interface EloLeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  memberSlug: string;
  elo: number;
  stars: number;
  ratio: number;
  gamesPlayed: number;
}

interface GlobalStats {
  totalStars: Record<string, { userName: string; stars: number }>;
  kings: Array<{ gameId: string; gameName: string; userId: string; userName: string; stars: number }>;
  topWinner: { userId: string; userName: string; totalWins: number } | null;
  eloLeaderboard: EloLeaderboardEntry[];
  periodFilter: PeriodFilter;
}

interface ActivityItem {
  sessionId: string;
  gameId: string;
  gameName: string;
  playedAt: string;
  sessionType: 'individual' | 'team';
  winnerId: string | null;
  winnerName: string | null;
  participants: { userId: string; userName: string }[];
  eloDelta: number | null;
}

interface PlayerForm {
  userId: string;
  userName: string;
  formByGame: {
    [gameId: string]: {
      gameName: string;
      recentResults: ('W' | 'L')[];
      lastPlayedAt: string;
    };
  };
}

export default function GamesPage() {
  const router = useRouter();
  const { currentUser, loading: userLoading } = useSupabase();

  const [games, setGames] = useState<Game[]>([]);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [selectedPlayerForm, setSelectedPlayerForm] = useState<PlayerForm | null>(null);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [mounted, setMounted] = useState(false);
  const [showCreateGame, setShowCreateGame] = useState(false);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [newGameName, setNewGameName] = useState('');
  const [newSession, setNewSession] = useState({
    game_id: '',
    played_at: new Date().toISOString().split('T')[0],
    location: '',
    session_type: 'individual' as 'individual' | 'team',
    winner_id: '',
    participant_ids: [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [editingSession, setEditingSession] = useState<GameSession | null>(null);
  const [deleteSession, setDeleteSession] = useState<GameSession | null>(null);
  const [editSession, setEditSession] = useState({
    game_id: '',
    played_at: '',
    location: '',
    session_type: 'individual' as 'individual' | 'team',
    winner_id: '',
    participant_ids: [] as string[],
  });

  const loadData = useCallback(async () => {
    try {
      const [gamesRes, sessionsRes, statsRes, usersRes, activityRes] = await Promise.all([
        fetch('/api/games'),
        fetch('/api/games/sessions?limit=20'),
        fetch(`/api/games/stats?period=${periodFilter}`),
        fetch('/api/users'),
        fetch('/api/games/activity?limit=10'),
      ]);

      if (gamesRes.ok) setGames(await gamesRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (sessionsRes.ok) setSessions(await sessionsRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      if (activityRes.ok) {
        const activityData = await activityRes.json();
        setActivity(activityData.activities || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }, [periodFilter]);

  const loadPlayerForm = async (userId: string) => {
    try {
      const res = await fetch(`/api/games/players/${userId}/form`);
      if (res.ok) {
        const form = await res.json();
        setSelectedPlayerForm(form);
      }
    } catch (error) {
      console.error('Failed to load player form:', error);
    }
  };

  useEffect(() => {
    if (!userLoading && !currentUser) {
      router.push('/login');
    }
  }, [userLoading, currentUser, router]);

  useEffect(() => {
    setMounted(true);
    if (currentUser) loadData();
  }, [currentUser, loadData]);

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGameName.trim()) return;
    setLoading(true);

    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGameName.trim() }),
      });

      if (res.ok) {
        setNewGameName('');
        setShowCreateGame(false);
        loadData();
        toast.success('Jeu créé');
      } else {
        toast.error('Erreur lors de la création du jeu');
      }
    } catch {
      toast.error('Erreur réseau, réessaie');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSession.game_id || newSession.participant_ids.length < 2) return;
    setLoading(true);

    try {
      const res = await fetch('/api/games/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newSession,
          winner_id: newSession.winner_id || null,
        }),
      });

      if (res.ok) {
        setNewSession({
          game_id: '',
          played_at: new Date().toISOString().split('T')[0],
          location: '',
          session_type: 'individual',
          winner_id: '',
          participant_ids: [],
        });
        setShowCreateSession(false);
        loadData();
        toast.success('Partie enregistrée');
      } else {
        toast.error("Erreur lors de l'enregistrement de la partie");
      }
    } catch {
      toast.error('Erreur réseau, réessaie');
    } finally {
      setLoading(false);
    }
  };

  const toggleParticipant = (userId: string) => {
    setNewSession(prev => ({
      ...prev,
      participant_ids: prev.participant_ids.includes(userId)
        ? prev.participant_ids.filter(id => id !== userId)
        : [...prev.participant_ids, userId],
    }));
  };

  const toggleEditParticipant = (userId: string) => {
    setEditSession(prev => ({
      ...prev,
      participant_ids: prev.participant_ids.includes(userId)
        ? prev.participant_ids.filter(id => id !== userId)
        : [...prev.participant_ids, userId],
    }));
  };

  const openEditModal = (session: GameSession) => {
    setEditingSession(session);
    setEditSession({
      game_id: session.game_id,
      played_at: session.played_at,
      location: session.location || '',
      session_type: session.session_type,
      winner_id: session.winner_id || '',
      participant_ids: session.participants?.map(p => p.user.id) || [],
    });
  };

  const handleUpdateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession || !editSession.game_id || editSession.participant_ids.length < 2) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/games/sessions/${editingSession.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editSession,
          winner_id: editSession.winner_id || null,
        }),
      });

      if (res.ok) {
        setEditingSession(null);
        loadData();
        toast.success('Partie modifiée');
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || 'Erreur lors de la modification');
      }
    } catch {
      toast.error('Erreur réseau, réessaie');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!deleteSession) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/games/sessions/${deleteSession.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setDeleteSession(null);
        loadData();
        toast.success('Partie supprimée');
      } else {
        toast.error('Erreur lors de la suppression');
      }
    } catch {
      toast.error('Erreur réseau, réessaie');
    } finally {
      setLoading(false);
    }
  };

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
        <div className="animate-spin w-8 h-8 border-4 border-[#6366f1] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-6 pb-24">
        <div className="flex items-center justify-between mb-6">
          <h1 className="display text-[22px] text-[var(--text-primary)]">Zbrétoile</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateGame(true)}
              className="flex items-center gap-1 h-11 sm:h-9 px-3 rounded-[8px] text-[13px] font-medium bg-[var(--accent)] text-[#0A0C0B] hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" />
              Jeu
            </button>
            <button
              onClick={() => setShowCreateSession(true)}
              className="flex items-center gap-1 h-11 sm:h-9 px-3 rounded-[8px] text-[13px] font-medium bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Partie
            </button>
          </div>
        </div>

        {/* Period Filter — segmented v2 */}
        <div className="mb-6 flex items-center gap-3">
          <span className="eyebrow">Période</span>
          <div className="inline-flex rounded-[8px] bg-[var(--surface-2)] p-0.5">
            {(['7d', 'month', 'all'] as PeriodFilter[]).map(period => (
              <button
                key={period}
                onClick={() => setPeriodFilter(period)}
                className={`px-3 py-2.5 sm:py-1.5 rounded-[6px] text-[13px] transition-colors ${
                  periodFilter === period
                    ? 'bg-[var(--surface-3)] top-light text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {getPeriodLabel(period)}
              </button>
            ))}
          </div>
        </div>

        {/* Empty state — treated Zbrétoile (grayscale + contrast + grain), like chrome photos */}
        {games.length === 0 && (
          <EmptyState
            media={
              <div className="relative w-28 h-28 rounded-[16px] overflow-hidden">
                <Image src="/zbretoile.jpeg" alt="" fill sizes="112px" className="object-cover grayscale contrast-[1.05]" />
                <div className="grain absolute inset-0 pointer-events-none" />
              </div>
            }
            title="Aucun jeu pour l'instant"
            description="Crée ton premier jeu pour lancer le classement Zbrétoile."
          />
        )}

        {/* Top Winner */}
        {stats?.topWinner && (
          <div className="glass rounded-2xl p-4 mb-6 border border-yellow-500/30">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-yellow-400" />
              <div>
                <p className="text-sm text-gray-400">Champion toutes catégories</p>
                <p className="text-lg font-bold text-white">
                  {stats.topWinner.userName}
                  <span className="ml-2 text-yellow-400">{stats.topWinner.totalWins} victoires</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ELO Leaderboard */}
        {stats?.eloLeaderboard && stats.eloLeaderboard.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#a855f7]" />
              Classement ELO
              {periodFilter !== 'all' && (
                <span className="text-xs bg-[#6366f1]/20 text-[#a855f7] px-2 py-0.5 rounded-full">
                  {getPeriodLabel(periodFilter)}
                </span>
              )}
            </h2>
            <div className="relative">
              <div className="glass rounded-xl overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">#</th>
                    <th className="sticky left-0 z-10 bg-[var(--surface-1)] px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Joueur</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">ELO</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Étoiles</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Ratio</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Parties</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.eloLeaderboard.map((entry) => (
                    <tr
                      key={entry.userId}
                      className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                      onClick={() => loadPlayerForm(entry.userId)}
                    >
                      <td className="px-4 py-3">
                        <span className={`font-bold ${
                          entry.rank === 1 ? 'text-yellow-400' :
                          entry.rank === 2 ? 'text-gray-300' :
                          entry.rank === 3 ? 'text-amber-600' :
                          'text-gray-500'
                        }`}>
                          {entry.rank}
                        </span>
                      </td>
                      <td className="sticky left-0 z-10 bg-[var(--surface-1)] px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="relative w-8 h-8 rounded-full overflow-hidden ring-1 ring-white/10 shrink-0">
                            <Image
                              src={`/members/${entry.memberSlug}.png`}
                              alt={entry.userName}
                              fill
                              sizes="32px"
                              className="object-cover object-top"
                            />
                          </div>
                          <span className="font-medium text-white">{entry.userName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono font-bold text-[#a855f7]">{entry.elo}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="flex items-center justify-end gap-1 text-yellow-400">
                          <Star className="w-4 h-4 fill-yellow-400" />
                          {entry.stars}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300">
                        {Math.round(entry.ratio * 100)}%
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400">{entry.gamesPlayed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--surface-1)] to-transparent" />
            </div>
          </div>
        )}

        {/* Kings by Game */}
        {stats?.kings && stats.kings.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400" />
              Rois du jeu
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {stats.kings.map(king => (
                <div
                  key={king.gameId}
                  className="glass rounded-xl p-3 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => router.push(`/games/${king.gameId}`)}
                >
                  <p className="text-sm text-gray-400">{king.gameName}</p>
                  <p className="font-semibold text-white">{king.userName}</p>
                  <p className="text-yellow-400 text-sm flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400" />
                    {king.stars} étoiles
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity Feed */}
        {activity.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-400" />
              Activité récente
            </h2>
            <div className="space-y-2">
              {activity.filter(a => a.sessionType === 'individual' && a.winnerId).slice(0, 5).map(item => (
                <div key={item.sessionId} className="glass rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-white">{item.winnerName}</span>
                    <span className="text-gray-400"> a battu </span>
                    <span className="text-gray-300">
                      {item.participants
                        .filter(p => p.userId !== item.winnerId)
                        .map(p => p.userName)
                        .join(', ')}
                    </span>
                    <span className="text-gray-500 text-sm ml-2">à {item.gameName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.eloDelta !== null && (
                      <span className="text-green-400 font-mono text-sm">+{item.eloDelta} ELO</span>
                    )}
                    <span className="text-xs text-gray-500">
                      {format(new Date(item.playedAt), 'd MMM', { locale: fr })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Games List */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">Jeux</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {games.map(game => (
              <button
                key={game.id}
                onClick={() => router.push(`/games/${game.id}`)}
                className="glass rounded-xl p-4 text-left hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white">{game.name}</span>
                  <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {game.default_type === 'individual' ? 'Individuel' : 'Équipe'}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Sessions */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Dernières parties</h2>
          <div className="space-y-3">
            {sessions.map(session => (
              <div key={session.id} className="glass rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-white">{session.game?.name}</p>
                    <p className="text-sm text-gray-400">
                      {format(new Date(session.played_at), 'd MMM yyyy', { locale: fr })}
                      {session.location && ` • ${session.location}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      session.session_type === 'individual'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-orange-500/20 text-orange-400'
                    }`}>
                      {session.session_type === 'individual' ? 'Individuel' : 'Équipe'}
                    </span>
                    <button
                      onClick={() => openEditModal(session)}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                      title="Modifier"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteSession(session)}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <Users className="w-4 h-4 text-gray-500" />
                  {session.participants?.map(p => (
                    <span
                      key={p.user.id}
                      className={`text-sm px-2 py-0.5 rounded-full ${
                        p.user.id === session.winner_id
                          ? 'bg-yellow-500/20 text-yellow-400 font-medium'
                          : 'bg-[#1e1e2e]/50 text-gray-300'
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
          </div>
        </div>
      </main>

      {/* Player Form Modal */}
      {selectedPlayerForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">
              Forme de {selectedPlayerForm.userName}
            </h2>
            {Object.keys(selectedPlayerForm.formByGame).length === 0 ? (
              <p className="text-gray-400">Aucune partie individuelle jouée.</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(selectedPlayerForm.formByGame).map(([gameId, form]) => (
                  <div key={gameId} className="bg-white/5 rounded-xl p-4">
                    <p className="font-medium text-white mb-2">{form.gameName}</p>
                    <div className="flex items-center gap-1">
                      {form.recentResults.map((result, idx) => (
                        <span
                          key={idx}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold ${
                            result === 'W'
                              ? 'bg-[#22c55e]/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {result}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Dernier match : {format(new Date(form.lastPlayedAt), 'd MMM yyyy', { locale: fr })}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setSelectedPlayerForm(null)}
              className="mt-6 w-full py-3 bg-[#1e1e2e] hover:bg-[#2a2a3a] rounded-xl font-medium transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* Create Game Modal */}
      {showCreateGame && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Nouveau jeu</h2>
            <form onSubmit={handleCreateGame}>
              <input
                type="text"
                value={newGameName}
                onChange={e => setNewGameName(e.target.value)}
                placeholder="Nom du jeu (ex: FIFA, Uno, Poker...)"
                className="w-full px-4 py-3 bg-white/10 rounded-xl text-white placeholder-gray-500 mb-4"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateGame(false)}
                  className="flex-1 py-3 bg-[#1e1e2e] hover:bg-[#2a2a3a] rounded-xl font-medium transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading || !newGameName.trim()}
                  className="flex-1 py-3 bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 rounded-xl font-medium transition-colors"
                >
                  Créer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Session Modal */}
      {showCreateSession && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="glass rounded-2xl p-6 w-full max-w-md my-8">
            <h2 className="text-xl font-bold text-white mb-4">Nouvelle partie</h2>
            <form onSubmit={handleCreateSession} className="space-y-4">
              {/* Game Select */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Jeu</label>
                <select
                  value={newSession.game_id}
                  onChange={e => {
                    const game = games.find(g => g.id === e.target.value);
                    setNewSession(prev => ({
                      ...prev,
                      game_id: e.target.value,
                      session_type: game?.default_type || 'individual',
                    }));
                  }}
                  className="w-full px-4 py-3 bg-white/10 rounded-xl text-white"
                >
                  <option value="">Choisir un jeu...</option>
                  {games.map(game => (
                    <option key={game.id} value={game.id}>{game.name}</option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Date</label>
                <input
                  type="date"
                  value={newSession.played_at}
                  onChange={e => setNewSession(prev => ({ ...prev, played_at: e.target.value }))}
                  className="w-full px-4 py-3 bg-white/10 rounded-xl text-white"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Lieu (optionnel)</label>
                <input
                  type="text"
                  value={newSession.location}
                  onChange={e => setNewSession(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Chez qui ?"
                  className="w-full px-4 py-3 bg-white/10 rounded-xl text-white placeholder-gray-500"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewSession(prev => ({ ...prev, session_type: 'individual' }))}
                    className={`flex-1 py-2 rounded-xl font-medium transition-colors ${
                      newSession.session_type === 'individual'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white/10 text-gray-400 hover:bg-white/20'
                    }`}
                  >
                    Individuel
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSession(prev => ({ ...prev, session_type: 'team' }))}
                    className={`flex-1 py-2 rounded-xl font-medium transition-colors ${
                      newSession.session_type === 'team'
                        ? 'bg-orange-600 text-white'
                        : 'bg-white/10 text-gray-400 hover:bg-white/20'
                    }`}
                  >
                    Équipe
                  </button>
                </div>
              </div>

              {/* Participants */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Participants ({newSession.participant_ids.length} sélectionnés)
                </label>
                <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 bg-white/5 rounded-xl">
                  {users.map(user => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => toggleParticipant(user.id)}
                      className={`px-2 py-2 sm:py-1 text-sm rounded-lg transition-colors ${
                        newSession.participant_ids.includes(user.id)
                          ? 'bg-[#6366f1] text-white'
                          : 'bg-white/10 text-gray-400 hover:bg-white/20'
                      }`}
                    >
                      {user.member_name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Winner (only for individual) */}
              {newSession.session_type === 'individual' && newSession.participant_ids.length >= 2 && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Gagnant</label>
                  <select
                    value={newSession.winner_id}
                    onChange={e => setNewSession(prev => ({ ...prev, winner_id: e.target.value }))}
                    className="w-full px-4 py-3 bg-white/10 rounded-xl text-white"
                  >
                    <option value="">Égalité / Pas de gagnant</option>
                    {users
                      .filter(u => newSession.participant_ids.includes(u.id))
                      .map(user => (
                        <option key={user.id} value={user.id}>{user.member_name}</option>
                      ))}
                  </select>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateSession(false)}
                  className="flex-1 py-3 bg-[#1e1e2e] hover:bg-[#2a2a3a] rounded-xl font-medium transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading || !newSession.game_id || newSession.participant_ids.length < 2}
                  className="flex-1 py-3 bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-50 rounded-xl font-medium transition-colors"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Session Modal */}
      {editingSession && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="glass rounded-2xl p-6 w-full max-w-md my-8">
            <h2 className="text-xl font-bold text-white mb-4">Modifier la partie</h2>
            <form onSubmit={handleUpdateSession} className="space-y-4">
              {/* Game Select */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Jeu</label>
                <select
                  value={editSession.game_id}
                  onChange={e => {
                    const game = games.find(g => g.id === e.target.value);
                    setEditSession(prev => ({
                      ...prev,
                      game_id: e.target.value,
                      session_type: game?.default_type || prev.session_type,
                    }));
                  }}
                  className="w-full px-4 py-3 bg-white/10 rounded-xl text-white"
                >
                  {games.map(game => (
                    <option key={game.id} value={game.id}>{game.name}</option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Date</label>
                <input
                  type="date"
                  value={editSession.played_at}
                  onChange={e => setEditSession(prev => ({ ...prev, played_at: e.target.value }))}
                  className="w-full px-4 py-3 bg-white/10 rounded-xl text-white"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Lieu (optionnel)</label>
                <input
                  type="text"
                  value={editSession.location}
                  onChange={e => setEditSession(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="Chez qui ?"
                  className="w-full px-4 py-3 bg-white/10 rounded-xl text-white placeholder-gray-500"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditSession(prev => ({ ...prev, session_type: 'individual' }))}
                    className={`flex-1 py-2 rounded-xl font-medium transition-colors ${
                      editSession.session_type === 'individual'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white/10 text-gray-400 hover:bg-white/20'
                    }`}
                  >
                    Individuel
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditSession(prev => ({ ...prev, session_type: 'team' }))}
                    className={`flex-1 py-2 rounded-xl font-medium transition-colors ${
                      editSession.session_type === 'team'
                        ? 'bg-orange-600 text-white'
                        : 'bg-white/10 text-gray-400 hover:bg-white/20'
                    }`}
                  >
                    Équipe
                  </button>
                </div>
              </div>

              {/* Participants */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Participants ({editSession.participant_ids.length} sélectionnés)
                </label>
                <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 bg-white/5 rounded-xl">
                  {users.map(user => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => toggleEditParticipant(user.id)}
                      className={`px-2 py-2 sm:py-1 text-sm rounded-lg transition-colors ${
                        editSession.participant_ids.includes(user.id)
                          ? 'bg-[#6366f1] text-white'
                          : 'bg-white/10 text-gray-400 hover:bg-white/20'
                      }`}
                    >
                      {user.member_name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Winner (only for individual) */}
              {editSession.session_type === 'individual' && editSession.participant_ids.length >= 2 && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Gagnant</label>
                  <select
                    value={editSession.winner_id}
                    onChange={e => setEditSession(prev => ({ ...prev, winner_id: e.target.value }))}
                    className="w-full px-4 py-3 bg-white/10 rounded-xl text-white"
                  >
                    <option value="">Égalité / Pas de gagnant</option>
                    {users
                      .filter(u => editSession.participant_ids.includes(u.id))
                      .map(user => (
                        <option key={user.id} value={user.id}>{user.member_name}</option>
                      ))}
                  </select>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingSession(null)}
                  className="flex-1 py-3 bg-[#1e1e2e] hover:bg-[#2a2a3a] rounded-xl font-medium transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading || !editSession.game_id || editSession.participant_ids.length < 2}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl font-medium transition-colors"
                >
                  Modifier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteSession && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-bold text-white mb-2">Supprimer la partie ?</h2>
            <p className="text-gray-400 mb-6">
              {deleteSession.game?.name} du {format(new Date(deleteSession.played_at), 'd MMM yyyy', { locale: fr })}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteSession(null)}
                className="flex-1 py-3 bg-[#1e1e2e] hover:bg-[#2a2a3a] rounded-xl font-medium transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteSession}
                disabled={loading}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl font-medium transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
