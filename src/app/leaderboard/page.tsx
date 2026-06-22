'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { EvolutionChart } from '@/components/EvolutionChart';

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  member_name: string;
  member_slug: string;
  total_points: number;
  match_points: number;
  global_points: number;
  exact_scores: number;
  visionary_count: number;
  outsider_count: number;
  matches_predicted: number;
  global_correct: number;
  crown_count: number;
  mzi_count: number;
  is_drere_today: boolean;
  is_mzi_today: boolean;
  is_drere_week: boolean;
  rank_change: number;
}

interface LeaderboardStats {
  most_optimistic: { user_id: string; member_name: string; avg_goals: number } | null;
  top_visionary: { user_id: string; member_name: string; count: number } | null;
  top_follower: { user_id: string; member_name: string; count: number } | null;
}

interface LiveRankingEntry {
  user_id: string;
  member_name: string;
  member_slug: string;
  day_points: number;
  matches_today: number;
}

interface LiveRankingData {
  date: string;
  matchesToday: number;
  matchesCompleted: number;
  ranking: LiveRankingEntry[];
  currentLeader: LiveRankingEntry | null;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<LeaderboardStats | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [totalMatchesWithResults, setTotalMatchesWithResults] = useState(0);
  const [drereDayPoints, setDrereDayPoints] = useState(0);
  const [mziDayPoints, setMziDayPoints] = useState<number | null>(null);
  const [drereWeekPoints, setDrereWeekPoints] = useState(0);
  const [liveRanking, setLiveRanking] = useState<LiveRankingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/leaderboard');
        if (!res.ok) {
          if (res.status === 401) {
            router.push('/login');
            return;
          }
          throw new Error('Failed to load');
        }

        const data = await res.json();
        setLeaderboard(data.leaderboard);
        setStats(data.stats);
        setCurrentUserId(data.current_user_id);
        setTotalMatchesWithResults(data.total_matches_with_results || 0);
        setDrereDayPoints(data.drere_day_points || 0);
        setMziDayPoints(data.mzi_day_points ?? null);
        setDrereWeekPoints(data.drere_week_points || 0);

        // Fetch live ranking
        const liveRes = await fetch('/api/leaderboard/live');
        if (liveRes.ok) {
          const liveData = await liveRes.json();
          setLiveRanking(liveData);
        }
      } catch (error) {
        console.error('Error loading leaderboard:', error);
      } finally {
        setLoading(false);
        setMounted(true);
      }
    }

    loadData();

    // Refresh live ranking every 30 seconds
    const liveInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/leaderboard/live');
        if (res.ok) {
          const data = await res.json();
          setLiveRanking(data);
        }
      } catch {
        // Silently fail on refresh errors
      }
    }, 30000);

    return () => clearInterval(liveInterval);
  }, [router]);

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getRankChange = (change: number) => {
    if (change > 0) return <span className="text-green-400 text-sm">↑{change}</span>;
    if (change < 0) return <span className="text-red-400 text-sm">↓{Math.abs(change)}</span>;
    return <span className="text-gray-500 text-sm">—</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#6366f1] border-t-transparent rounded-full" />
      </div>
    );
  }

  // Separate active and inactive players
  const activePlayers = leaderboard.filter(e => e.matches_predicted > 0);
  const inactivePlayers = leaderboard.filter(e => e.matches_predicted === 0);

  // Get ALL drères and mzis (handles ties)
  const dreresToday = leaderboard.filter(e => e.is_drere_today);
  const mzisToday = leaderboard.filter(e => e.is_mzi_today);
  const dreresWeek = leaderboard.filter(e => e.is_drere_week);

  const currentUserEntry = leaderboard.find(e => e.user_id === currentUserId);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar />

      {/* Hero */}
      <section className="relative py-6 sm:py-12 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#fbbf24]/20 via-[#6366f1]/10 to-transparent" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#fbbf24]/10 rounded-full blur-3xl" />

        <div className={`max-w-4xl mx-auto relative transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center mb-4 sm:mb-8">
            <div className="inline-flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4">
              <span className="text-3xl sm:text-5xl">🏆</span>
              <h1 className="text-2xl sm:text-4xl md:text-5xl font-black">
                <span className="text-white">Leader</span>
                <span className="bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] bg-clip-text text-transparent">board</span>
              </h1>
              <span className="text-3xl sm:text-5xl">🏆</span>
            </div>
            <p className="text-gray-400 text-sm sm:text-lg">Classement des pronostics CDM 2026</p>
          </div>
        </div>
      </section>

      {/* Live Ranking - Current Day */}
      {liveRanking && liveRanking.matchesToday > 0 && (
        <section className="max-w-4xl mx-auto px-4 pb-6">
          <div className="relative overflow-hidden rounded-3xl border border-[#6366f1]/50 bg-gradient-to-br from-[#6366f1]/10 via-[#0a0a0f] to-[#0a0a0f] p-5">
            <div className="absolute top-0 right-0 w-48 h-48 bg-[#6366f1]/10 rounded-full blur-3xl" />

            {/* Header */}
            <div className="relative flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <span className="text-2xl">📊</span>
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                </div>
                <div>
                  <h3 className="text-white font-bold">Classement Live</h3>
                  <p className="text-gray-500 text-xs">
                    {liveRanking.matchesCompleted}/{liveRanking.matchesToday} matchs joués aujourd&apos;hui
                  </p>
                </div>
              </div>
              {liveRanking.currentLeader && (
                <div className="flex items-center gap-2 bg-[#6366f1]/20 px-3 py-1.5 rounded-full">
                  <span className="text-sm">🔥</span>
                  <span className="text-[#6366f1] text-sm font-bold">{liveRanking.currentLeader.member_name.split(' ')[0]}</span>
                  <span className="text-white text-sm font-bold">{liveRanking.currentLeader.day_points} pts</span>
                </div>
              )}
            </div>

            {/* Ranking List */}
            {liveRanking.ranking.length > 0 ? (
              <div className="relative grid gap-1.5 max-h-[300px] overflow-y-auto">
                {liveRanking.ranking.map((entry, index) => {
                  const isLeader = index === 0;
                  const isCurrentUser = entry.user_id === currentUserId;

                  return (
                    <div
                      key={entry.user_id}
                      className={`flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl transition-all ${
                        isLeader ? 'bg-[#6366f1]/20 border border-[#6366f1]/30' :
                        isCurrentUser ? 'bg-white/5' : ''
                      }`}
                    >
                      <span className={`w-5 sm:w-6 text-center font-bold text-sm ${
                        isLeader ? 'text-[#6366f1]' : 'text-gray-500'
                      }`}>
                        {index + 1}
                      </span>
                      <div className="relative w-6 h-6 sm:w-8 sm:h-8 rounded-full overflow-hidden ring-2 ring-white/10 flex-shrink-0">
                        <Image
                          src={`/members/${entry.member_slug}.png`}
                          alt={entry.member_name}
                          fill
                          className="object-cover object-top"
                        />
                      </div>
                      <span className={`flex-1 text-xs sm:text-sm font-medium truncate ${
                        isLeader ? 'text-white' : 'text-gray-400'
                      }`}>
                        {entry.member_name.split(' ')[0]}
                      </span>
                      <div className="text-right flex-shrink-0">
                        <span className={`font-bold text-sm ${
                          isLeader ? 'text-[#6366f1]' : 'text-white'
                        }`}>
                          {entry.day_points}
                        </span>
                        <span className="text-gray-500 text-xs ml-0.5">pts</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500 text-sm">En attente des premiers résultats...</p>
                <p className="text-gray-600 text-xs mt-1">{liveRanking.matchesToday} matchs prévus aujourd&apos;hui</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Evolution Chart */}
      <section className="max-w-4xl mx-auto px-4 pb-6">
        <EvolutionChart />
      </section>

      {/* Drère of the Week */}
      {dreresWeek.length > 0 && (
        <section className="max-w-4xl mx-auto px-4 pb-6">
          <div className="relative overflow-hidden rounded-3xl border-2 border-[#FFD700] bg-gradient-to-br from-[#FFD700]/20 via-[#FFA500]/10 to-[#0a0a0f] p-6">
            <div className="absolute top-0 right-0 w-60 h-60 bg-[#FFD700]/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-[#FFA500]/10 rounded-full blur-2xl" />
            <div className="absolute -top-2 -left-2 text-5xl">🏆</div>

            <div className="relative flex items-center gap-6 pl-12">
              {/* Stacked avatars for ties */}
              <div className="flex -space-x-4">
                {dreresWeek.map((drere, idx) => (
                  <div
                    key={drere.user_id}
                    className="relative w-20 h-20 rounded-full overflow-hidden ring-4 ring-[#FFD700] bg-[#0a0a0f]"
                    style={{ zIndex: dreresWeek.length - idx }}
                  >
                    <Image
                      src={`/members/${drere.member_slug}.png`}
                      alt={drere.member_name}
                      fill
                      className="object-cover object-top"
                    />
                  </div>
                ))}
              </div>
              <div className="flex-1">
                <p className="text-[#FFD700] text-xs font-bold uppercase tracking-wide">
                  {dreresWeek.length > 1 ? 'Drères of the Week' : 'Drère of the Week'}
                </p>
                <h2 className="text-2xl font-black text-white">
                  {dreresWeek.map(d => d.member_name).join(' & ')}
                </h2>
                <p className="text-[#FFD700] font-bold text-lg">{drereWeekPoints} pts cette semaine</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Drère du jour & Type mzi du jour */}
      <section className="max-w-4xl mx-auto px-4 pb-8 grid md:grid-cols-2 gap-4">
        {/* Drère(s) du jour */}
        {dreresToday.length > 0 && (
          <div className="relative overflow-hidden rounded-3xl border-2 border-[#fbbf24] bg-gradient-to-br from-[#fbbf24]/20 to-[#f59e0b]/10 p-6">
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#fbbf24]/20 rounded-full blur-3xl" />
            <div className="absolute -top-2 -left-2 text-5xl">👑</div>

            <div className="relative flex items-center gap-4 pl-10">
              {/* Stacked avatars for ties */}
              <div className="flex -space-x-3">
                {dreresToday.map((drere, idx) => (
                  <div
                    key={drere.user_id}
                    className="relative w-14 h-14 rounded-full overflow-hidden ring-4 ring-[#fbbf24] bg-[#0a0a0f]"
                    style={{ zIndex: dreresToday.length - idx }}
                  >
                    <Image
                      src={`/members/${drere.member_slug}.png`}
                      alt={drere.member_name}
                      fill
                      className="object-cover object-top"
                    />
                  </div>
                ))}
              </div>
              <div className="flex-1">
                <p className="text-[#fbbf24] text-xs font-bold uppercase tracking-wide">
                  {dreresToday.length > 1 ? 'Drères du jour' : 'Drère du jour'}
                </p>
                <h2 className="text-xl font-black text-white">
                  {dreresToday.map(d => d.member_name).join(' & ')}
                </h2>
                <p className="text-[#fbbf24] font-bold">{drereDayPoints} pts</p>
              </div>
            </div>
          </div>
        )}

        {/* Type(s) mzi du jour */}
        {mzisToday.length > 0 && (
          <div className="relative overflow-hidden rounded-3xl border-2 border-[#ef4444]/50 bg-gradient-to-br from-[#ef4444]/10 to-[#0a0a0f] p-6">
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#ef4444]/10 rounded-full blur-3xl" />
            <div className="absolute -top-2 -left-2 text-5xl">💀</div>

            <div className="relative flex items-center gap-4 pl-10">
              {/* Stacked avatars for ties */}
              <div className="flex -space-x-3">
                {mzisToday.map((mzi, idx) => (
                  <div
                    key={mzi.user_id}
                    className="relative w-14 h-14 rounded-full overflow-hidden ring-4 ring-[#ef4444]/50 bg-[#0a0a0f] grayscale"
                    style={{ zIndex: mzisToday.length - idx }}
                  >
                    <Image
                      src={`/members/${mzi.member_slug}.png`}
                      alt={mzi.member_name}
                      fill
                      className="object-cover object-top"
                    />
                  </div>
                ))}
              </div>
              <div className="flex-1">
                <p className="text-[#ef4444] text-xs font-bold uppercase tracking-wide">
                  {mzisToday.length > 1 ? 'Types mzi du jour' : 'Type mzi du jour'}
                </p>
                <h2 className="text-xl font-black text-white">
                  {mzisToday.map(m => m.member_name).join(' & ')}
                </h2>
                <p className="text-[#ef4444] font-bold">{mziDayPoints ?? 0} pts</p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Main Leaderboard */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="bg-[#12121a] rounded-3xl border border-white/10 overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-6 py-4 bg-[#1e1e2e] text-sm text-gray-400 font-medium">
            <div className="col-span-1">#</div>
            <div className="col-span-4">Membre</div>
            <div className="col-span-2 text-center">Points</div>
            <div className="col-span-2 text-center hidden sm:block">Pronos</div>
            <div className="col-span-2 text-center hidden sm:block">Exacts</div>
            <div className="col-span-1 text-center">👑</div>
          </div>

          {activePlayers.map((entry, index) => {
            const isMe = entry.user_id === currentUserId;

            const pronosRatio = totalMatchesWithResults > 0
              ? Math.round((entry.matches_predicted / totalMatchesWithResults) * 100)
              : 0;
            const isFainéant = totalMatchesWithResults > 0 && entry.matches_predicted < totalMatchesWithResults * 0.5;

            return (
              <div
                key={entry.user_id}
                className={`grid grid-cols-12 gap-2 px-6 py-4 items-center border-t border-white/5 transition-all ${
                  mounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
                } ${isMe ? 'bg-[#6366f1]/10' : ''}`}
                style={{ transitionDelay: `${index * 50}ms` }}
              >
                {/* Rank */}
                <div className="col-span-1 flex items-center gap-2">
                  <span className={`text-lg ${entry.rank <= 3 ? 'font-bold' : ''}`}>
                    {getRankEmoji(entry.rank)}
                  </span>
                  {getRankChange(entry.rank_change)}
                </div>

                {/* Member */}
                <div className="col-span-4 flex items-center gap-3">
                  <div className="relative">
                    <div className={`w-10 h-10 rounded-full overflow-hidden relative ${
                      entry.is_drere_today ? 'ring-2 ring-[#fbbf24]' : ''
                    } ${entry.is_mzi_today ? 'ring-2 ring-[#ef4444] grayscale' : ''}`}>
                      <Image
                        src={`/members/${entry.member_slug}.png`}
                        alt={entry.member_name}
                        fill
                        className="object-cover object-top"
                      />
                    </div>
                    {entry.is_drere_today && (
                      <span className="absolute -top-1 -right-1 text-sm">👑</span>
                    )}
                    {entry.is_mzi_today && (
                      <span className="absolute -top-1 -right-1 text-sm">💀</span>
                    )}
                  </div>
                  <div>
                    <p className={`font-medium ${isMe ? 'text-[#6366f1]' : 'text-white'}`}>
                      {entry.member_name.split(' ')[0]}
                    </p>
                    {entry.crown_count > 0 && (
                      <p className="text-xs text-[#fbbf24]">{entry.crown_count}x 👑</p>
                    )}
                    {entry.mzi_count > 0 && (
                      <p className="text-xs text-[#ef4444]">{entry.mzi_count}x 💀</p>
                    )}
                  </div>
                </div>

                {/* Points */}
                <div className="col-span-2 text-center">
                  <span className={`text-xl font-bold ${
                    entry.rank === 1 ? 'text-[#fbbf24]' :
                    entry.rank === 2 ? 'text-gray-300' :
                    entry.rank === 3 ? 'text-[#cd7f32]' :
                    'text-white'
                  }`}>
                    {entry.total_points}
                  </span>
                  {entry.global_points > 0 && (
                    <p className="text-xs text-[#22c55e]">+{entry.global_points} bonus</p>
                  )}
                </div>

                {/* Pronos faits */}
                <div className="col-span-2 text-center hidden sm:block">
                  {totalMatchesWithResults > 0 ? (
                    <span className={`text-sm ${isFainéant ? 'text-red-400' : 'text-gray-400'}`}>
                      {entry.matches_predicted}/{totalMatchesWithResults}
                      {isFainéant && <span className="ml-1">😴</span>}
                    </span>
                  ) : (
                    <span className="text-gray-600">-</span>
                  )}
                </div>

                {/* Exact scores */}
                <div className="col-span-2 text-center hidden sm:block">
                  {entry.exact_scores > 0 ? (
                    <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium">
                      🎯 {entry.exact_scores}
                    </span>
                  ) : (
                    <span className="text-gray-600">-</span>
                  )}
                </div>

                {/* Crowns */}
                <div className="col-span-1 text-center">
                  {entry.crown_count > 0 ? (
                    <span className="text-[#fbbf24] font-bold">{entry.crown_count}</span>
                  ) : (
                    <span className="text-gray-600">-</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>


      {/* Inactive Players */}
      {inactivePlayers.length > 0 && (
        <section className="max-w-4xl mx-auto px-4 pb-8">
          <div className="bg-[#12121a]/50 rounded-2xl border border-white/5 p-6">
            <h3 className="text-lg font-bold mb-4 text-gray-500 flex items-center gap-2">
              <span>😴</span>
              Joueurs inactifs
              <span className="text-sm font-normal">({inactivePlayers.length})</span>
            </h3>
            <div className="flex flex-wrap gap-3">
              {inactivePlayers.map(player => (
                <div key={player.user_id} className="flex items-center gap-2 bg-white/5 rounded-full px-3 py-2">
                  <div className="relative w-8 h-8 rounded-full overflow-hidden grayscale opacity-50">
                    <Image
                      src={`/members/${player.member_slug}.png`}
                      alt={player.member_name}
                      fill
                      className="object-cover object-top"
                    />
                  </div>
                  <span className="text-gray-500 text-sm">{player.member_name.split(' ')[0]}</span>
                </div>
              ))}
            </div>
            <p className="text-gray-600 text-xs mt-3 italic">Ces joueurs n&apos;ont pas encore fait de pronostics</p>
          </div>
        </section>
      )}

      {/* Fun Stats */}
      {stats && (
        <section className="max-w-4xl mx-auto px-4 pb-12">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <span>📊</span>
            Stats fun
          </h2>

          <div className="grid md:grid-cols-3 gap-4">
            {stats.most_optimistic && (
              <div className="bg-[#12121a] rounded-2xl border border-white/10 p-6">
                <div className="text-3xl mb-2">🌈</div>
                <h3 className="text-lg font-bold text-white mb-1">Le plus optimiste</h3>
                <p className="text-[#6366f1] font-medium">{stats.most_optimistic.member_name}</p>
                <p className="text-gray-500 text-sm">Moy. {stats.most_optimistic.avg_goals} buts/match</p>
              </div>
            )}

            {stats.top_visionary && (
              <div className="bg-[#12121a] rounded-2xl border border-white/10 p-6">
                <div className="text-3xl mb-2">🔮</div>
                <h3 className="text-lg font-bold text-white mb-1">Le visionnaire</h3>
                <p className="text-[#6366f1] font-medium">{stats.top_visionary.member_name}</p>
                <p className="text-gray-500 text-sm">{stats.top_visionary.count}x score exact solo</p>
              </div>
            )}

            {stats.top_follower && (
              <div className="bg-[#12121a] rounded-2xl border border-white/10 p-6">
                <div className="text-3xl mb-2">🐑</div>
                <h3 className="text-lg font-bold text-white mb-1">Le suiveur</h3>
                <p className="text-[#6366f1] font-medium">{stats.top_follower.member_name}</p>
                <p className="text-gray-500 text-sm">{stats.top_follower.count}x même prono qu&apos;un autre</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Legend */}
      <section className="max-w-4xl mx-auto px-4 pb-12">
        <div className="bg-[#12121a] rounded-2xl border border-white/10 p-6">
          <h3 className="text-lg font-bold mb-4">Barème des points</h3>
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 bg-green-500/20 text-green-400 rounded-lg flex items-center justify-center font-bold">+1</span>
              <span className="text-gray-300">Bon résultat (V/N/D)</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 bg-green-500/20 text-green-400 rounded-lg flex items-center justify-center font-bold">+2</span>
              <span className="text-gray-300">Bon résultat + bonne différence</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 bg-[#fbbf24]/20 text-[#fbbf24] rounded-lg flex items-center justify-center font-bold">+3</span>
              <span className="text-gray-300">Score exact 🎯</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 bg-purple-500/20 text-purple-400 rounded-lg flex items-center justify-center font-bold">+1</span>
              <span className="text-gray-300">Bonus visionnaire (exact solo)</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center font-bold">+1</span>
              <span className="text-gray-300">Bonus outsider (prédit victoire petit)</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 bg-[#22c55e]/20 text-[#22c55e] rounded-lg flex items-center justify-center font-bold">+20</span>
              <span className="text-gray-300">Prono global correct (Vainqueur, MVP...)</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
