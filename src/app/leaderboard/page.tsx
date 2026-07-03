'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

// recharts is heavy (~390 KB) and the chart sits below the fold → load it lazily.
const EvolutionChart = dynamic(
  () => import('@/components/EvolutionChart').then((m) => m.EvolutionChart),
  { ssr: false }
);
import { WallOfShame } from '@/components/WallOfShame';
import { DrereSpeech } from '@/components/DrereSpeech';
import { DrereWeekSong } from '@/components/DrereWeekSong';
import { CountUp } from '@/components/CountUp';
import { PageHeader, Avatar } from '@/components/ui';

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
  matches_predicted: number;
  global_correct: number;
  crown_count: number;
  mzi_count: number;
  drere_week_count: number;
  is_drere_today: boolean;
  is_mzi_today: boolean;
  is_drere_week: boolean;
  rank_change: number;
}

interface DrereWeekLeaderboardEntry {
  rank: number;
  user_id: string;
  member_name: string;
  member_slug: string;
  drere_week_count: number;
  total_points_earned: number;
}

interface WeekRaceEntry {
  rank: number;
  user_id: string;
  member_name: string;
  member_slug: string;
  week_points: number;
}

interface RecordEntry {
  user_id: string;
  member_name: string;
  member_slug: string;
  points: number;
  date: string;
}

interface StreakRecordHolder {
  user_id: string;
  member_name: string;
  member_slug: string;
  start_date: string;
  end_date: string;
}

interface StreakRecordWithHolders {
  streak: number;
  holders: StreakRecordHolder[];
}

interface CountRecordHolder {
  user_id: string;
  member_name: string;
  member_slug: string;
}

interface CountRecordWithHolders {
  count: number;
  holders: CountRecordHolder[];
}

interface AverageRecordHolder {
  user_id: string;
  member_name: string;
  member_slug: string;
  matches_predicted: number;
}

interface AverageRecordWithHolders {
  average: number;
  holders: AverageRecordHolder[];
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
  isLive?: boolean;
  isPreviousDay?: boolean;
  currentDayMatchCount?: number;
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
  const [drereDisplayDate, setDrereDisplayDate] = useState('');
  const [liveRanking, setLiveRanking] = useState<LiveRankingData | null>(null);
  const [drereWeekLeaderboard, setDrereWeekLeaderboard] = useState<DrereWeekLeaderboardEntry[]>([]);
  const [weekRace, setWeekRace] = useState<WeekRaceEntry[]>([]);
  const [weekRaceEnd, setWeekRaceEnd] = useState<string>('');
  const [dailyRecord, setDailyRecord] = useState<RecordEntry | null>(null);
  const [weeklyRecord, setWeeklyRecord] = useState<RecordEntry | null>(null);
  const [dailyStreakRecord, setDailyStreakRecord] = useState<StreakRecordWithHolders | null>(null);
  const [weeklyStreakRecord, setWeeklyStreakRecord] = useState<StreakRecordWithHolders | null>(null);
  const [mostDrereRecord, setMostDrereRecord] = useState<CountRecordWithHolders | null>(null);
  const [mostMziRecord, setMostMziRecord] = useState<CountRecordWithHolders | null>(null);
  const [mostExactScoresRecord, setMostExactScoresRecord] = useState<CountRecordWithHolders | null>(null);
  const [mostVisionaryRecord, setMostVisionaryRecord] = useState<CountRecordWithHolders | null>(null);
  const [bestAverageRecord, setBestAverageRecord] = useState<AverageRecordWithHolders | null>(null);
  const [mziStreakRecord, setMziStreakRecord] = useState<StreakRecordWithHolders | null>(null);
  const [longestWithoutMziRecord, setLongestWithoutMziRecord] = useState<StreakRecordWithHolders | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<'general' | 'semaine' | 'live'>('general');

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
        setDrereDisplayDate(data.drere_display_date || '');
        setDrereWeekLeaderboard(data.drere_week_leaderboard || []);
        setWeekRace(data.week_race || []);
        setWeekRaceEnd(data.week_race_end || '');
        setDailyRecord(data.daily_record || null);
        setWeeklyRecord(data.weekly_record || null);
        setDailyStreakRecord(data.daily_streak_record || null);
        setWeeklyStreakRecord(data.weekly_streak_record || null);
        setMostDrereRecord(data.most_drere_record || null);
        setMostMziRecord(data.most_mzi_record || null);
        setMostExactScoresRecord(data.most_exact_scores_record || null);
        setMostVisionaryRecord(data.most_visionary_record || null);
        setBestAverageRecord(data.best_average_record || null);
        setMziStreakRecord(data.mzi_streak_record || null);
        setLongestWithoutMziRecord(data.longest_without_mzi_record || null);

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

  const getRankChange = (change: number) => {
    if (change > 0) return <span className="text-[11px] text-[var(--accent)]">▲{change}</span>;
    if (change < 0) return <span className="text-[11px] text-[var(--danger)]">▼{Math.abs(change)}</span>;
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 pt-8 space-y-6">
          {/* Podium skeleton */}
          <div className="flex items-end justify-center gap-4">
            {[64, 96, 48].map((h, i) => (
              <div key={i} className="flex flex-col items-center flex-1 max-w-[120px]">
                <div className={`rounded-full bg-white/5 animate-pulse ${i === 1 ? 'w-20 h-20' : 'w-14 h-14'}`} />
                <div className="mt-2 h-3 w-12 rounded bg-white/5 animate-pulse" />
                <div className="mt-2 w-full rounded-t-xl bg-white/5 animate-pulse" style={{ height: `${h}px` }} />
              </div>
            ))}
          </div>
          {/* Rows skeleton */}
          <div className="bg-[#12121a] rounded-3xl border border-white/10 overflow-hidden divide-y divide-white/5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-4">
                <div className="w-6 h-6 rounded bg-white/5 animate-pulse" />
                <div className="w-10 h-10 rounded-full bg-white/5 animate-pulse" />
                <div className="flex-1 h-4 rounded bg-white/5 animate-pulse max-w-[120px]" />
                <div className="w-10 h-5 rounded bg-white/5 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
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

  // ---- Unified table rows (Général / Semaine / Live) ----
  const liveAvailable = !!liveRanking && (liveRanking.matchesToday > 0 || !!liveRanking.isPreviousDay);
  const isLiveActive = !!liveRanking?.isLive;
  const activeView = view === 'live' && !liveAvailable ? 'general' : view;

  type UnifiedRow = {
    key: string; rank: number; slug: string; name: string;
    isMe: boolean; isDrere: boolean; isMzi: boolean;
    points: number; pronos?: string; exacts?: number; visionnaires?: number;
    rankChange?: number; delta?: number; inactive?: boolean;
  };

  const generalRows: UnifiedRow[] = [
    ...activePlayers.map((e): UnifiedRow => ({
      key: e.user_id, rank: e.rank, slug: e.member_slug, name: e.member_name.split(' ')[0],
      isMe: e.user_id === currentUserId, isDrere: e.is_drere_today, isMzi: e.is_mzi_today,
      points: e.total_points, pronos: `${e.matches_predicted}/${totalMatchesWithResults}`,
      exacts: e.exact_scores, visionnaires: e.visionary_count, rankChange: e.rank_change,
    })),
    ...inactivePlayers.map((e, i): UnifiedRow => ({
      key: e.user_id, rank: activePlayers.length + i + 1, slug: e.member_slug, name: e.member_name.split(' ')[0],
      isMe: e.user_id === currentUserId, isDrere: false, isMzi: false,
      points: e.total_points, inactive: true,
    })),
  ];

  const semaineRows: UnifiedRow[] = weekRace.map((e): UnifiedRow => ({
    key: e.user_id, rank: e.rank, slug: e.member_slug, name: e.member_name.split(' ')[0],
    isMe: e.user_id === currentUserId, isDrere: false, isMzi: false, points: e.week_points,
  }));

  const liveRows: UnifiedRow[] = (liveRanking?.ranking ?? []).map((e, i): UnifiedRow => ({
    key: e.user_id, rank: i + 1, slug: e.member_slug, name: e.member_name.split(' ')[0],
    isMe: e.user_id === currentUserId, isDrere: false, isMzi: false,
    points: e.day_points, delta: e.day_points,
  }));

  const rows: UnifiedRow[] = activeView === 'semaine' ? semaineRows : activeView === 'live' ? liveRows : generalRows;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar />

      {/* Header */}
      <section className="max-w-4xl mx-auto px-4 pt-8">
        <PageHeader title="Classement" subtitle="Pronostics CDM 2026" />
      </section>

      {/* Drère / Type mzi du jour */}
      {(dreresToday.length > 0 || mzisToday.length > 0) && (
        <section className="max-w-4xl mx-auto px-4 pb-6 grid md:grid-cols-2 gap-4">
          {dreresToday.length > 0 && (
            <div className="rounded-[10px] bg-[var(--surface-1)] top-light p-5">
              <div className="flex items-center gap-4">
                <div className="flex -space-x-3">
                  {dreresToday.map((d) => (
                    <Avatar key={d.user_id} slug={d.member_slug} name={d.member_name} size={48} ring="gold" />
                  ))}
                </div>
                <div className="min-w-0">
                  <p className="eyebrow">{dreresToday.length > 1 ? 'Drères du jour' : 'Drère du jour'}</p>
                  <p className="mt-1 text-[15px] font-medium text-[var(--text-primary)] truncate">
                    {dreresToday.map((d) => d.member_name.split(' ')[0]).join(' & ')}
                  </p>
                  <p className="mt-1">
                    <span className="score text-[24px] text-[var(--gold)]">{drereDayPoints}</span>
                    <span className="ml-1 text-[13px] text-[var(--text-tertiary)]">pts</span>
                  </p>
                </div>
              </div>
              {drereDisplayDate && (
                <div className="mt-3 space-y-2">
                  {dreresToday.map((d) => (
                    <DrereSpeech
                      key={d.user_id}
                      date={drereDisplayDate}
                      drereUserId={d.user_id}
                      drereName={d.member_name.split(' ')[0]}
                      isMe={d.user_id === currentUserId}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {mzisToday.length > 0 && (
            <div className="rounded-[10px] bg-[var(--surface-1)] top-light p-5">
              <div className="flex items-center gap-4">
                <div className="flex -space-x-3">
                  {mzisToday.map((m) => (
                    <Avatar key={m.user_id} slug={m.member_slug} name={m.member_name} size={48} ring="muted" />
                  ))}
                </div>
                <div className="min-w-0">
                  <p className="eyebrow">{mzisToday.length > 1 ? 'Types mzi du jour' : 'Type mzi du jour'}</p>
                  <p className="mt-1 text-[15px] font-medium text-[var(--text-primary)] truncate">
                    {mzisToday.map((m) => m.member_name.split(' ')[0]).join(' & ')}
                  </p>
                  <p className="mt-1">
                    <span className="score text-[24px] text-[var(--text-secondary)]">{mziDayPoints ?? 0}</span>
                    <span className="ml-1 text-[13px] text-[var(--text-tertiary)]">pts</span>
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[13px] italic text-[var(--text-secondary)]">
                « Honnêtement mec, tu pues la défaite. »
              </p>
            </div>
          )}
        </section>
      )}

      {/* Drère of the Week */}
      {dreresWeek.length > 0 && (
        <section className="max-w-4xl mx-auto px-4 pb-6">
          <div className="rounded-[10px] bg-[var(--surface-1)] top-light p-5">
            <div className="flex items-center gap-4">
              <div className="flex -space-x-4">
                {dreresWeek.map((d) => (
                  <Avatar key={d.user_id} slug={d.member_slug} name={d.member_name} size={56} ring="gold" />
                ))}
              </div>
              <div className="min-w-0">
                <p className="eyebrow">{dreresWeek.length > 1 ? 'Drères of the Week' : 'Drère of the Week'}</p>
                <p className="mt-1 display text-[18px] text-[var(--text-primary)] truncate">
                  {dreresWeek.map((d) => d.member_name.split(' ')[0]).join(' & ')}
                </p>
                <p className="mt-1">
                  <span className="score text-[20px] text-[var(--gold)]">{drereWeekPoints}</span>
                  <span className="ml-1.5 text-[13px] text-[var(--text-tertiary)]">pts cette semaine</span>
                </p>
              </div>
            </div>
            <DrereWeekSong drereName={dreresWeek[0]?.member_name.split(' ')[0] || ''} />
          </div>
        </section>
      )}

      {/* Podium — the signature moment */}
      {activePlayers.length >= 3 && (
        <section data-shot="podium" className="max-w-4xl mx-auto px-4 pt-2 pb-10">
          <div className="flex items-end justify-center gap-8 sm:gap-16">
            {[
              { entry: activePlayers[1], place: 2 },
              { entry: activePlayers[0], place: 1 },
              { entry: activePlayers[2], place: 3 },
            ].map(({ entry, place }) => {
              const first = place === 1;
              return (
                <div key={entry.user_id} className={`flex flex-col items-center ${first ? '-translate-y-5' : ''}`}>
                  <Avatar slug={entry.member_slug} name={entry.member_name} size={first ? 80 : 64} ring={first ? 'gold' : 'none'} />
                  {first ? (
                    <div className="halo relative mt-3">
                      <CountUp value={entry.total_points} className="score text-[56px] text-[var(--gold)] relative z-10" />
                    </div>
                  ) : (
                    <span className="score text-[36px] text-[var(--text-primary)] mt-3">{entry.total_points}</span>
                  )}
                  <p className={`mt-1 ${first ? 'text-[15px]' : 'text-[14px]'} text-[var(--text-primary)]`}>
                    {entry.member_name.split(' ')[0]}
                  </p>
                  <p className="eyebrow mt-1">{place === 1 ? '1ER' : `${place}E`}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Unified table — Général / Semaine / Live (absorbs live + week race + inactive) */}
      <section data-shot="table" className="max-w-4xl mx-auto px-4 pb-8">
        <div className="flex items-center justify-between gap-4 mb-4">
          {isLiveActive ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] text-[var(--live)]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-live absolute inline-flex h-full w-full rounded-full bg-[var(--live)]" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--live)]" />
              </span>
              Live
            </span>
          ) : (
            <span />
          )}
          <div className="inline-flex rounded-[8px] bg-[var(--surface-2)] p-0.5">
            {(['general', 'semaine', 'live'] as const).map((v) => {
              const label = v === 'general' ? 'Général' : v === 'semaine' ? 'Semaine' : 'Live';
              const disabled = v === 'live' && !liveAvailable;
              const active = activeView === v;
              return (
                <button
                  key={v}
                  onClick={() => !disabled && setView(v)}
                  disabled={disabled}
                  className={`px-3 py-1.5 rounded-[6px] text-[13px] transition-colors ${
                    active
                      ? 'bg-[var(--surface-3)] top-light text-[var(--text-primary)]'
                      : disabled
                        ? 'text-[var(--text-tertiary)] opacity-50 cursor-not-allowed'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {activeView === 'semaine' && weekRaceEnd && (() => {
          const diffH = Math.max(0, Math.floor((new Date(weekRaceEnd).getTime() - Date.now()) / 3600000));
          return <p className="mb-3 text-[12px] text-[var(--text-tertiary)]">Reset lundi 6h · verdict dans {diffH}h</p>;
        })()}

        <div>
          {rows.map((r, i) => (
            <div
              key={r.key}
              className={`flex items-center gap-3 min-h-[56px] px-3 border-b border-[var(--hairline)] last:border-b-0 transition-all duration-300 ${
                r.isMe ? 'bg-[var(--surface-1)] top-light' : 'hover:bg-[var(--surface-1)]'
              } ${mounted ? `translate-x-0 ${r.inactive ? 'opacity-45' : 'opacity-100'}` : 'opacity-0 -translate-x-3'}`}
              style={{ transitionDelay: `${Math.min(i, 16) * 30}ms` }}
            >
              <span className="score text-[15px] text-[var(--text-tertiary)] w-7 text-right tabular-nums">{r.rank}</span>
              {activeView === 'general' && (
                <span className="w-5">{r.rankChange !== undefined && getRankChange(r.rankChange)}</span>
              )}
              <Avatar slug={r.slug} name={r.name} size={32} ring={r.isDrere ? 'gold' : r.isMzi ? 'muted' : 'none'} />
              <div className="flex-1 min-w-0">
                <span className={`text-[14px] font-medium truncate ${r.isMe ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                  {r.name}
                </span>
                {r.inactive && <span className="block text-[12px] text-[var(--text-tertiary)]">aucun prono</span>}
              </div>

              {activeView === 'general' && !r.inactive && (
                <div className="hidden sm:flex items-center gap-6 text-[var(--text-tertiary)]">
                  <span className="score text-[13px] w-12 text-right tabular-nums">{r.pronos}</span>
                  <span className="score text-[13px] w-8 text-right tabular-nums">{r.exacts}</span>
                  <span className="score text-[13px] w-8 text-right tabular-nums">{r.visionnaires}</span>
                </div>
              )}

              {activeView === 'live' && (
                <span className={`score text-[13px] tabular-nums ${r.delta && r.delta > 0 ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}>
                  {r.delta && r.delta > 0 ? `+${r.delta}` : '·'}
                </span>
              )}

              <span className="score text-[20px] text-[var(--text-primary)] w-12 text-right tabular-nums">{r.points}</span>
            </div>
          ))}
        </div>
      </section>

      {/* K/D Ratio Leaderboard - Call of Duty style */}
      {(() => {
        // Calculate K/D ratios and sort
        const kdRanking = leaderboard
          .filter(e => e.crown_count > 0 || e.mzi_count > 0)
          .map(e => ({
            ...e,
            kd_ratio: e.mzi_count === 0
              ? e.crown_count // Perfect ratio if no deaths
              : e.crown_count / e.mzi_count,
          }))
          .sort((a, b) => {
            // Sort by K/D ratio descending, then by crown count
            if (b.kd_ratio !== a.kd_ratio) return b.kd_ratio - a.kd_ratio;
            return b.crown_count - a.crown_count;
          });

        if (kdRanking.length === 0) return null;

        return (
          <section className="max-w-4xl mx-auto px-4 pb-6">
            <div className="relative overflow-hidden rounded-3xl border border-[#22c55e]/50 bg-gradient-to-br from-[#22c55e]/10 via-[#0a0a0f] to-[#0a0a0f] p-5">
              <div className="absolute top-0 right-0 w-48 h-48 bg-[#22c55e]/10 rounded-full blur-3xl" />

              {/* Header */}
              <div className="relative flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <span className="text-2xl">⚔️</span>
                  </div>
                  <div>
                    <h3 className="text-white font-bold">Classement K/D</h3>
                    <p className="text-gray-500 text-xs">
                      👑 Drère vs 💀 MZI ratio
                    </p>
                  </div>
                </div>
                {kdRanking[0] && (
                  <div className="flex items-center gap-2 bg-[#22c55e]/20 px-3 py-1.5 rounded-full">
                    <span className="text-sm">🎖️</span>
                    <span className="text-[#22c55e] text-sm font-bold">{kdRanking[0].member_name.split(' ')[0]}</span>
                    <span className="text-white text-sm font-bold">
                      {kdRanking[0].kd_ratio === Infinity ? '∞' : kdRanking[0].kd_ratio.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Ranking List */}
              <div className="relative grid gap-1.5 max-h-[300px] overflow-y-auto">
                {kdRanking.map((entry, index) => {
                  const isLeader = index === 0;
                  const isCurrentUser = entry.user_id === currentUserId;
                  const kdDisplay = entry.mzi_count === 0
                    ? `${entry.crown_count}.00`
                    : entry.kd_ratio.toFixed(2);

                  return (
                    <div
                      key={entry.user_id}
                      className={`flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl transition-all ${
                        isLeader ? 'bg-[#22c55e]/20 border border-[#22c55e]/30' :
                        isCurrentUser ? 'bg-white/5' : ''
                      }`}
                    >
                      <span className={`w-5 sm:w-6 text-center font-bold text-sm ${
                        isLeader ? 'text-[#22c55e]' : 'text-gray-500'
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
                      <div className="text-center flex-shrink-0 min-w-[60px]">
                        <span className="text-[#fbbf24] text-sm font-bold">{entry.crown_count}</span>
                        <span className="text-gray-500 text-xs mx-1">/</span>
                        <span className="text-[#ef4444] text-sm font-bold">{entry.mzi_count}</span>
                      </div>
                      <div className="text-right flex-shrink-0 min-w-[50px]">
                        <span className={`font-bold text-sm ${
                          entry.kd_ratio >= 1 ? 'text-[#22c55e]' : 'text-[#ef4444]'
                        }`}>
                          {kdDisplay}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })()}

      {/* Drère of the Week Leaderboard */}
      {drereWeekLeaderboard.length > 0 && (
        <section className="max-w-4xl mx-auto px-4 pb-6">
          <div className="relative overflow-hidden rounded-3xl border border-[#FFD700]/50 bg-gradient-to-br from-[#FFD700]/10 via-[#0a0a0f] to-[#0a0a0f] p-5">
            <div className="absolute top-0 right-0 w-48 h-48 bg-[#FFD700]/10 rounded-full blur-3xl" />

            {/* Header */}
            <div className="relative flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <span className="text-2xl">🏆</span>
                </div>
                <div>
                  <h3 className="text-white font-bold">Hall of Fame - Drère of the Week</h3>
                  <p className="text-gray-500 text-xs">
                    Victoires hebdomadaires
                  </p>
                </div>
              </div>
              {drereWeekLeaderboard[0] && (
                <div className="flex items-center gap-2 bg-[#FFD700]/20 px-3 py-1.5 rounded-full">
                  <span className="text-sm">👑</span>
                  <span className="text-[#FFD700] text-sm font-bold">{drereWeekLeaderboard[0].member_name.split(' ')[0]}</span>
                  <span className="text-white text-sm font-bold">
                    {drereWeekLeaderboard[0].drere_week_count}x
                  </span>
                </div>
              )}
            </div>

            {/* Ranking List */}
            <div className="relative grid gap-1.5 max-h-[300px] overflow-y-auto">
              {drereWeekLeaderboard.map((entry, index) => {
                const isLeader = index === 0;
                const isCurrentUser = entry.user_id === currentUserId;

                return (
                  <div
                    key={entry.user_id}
                    className={`flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl transition-all ${
                      isLeader ? 'bg-[#FFD700]/20 border border-[#FFD700]/30' :
                      isCurrentUser ? 'bg-white/5' : ''
                    }`}
                  >
                    <span className={`w-5 sm:w-6 text-center font-bold text-sm ${
                      isLeader ? 'text-[#FFD700]' : 'text-gray-500'
                    }`}>
                      {entry.rank}
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
                    <div className="text-center flex-shrink-0 min-w-[50px]">
                      <span className="text-[#FFD700] text-sm font-bold">{entry.drere_week_count}</span>
                      <span className="text-gray-500 text-xs ml-1">🏆</span>
                    </div>
                    <div className="text-right flex-shrink-0 min-w-[70px]">
                      <span className="text-[#22c55e] font-bold text-sm">
                        {entry.total_points_earned}
                      </span>
                      <span className="text-gray-500 text-xs ml-1">pts</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Evolution Chart */}
      <section className="max-w-4xl mx-auto px-4 pb-6">
        <EvolutionChart />
      </section>

      {/* Wall of Shame */}
      <section className="max-w-4xl mx-auto px-4 pb-6">
        <WallOfShame />
      </section>

      {/* Records */}
      {(dailyRecord || weeklyRecord || dailyStreakRecord || weeklyStreakRecord || mostDrereRecord || mostMziRecord || mostExactScoresRecord || mostVisionaryRecord || bestAverageRecord || mziStreakRecord || longestWithoutMziRecord) && (
        <section className="max-w-4xl mx-auto px-4 pb-6">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <span>🏅</span>
            Records
          </h2>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Daily Record */}
            {dailyRecord && (
              <div className="relative overflow-hidden bg-gradient-to-br from-[#fbbf24]/20 to-[#0a0a0f] rounded-2xl border border-[#fbbf24]/30 p-5">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#fbbf24]/10 rounded-full blur-2xl" />
                <div className="relative flex items-center gap-4">
                  <div className="relative w-14 h-14 rounded-full overflow-hidden ring-4 ring-[#fbbf24] flex-shrink-0">
                    <Image
                      src={`/members/${dailyRecord.member_slug}.png`}
                      alt={dailyRecord.member_name}
                      fill
                      className="object-cover object-top"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-[#fbbf24] text-xs font-bold uppercase tracking-wide">
                      Record Drère du Jour
                    </p>
                    <p className="text-white font-bold text-lg">
                      {dailyRecord.member_name.split(' ')[0]}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-[#fbbf24] font-black text-2xl">{dailyRecord.points}</span>
                      <span className="text-gray-400 text-sm">pts</span>
                      <span className="text-gray-500 text-xs ml-2">
                        ({new Date(dailyRecord.date).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Weekly Record */}
            {weeklyRecord && (
              <div className="relative overflow-hidden bg-gradient-to-br from-[#FFD700]/20 to-[#0a0a0f] rounded-2xl border border-[#FFD700]/30 p-5">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFD700]/10 rounded-full blur-2xl" />
                <div className="relative flex items-center gap-4">
                  <div className="relative w-14 h-14 rounded-full overflow-hidden ring-4 ring-[#FFD700] flex-shrink-0">
                    <Image
                      src={`/members/${weeklyRecord.member_slug}.png`}
                      alt={weeklyRecord.member_name}
                      fill
                      className="object-cover object-top"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-[#FFD700] text-xs font-bold uppercase tracking-wide">
                      Record Drère of the Week
                    </p>
                    <p className="text-white font-bold text-lg">
                      {weeklyRecord.member_name.split(' ')[0]}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-[#FFD700] font-black text-2xl">{weeklyRecord.points}</span>
                      <span className="text-gray-400 text-sm">pts</span>
                      <span className="text-gray-500 text-xs ml-2">
                        (sem. du {new Date(weeklyRecord.date).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })})
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Daily Streak Record */}
            {dailyStreakRecord && dailyStreakRecord.holders.length > 0 && (
              <div className="relative overflow-hidden bg-gradient-to-br from-[#f97316]/20 to-[#0a0a0f] rounded-2xl border border-[#f97316]/30 p-5">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#f97316]/10 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-3">
                    {/* Stacked avatars for ties */}
                    <div className="flex -space-x-3">
                      {dailyStreakRecord.holders.map((holder, idx) => (
                        <div
                          key={holder.user_id}
                          className="relative w-12 h-12 rounded-full overflow-hidden ring-4 ring-[#f97316] bg-[#0a0a0f]"
                          style={{ zIndex: dailyStreakRecord.holders.length - idx }}
                        >
                          <Image
                            src={`/members/${holder.member_slug}.png`}
                            alt={holder.member_name}
                            fill
                            className="object-cover object-top"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex-1">
                      <p className="text-[#f97316] text-xs font-bold uppercase tracking-wide">
                        Série Drère du Jour
                      </p>
                      <p className="text-white font-bold text-lg">
                        {dailyStreakRecord.holders.map(h => h.member_name.split(' ')[0]).join(' & ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[#f97316] font-black text-2xl">{dailyStreakRecord.streak}</span>
                    <span className="text-gray-400 text-sm">jours d&apos;affilée</span>
                  </div>
                  <div className="space-y-1">
                    {dailyStreakRecord.holders.map(holder => (
                      <p key={holder.user_id} className="text-gray-500 text-xs">
                        {holder.member_name.split(' ')[0]}: {new Date(holder.start_date).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })} → {new Date(holder.end_date).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Weekly Streak Record */}
            {weeklyStreakRecord && weeklyStreakRecord.holders.length > 0 && (
              <div className="relative overflow-hidden bg-gradient-to-br from-[#a855f7]/20 to-[#0a0a0f] rounded-2xl border border-[#a855f7]/30 p-5">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#a855f7]/10 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-3">
                    {/* Stacked avatars for ties */}
                    <div className="flex -space-x-3">
                      {weeklyStreakRecord.holders.map((holder, idx) => (
                        <div
                          key={holder.user_id}
                          className="relative w-12 h-12 rounded-full overflow-hidden ring-4 ring-[#a855f7] bg-[#0a0a0f]"
                          style={{ zIndex: weeklyStreakRecord.holders.length - idx }}
                        >
                          <Image
                            src={`/members/${holder.member_slug}.png`}
                            alt={holder.member_name}
                            fill
                            className="object-cover object-top"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex-1">
                      <p className="text-[#a855f7] text-xs font-bold uppercase tracking-wide">
                        Série Drère of the Week
                      </p>
                      <p className="text-white font-bold text-lg">
                        {weeklyStreakRecord.holders.map(h => h.member_name.split(' ')[0]).join(' & ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[#a855f7] font-black text-2xl">{weeklyStreakRecord.streak}</span>
                    <span className="text-gray-400 text-sm">semaines d&apos;affilée</span>
                  </div>
                  <div className="space-y-1">
                    {weeklyStreakRecord.holders.map(holder => (
                      <p key={holder.user_id} className="text-gray-500 text-xs">
                        {holder.member_name.split(' ')[0]}: sem. {new Date(holder.start_date).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })} → {new Date(holder.end_date).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Most Drère du Jour */}
            {mostDrereRecord && mostDrereRecord.holders.length > 0 && (
              <div className="relative overflow-hidden bg-gradient-to-br from-[#fbbf24]/20 to-[#0a0a0f] rounded-2xl border border-[#fbbf24]/30 p-5">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#fbbf24]/10 rounded-full blur-2xl" />
                <div className="relative flex items-center gap-4">
                  <div className="flex -space-x-3">
                    {mostDrereRecord.holders.map((holder, idx) => (
                      <div
                        key={holder.user_id}
                        className="relative w-12 h-12 rounded-full overflow-hidden ring-4 ring-[#fbbf24] bg-[#0a0a0f]"
                        style={{ zIndex: mostDrereRecord.holders.length - idx }}
                      >
                        <Image
                          src={`/members/${holder.member_slug}.png`}
                          alt={holder.member_name}
                          fill
                          className="object-cover object-top"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex-1">
                    <p className="text-[#fbbf24] text-xs font-bold uppercase tracking-wide">
                      Plus de Drère du Jour
                    </p>
                    <p className="text-white font-bold text-lg">
                      {mostDrereRecord.holders.map(h => h.member_name.split(' ')[0]).join(' & ')}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-[#fbbf24] font-black text-2xl">{mostDrereRecord.count}</span>
                      <span className="text-gray-400 text-sm">👑</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Most Type MZI du Jour */}
            {mostMziRecord && mostMziRecord.holders.length > 0 && (
              <div className="relative overflow-hidden bg-gradient-to-br from-[#ef4444]/20 to-[#0a0a0f] rounded-2xl border border-[#ef4444]/30 p-5">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#ef4444]/10 rounded-full blur-2xl" />
                <div className="relative flex items-center gap-4">
                  <div className="flex -space-x-3">
                    {mostMziRecord.holders.map((holder, idx) => (
                      <div
                        key={holder.user_id}
                        className="relative w-12 h-12 rounded-full overflow-hidden ring-4 ring-[#ef4444] bg-[#0a0a0f] grayscale"
                        style={{ zIndex: mostMziRecord.holders.length - idx }}
                      >
                        <Image
                          src={`/members/${holder.member_slug}.png`}
                          alt={holder.member_name}
                          fill
                          className="object-cover object-top"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex-1">
                    <p className="text-[#ef4444] text-xs font-bold uppercase tracking-wide">
                      Plus de Type MZI du Jour
                    </p>
                    <p className="text-white font-bold text-lg">
                      {mostMziRecord.holders.map(h => h.member_name.split(' ')[0]).join(' & ')}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-[#ef4444] font-black text-2xl">{mostMziRecord.count}</span>
                      <span className="text-gray-400 text-sm">💀</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Most Exact Scores */}
            {mostExactScoresRecord && mostExactScoresRecord.holders.length > 0 && (
              <div className="relative overflow-hidden bg-gradient-to-br from-[#22c55e]/20 to-[#0a0a0f] rounded-2xl border border-[#22c55e]/30 p-5">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#22c55e]/10 rounded-full blur-2xl" />
                <div className="relative flex items-center gap-4">
                  <div className="flex -space-x-3">
                    {mostExactScoresRecord.holders.map((holder, idx) => (
                      <div
                        key={holder.user_id}
                        className="relative w-12 h-12 rounded-full overflow-hidden ring-4 ring-[#22c55e] bg-[#0a0a0f]"
                        style={{ zIndex: mostExactScoresRecord.holders.length - idx }}
                      >
                        <Image
                          src={`/members/${holder.member_slug}.png`}
                          alt={holder.member_name}
                          fill
                          className="object-cover object-top"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex-1">
                    <p className="text-[#22c55e] text-xs font-bold uppercase tracking-wide">
                      Plus de Scores Exacts
                    </p>
                    <p className="text-white font-bold text-lg">
                      {mostExactScoresRecord.holders.map(h => h.member_name.split(' ')[0]).join(' & ')}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-[#22c55e] font-black text-2xl">{mostExactScoresRecord.count}</span>
                      <span className="text-gray-400 text-sm">🎯</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Most Visionary Bonuses */}
            {mostVisionaryRecord && mostVisionaryRecord.holders.length > 0 && (
              <div className="relative overflow-hidden bg-gradient-to-br from-[#8b5cf6]/20 to-[#0a0a0f] rounded-2xl border border-[#8b5cf6]/30 p-5">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#8b5cf6]/10 rounded-full blur-2xl" />
                <div className="relative flex items-center gap-4">
                  <div className="flex -space-x-3">
                    {mostVisionaryRecord.holders.map((holder, idx) => (
                      <div
                        key={holder.user_id}
                        className="relative w-12 h-12 rounded-full overflow-hidden ring-4 ring-[#8b5cf6] bg-[#0a0a0f]"
                        style={{ zIndex: mostVisionaryRecord.holders.length - idx }}
                      >
                        <Image
                          src={`/members/${holder.member_slug}.png`}
                          alt={holder.member_name}
                          fill
                          className="object-cover object-top"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex-1">
                    <p className="text-[#8b5cf6] text-xs font-bold uppercase tracking-wide">
                      Plus de Bonus Visionnaire
                    </p>
                    <p className="text-white font-bold text-lg">
                      {mostVisionaryRecord.holders.map(h => h.member_name.split(' ')[0]).join(' & ')}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-[#8b5cf6] font-black text-2xl">{mostVisionaryRecord.count}</span>
                      <span className="text-gray-400 text-sm">🔮</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Best Average Points */}
            {bestAverageRecord && bestAverageRecord.holders.length > 0 && (
              <div className="relative overflow-hidden bg-gradient-to-br from-[#06b6d4]/20 to-[#0a0a0f] rounded-2xl border border-[#06b6d4]/30 p-5">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#06b6d4]/10 rounded-full blur-2xl" />
                <div className="relative flex items-center gap-4">
                  <div className="flex -space-x-3">
                    {bestAverageRecord.holders.map((holder, idx) => (
                      <div
                        key={holder.user_id}
                        className="relative w-12 h-12 rounded-full overflow-hidden ring-4 ring-[#06b6d4] bg-[#0a0a0f]"
                        style={{ zIndex: bestAverageRecord.holders.length - idx }}
                      >
                        <Image
                          src={`/members/${holder.member_slug}.png`}
                          alt={holder.member_name}
                          fill
                          className="object-cover object-top"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex-1">
                    <p className="text-[#06b6d4] text-xs font-bold uppercase tracking-wide">
                      Meilleure Moyenne
                    </p>
                    <p className="text-white font-bold text-lg">
                      {bestAverageRecord.holders.map(h => h.member_name.split(' ')[0]).join(' & ')}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-[#06b6d4] font-black text-2xl">{bestAverageRecord.average}</span>
                      <span className="text-gray-400 text-sm">pts/match</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Longest Without MZI */}
            {longestWithoutMziRecord && longestWithoutMziRecord.holders.length > 0 && (
              <div className="relative overflow-hidden bg-gradient-to-br from-[#10b981]/20 to-[#0a0a0f] rounded-2xl border border-[#10b981]/30 p-5">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#10b981]/10 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex -space-x-3">
                      {longestWithoutMziRecord.holders.map((holder, idx) => (
                        <div
                          key={holder.user_id}
                          className="relative w-12 h-12 rounded-full overflow-hidden ring-4 ring-[#10b981] bg-[#0a0a0f]"
                          style={{ zIndex: longestWithoutMziRecord.holders.length - idx }}
                        >
                          <Image
                            src={`/members/${holder.member_slug}.png`}
                            alt={holder.member_name}
                            fill
                            className="object-cover object-top"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex-1">
                      <p className="text-[#10b981] text-xs font-bold uppercase tracking-wide">
                        Plus Long sans MZI
                      </p>
                      <p className="text-white font-bold text-lg">
                        {longestWithoutMziRecord.holders.map(h => h.member_name.split(' ')[0]).join(' & ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[#10b981] font-black text-2xl">{longestWithoutMziRecord.streak}</span>
                    <span className="text-gray-400 text-sm">jours sans 💀</span>
                  </div>
                  <div className="space-y-1">
                    {longestWithoutMziRecord.holders.map(holder => (
                      <p key={holder.user_id} className="text-gray-500 text-xs">
                        {holder.member_name.split(' ')[0]}: {new Date(holder.start_date).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })} → {new Date(holder.end_date).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* MZI Streak (Shame Record) */}
            {mziStreakRecord && mziStreakRecord.holders.length > 0 && (
              <div className="relative overflow-hidden bg-gradient-to-br from-[#dc2626]/20 to-[#0a0a0f] rounded-2xl border border-[#dc2626]/30 p-5">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#dc2626]/10 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex -space-x-3">
                      {mziStreakRecord.holders.map((holder, idx) => (
                        <div
                          key={holder.user_id}
                          className="relative w-12 h-12 rounded-full overflow-hidden ring-4 ring-[#dc2626] bg-[#0a0a0f] grayscale"
                          style={{ zIndex: mziStreakRecord.holders.length - idx }}
                        >
                          <Image
                            src={`/members/${holder.member_slug}.png`}
                            alt={holder.member_name}
                            fill
                            className="object-cover object-top"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex-1">
                      <p className="text-[#dc2626] text-xs font-bold uppercase tracking-wide">
                        Série MZI (La Honte)
                      </p>
                      <p className="text-white font-bold text-lg">
                        {mziStreakRecord.holders.map(h => h.member_name.split(' ')[0]).join(' & ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[#dc2626] font-black text-2xl">{mziStreakRecord.streak}</span>
                    <span className="text-gray-400 text-sm">💀 d&apos;affilée</span>
                  </div>
                  <div className="space-y-1">
                    {mziStreakRecord.holders.map(holder => (
                      <p key={holder.user_id} className="text-gray-500 text-xs">
                        {holder.member_name.split(' ')[0]}: {new Date(holder.start_date).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })} → {new Date(holder.end_date).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' })}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}
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
              <span className="w-8 h-8 bg-[#22c55e]/20 text-[#22c55e] rounded-lg flex items-center justify-center font-bold">+20</span>
              <span className="text-gray-300">Prono global correct (Vainqueur, MVP...)</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
