'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
// import confetti from 'canvas-confetti'; // Temporarily disabled for mobile debugging

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
  is_drere_today: boolean;
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
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('Loading...');

  // Drère celebration state
  const [showDrereCelebration, setShowDrereCelebration] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fire confetti burst - disabled for mobile debugging
  const fireConfetti = useCallback(() => {
    // Confetti temporarily disabled
    console.log('Confetti would fire here');
  }, []);

  // Play/pause celebration music (max 30 seconds)
  const toggleMusic = useCallback(() => {
    // If already playing, just pause
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (audioTimeoutRef.current) {
        clearTimeout(audioTimeoutRef.current);
      }
      return;
    }

    // If paused but audio exists, resume
    if (audioRef.current && audioRef.current.paused) {
      audioRef.current.play();
      setIsPlaying(true);
      fireConfetti();
      return;
    }

    // Create new audio only if none exists
    if (!audioRef.current) {
      audioRef.current = new Audio('/sounds/drere.mp3');
      audioRef.current.volume = 0.7;
      audioRef.current.onended = () => setIsPlaying(false);
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
    }
  }, [isPlaying, fireConfetti]);

  // Close celebration modal - music continues but can be paused
  const closeCelebration = useCallback(() => {
    setShowDrereCelebration(false);

    // Mark as seen today
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('drere-celebration-seen', today);
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        setDebugInfo('Fetching API...');
        const res = await fetch('/api/leaderboard');
        setDebugInfo(`API status: ${res.status}`);

        if (!res.ok) {
          if (res.status === 401) {
            setDebugInfo('401 - Redirecting to login');
            router.push('/login');
            return;
          }
          throw new Error(`Failed to load: ${res.status}`);
        }

        const data = await res.json();
        setDebugInfo(`Got ${data.leaderboard?.length || 0} entries, user: ${data.current_user_id}`);

        setLeaderboard(data.leaderboard || []);
        setStats(data.stats);
        setCurrentUserId(data.current_user_id);
        setTotalMatchesWithResults(data.total_matches_with_results || 0);
        setDrereDayPoints(data.drere_day_points || 0);

        // Check if current user is Drère du jour and hasn't seen celebration today
        // TEST MODE: Force Lionel (user_id: 7) as Drère for testing
        const TEST_MODE = true;
        const TEST_USER_ID = '7'; // Lionel

        const drereEntry = (data.leaderboard || []).find((e: LeaderboardEntry) => e.is_drere_today);
        const isTestDrere = TEST_MODE && data.current_user_id === TEST_USER_ID;

        setDebugInfo(`Entries: ${data.leaderboard?.length}, User: ${data.current_user_id}, TestDrere: ${isTestDrere}`);

        if ((drereEntry && drereEntry.user_id === data.current_user_id) || isTestDrere) {
          // TEST: Always show celebration (skip localStorage check)
          const SKIP_LOCALSTORAGE_CHECK = true;
          const today = new Date().toISOString().split('T')[0];
          const lastSeen = localStorage.getItem('drere-celebration-seen');
          if (SKIP_LOCALSTORAGE_CHECK || lastSeen !== today) {
            setShowDrereCelebration(true);
          }
        }
      } catch (error) {
        console.error('Error loading leaderboard:', error);
        setDebugInfo(`ERROR: ${error}`);
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
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-4">
        <div className="animate-spin w-8 h-8 border-4 border-[#6366f1] border-t-transparent rounded-full" />
        <p className="text-yellow-400 text-sm">{debugInfo}</p>
      </div>
    );
  }

  const drereToday = leaderboard.find(e => e.is_drere_today);
  const woodenSpoon = leaderboard[leaderboard.length - 1];

  const currentUserEntry = leaderboard.find(e => e.user_id === currentUserId);

  // TEST MODE: Use current user as drere for celebration modal
  const TEST_MODE_DISPLAY = true;
  const celebrationEntry = TEST_MODE_DISPLAY ? currentUserEntry : leaderboard.find(e => e.is_drere_today && e.user_id === currentUserId);
  const celebrationPoints = TEST_MODE_DISPLAY ? (drereDayPoints || 99) : drereDayPoints; // 99 for test

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar />

      {/* DEBUG BAR - remove after testing */}
      <div className="bg-yellow-500 text-black text-xs p-2 text-center font-mono">
        DEBUG: {debugInfo} | Entries: {leaderboard.length} | ShowModal: {showDrereCelebration ? 'YES' : 'NO'}
      </div>

      {/* Drère Celebration Modal */}
      {showDrereCelebration && celebrationEntry && (
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
                  src={`/members/${celebrationEntry.member_slug}.png`}
                  alt={celebrationEntry.member_name}
                  width={96}
                  height={96}
                  className="object-cover"
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
                Avec <span className="text-[#fbbf24] font-bold">{celebrationPoints} points</span> aujourd&apos;hui
              </p>

              {/* Music button - big and prominent */}
              <button
                onClick={toggleMusic}
                className={`w-full py-5 rounded-2xl font-bold text-xl transition-all flex items-center justify-center gap-3 mb-4 ${
                  isPlaying
                    ? 'bg-[#ef4444] text-white animate-pulse'
                    : 'bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-black hover:scale-105 animate-bounce'
                }`}
              >
                {isPlaying ? (
                  <>
                    <span className="text-3xl">⏸️</span>
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <span className="text-3xl">🎵</span>
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

      {/* Floating music control - shows when music playing but modal closed */}
      {isPlaying && !showDrereCelebration && (
        <button
          onClick={toggleMusic}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#fbbf24] rounded-full shadow-lg shadow-[#fbbf24]/30 flex items-center justify-center text-2xl hover:scale-110 transition-transform animate-pulse"
          title="Arrêter la musique"
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

      {/* Drère du jour */}
      {drereToday && (
        <section className="max-w-4xl mx-auto px-4 pb-8">
          <div className="relative overflow-hidden rounded-3xl border-2 border-[#fbbf24] bg-gradient-to-br from-[#fbbf24]/20 to-[#f59e0b]/10 p-6">
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#fbbf24]/20 rounded-full blur-3xl" />
            <div className="absolute -top-2 -left-2 text-6xl">👑</div>

            <div className="relative flex items-center gap-4 pl-12">
              <div className="relative w-20 h-20 rounded-full overflow-hidden ring-4 ring-[#fbbf24]">
                <Image
                  src={`/members/${drereToday.member_slug}.png`}
                  alt={drereToday.member_name}
                  fill
                  className="object-cover"
                />
              </div>
              <div>
                <p className="text-[#fbbf24] text-sm font-bold uppercase tracking-wide">Drère du jour</p>
                <h2 className="text-2xl font-black text-white">{drereToday.member_name}</h2>
                <p className="text-gray-400">Meilleur score du jour</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-3xl font-black text-[#fbbf24]">{drereDayPoints}</p>
                <p className="text-sm text-gray-400">points du jour</p>
              </div>
            </div>
          </div>
        </section>
      )}

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

          {leaderboard.map((entry, index) => {
            const isMe = entry.user_id === currentUserId;
            const isLast = index === leaderboard.length - 1;

            const pronosRatio = totalMatchesWithResults > 0
              ? Math.round((entry.matches_predicted / totalMatchesWithResults) * 100)
              : 0;
            const isFainéant = totalMatchesWithResults > 0 && entry.matches_predicted < totalMatchesWithResults * 0.5;

            return (
              <div
                key={entry.user_id}
                className={`grid grid-cols-12 gap-2 px-6 py-4 items-center border-t border-white/5 transition-all ${
                  mounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
                } ${isMe ? 'bg-[#6366f1]/10' : ''} ${isLast ? 'bg-[#ef4444]/5' : ''}`}
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
                    } ${isLast ? 'grayscale' : ''}`}>
                      <Image
                        src={`/members/${entry.member_slug}.png`}
                        alt={entry.member_name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    {entry.is_drere_today && (
                      <span className="absolute -top-1 -right-1 text-sm">👑</span>
                    )}
                    {isLast && (
                      <span className="absolute -bottom-1 -right-1 text-sm">🥄</span>
                    )}
                  </div>
                  <div>
                    <p className={`font-medium ${isMe ? 'text-[#6366f1]' : 'text-white'}`}>
                      {entry.member_name.split(' ')[0]}
                    </p>
                    {entry.crown_count > 0 && (
                      <p className="text-xs text-[#fbbf24]">{entry.crown_count}x Drère</p>
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

      {/* Wooden Spoon Section - Always show last place */}
      {woodenSpoon && leaderboard.length > 1 && (
        <section className="max-w-4xl mx-auto px-4 pb-8">
          <div className="relative overflow-hidden rounded-3xl border border-[#ef4444]/30 bg-gradient-to-br from-[#ef4444]/10 to-[#12121a] p-6">
            <div className="absolute top-0 right-0 text-8xl opacity-20 rotate-12">🥄</div>

            <div className="relative flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden relative grayscale ring-2 ring-[#ef4444]/50">
                <Image
                  src={`/members/${woodenSpoon.member_slug}.png`}
                  alt={woodenSpoon.member_name}
                  fill
                  className="object-cover"
                />
              </div>
              <div>
                <p className="text-[#ef4444] text-sm font-bold uppercase tracking-wide">Wooden Spoon 🥄</p>
                <h3 className="text-xl font-bold text-white">{woodenSpoon.member_name}</h3>
                <p className="text-gray-500 text-sm italic">&quot;La prochaine fois sera la bonne...&quot;</p>
              </div>
            </div>
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
