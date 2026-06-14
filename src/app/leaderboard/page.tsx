'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import confetti from 'canvas-confetti';

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
  rank_change: number;
}

interface LeaderboardStats {
  most_optimistic: { user_id: string; member_name: string; avg_goals: number } | null;
  top_visionary: { user_id: string; member_name: string; count: number } | null;
  top_follower: { user_id: string; member_name: string; count: number } | null;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<LeaderboardStats | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [totalMatchesWithResults, setTotalMatchesWithResults] = useState(0);
  const [drereDayPoints, setDrereDayPoints] = useState(0);
  const [mziDayPoints, setMziDayPoints] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Drère celebration state
  const [showDrereCelebration, setShowDrereCelebration] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fire confetti burst
  const fireConfetti = useCallback(() => {
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#fbbf24', '#f59e0b', '#22c55e', '#6366f1'],
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#fbbf24', '#f59e0b', '#22c55e', '#6366f1'],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  // Play/pause celebration music (max 30 seconds)
  const toggleMusic = useCallback(() => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (audioTimeoutRef.current) {
        clearTimeout(audioTimeoutRef.current);
      }
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio('/sounds/drere.mp3');
      audioRef.current.volume = 0.7;
      audioRef.current.onended = () => setIsPlaying(false);
    }

    audioRef.current.play();
    setIsPlaying(true);
    fireConfetti();

    // Auto-stop after 30 seconds
    audioTimeoutRef.current = setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
      }
    }, 30000);
  }, [isPlaying, fireConfetti]);

  // Close celebration modal - music continues playing
  const closeCelebration = useCallback(() => {
    setShowDrereCelebration(false);

    // Mark as seen today
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('drere-celebration-seen', today);
  }, []);

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

        // Check if current user is Drère du jour and hasn't seen celebration today
        const drereEntry = data.leaderboard.find((e: LeaderboardEntry) => e.is_drere_today);
        if (drereEntry && drereEntry.user_id === data.current_user_id) {
          const today = new Date().toISOString().split('T')[0];
          const lastSeen = localStorage.getItem('drere-celebration-seen');
          if (lastSeen !== today) {
            setShowDrereCelebration(true);
          }
        }
      } catch (error) {
        console.error('Error loading leaderboard:', error);
      } finally {
        setLoading(false);
        setMounted(true);
      }
    }

    loadData();
  }, [router]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (audioTimeoutRef.current) {
        clearTimeout(audioTimeoutRef.current);
      }
    };
  }, []);

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

  const currentUserEntry = leaderboard.find(e => e.user_id === currentUserId);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar />

      {/* Drère Celebration Modal */}
      {showDrereCelebration && currentUserEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-gradient-to-br from-[#1a1a2e] to-[#0a0a0f] rounded-3xl border-2 border-[#fbbf24] p-8 text-center animate-bounce-in">
            {/* Crown animation */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-7xl animate-bounce">
              👑
            </div>

            {/* Glow effect */}
            <div className="absolute inset-0 bg-[#fbbf24]/10 rounded-3xl blur-xl" />

            <div className="relative">
              {/* Avatar */}
              <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden ring-4 ring-[#fbbf24] shadow-lg shadow-[#fbbf24]/50">
                <Image
                  src={`/members/${currentUserEntry.member_slug}.png`}
                  alt={currentUserEntry.member_name}
                  width={96}
                  height={96}
                  className="object-cover object-top"
                />
              </div>

              {/* Title */}
              <h2 className="text-3xl font-black text-[#fbbf24] mb-2">
                🎉 FÉLICITATIONS ! 🎉
              </h2>
              <p className="text-xl text-white font-bold mb-1">
                Tu es le Drère du jour !
              </p>
              <p className="text-gray-400 mb-6">
                Avec <span className="text-[#fbbf24] font-bold">{drereDayPoints} points</span> aujourd&apos;hui
              </p>

              {/* Music button */}
              <button
                onClick={toggleMusic}
                className={`w-full py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-3 mb-4 ${
                  isPlaying
                    ? 'bg-[#ef4444] text-white animate-pulse'
                    : 'bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-black hover:scale-105'
                }`}
              >
                {isPlaying ? (
                  <>
                    <span className="text-2xl">⏸️</span>
                    <span>Arrêter la musique</span>
                  </>
                ) : (
                  <>
                    <span className="text-2xl">🎵</span>
                    <span>C&apos;est la fête !</span>
                  </>
                )}
              </button>

              {/* Close button */}
              <button
                onClick={closeCelebration}
                className="w-full py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-all"
              >
                Fermer
              </button>

              {/* Fun text */}
              <p className="mt-4 text-sm text-gray-500 italic">
                La victoire te va si bien ! 🏆
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Floating pause button - shows when music playing but modal closed */}
      {isPlaying && !showDrereCelebration && (
        <button
          onClick={toggleMusic}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#fbbf24] rounded-full shadow-lg shadow-[#fbbf24]/30 flex items-center justify-center text-2xl hover:scale-110 transition-transform animate-pulse"
        >
          ⏸️
        </button>
      )}

      {/* Hero */}
      <section className="relative py-12 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#fbbf24]/20 via-[#6366f1]/10 to-transparent" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#fbbf24]/10 rounded-full blur-3xl" />

        <div className={`max-w-4xl mx-auto relative transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <span className="text-5xl">🏆</span>
              <h1 className="text-4xl md:text-5xl font-black">
                <span className="text-white">Leader</span>
                <span className="bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] bg-clip-text text-transparent">board</span>
              </h1>
              <span className="text-5xl">🏆</span>
            </div>
            <p className="text-gray-400 text-lg">Classement des pronostics CDM 2026</p>
          </div>
        </div>
      </section>

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
