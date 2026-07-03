'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { PageHeader, Avatar, RecordCard, EmptyState } from '@/components/ui';
import { MEMBERS } from '@/data/members';

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

interface CountRecordHolder {
  user_id: string;
  member_name: string;
  member_slug: string;
}

interface CountRecordWithHolders {
  count: number;
  holders: CountRecordHolder[];
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
  const [mostDrereRecord, setMostDrereRecord] = useState<CountRecordWithHolders | null>(null);
  const [mostExactScoresRecord, setMostExactScoresRecord] = useState<CountRecordWithHolders | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState<'general' | 'semaine' | 'live'>('general');

  const loadData = useCallback(async () => {
    try {
      setLoadError(false);
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
      setMostDrereRecord(data.most_drere_record || null);
      setMostExactScoresRecord(data.most_exact_scores_record || null);

      // Fetch live ranking
      const liveRes = await fetch('/api/leaderboard/live');
      if (liveRes.ok) {
        const liveData = await liveRes.json();
        setLiveRanking(liveData);
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
      setMounted(true);
    }
  }, [router]);

  useEffect(() => {
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
  }, [loadData]);

  const getRankChange = (change: number) => {
    if (change > 0) return <span className="text-[11px] text-[var(--accent)]">▲{change}</span>;
    if (change < 0) return <span className="text-[11px] text-[var(--danger)]">▼{Math.abs(change)}</span>;
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--canvas)]">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 pt-8 space-y-6">
          {/* Podium skeleton */}
          <div className="flex items-end justify-center gap-4">
            {[64, 96, 48].map((h, i) => (
              <div key={i} className="flex flex-col items-center flex-1 max-w-[120px]">
                <div className={`rounded-full bg-[var(--surface-2)] animate-pulse ${i === 1 ? 'w-20 h-20' : 'w-14 h-14'}`} />
                <div className="mt-2 h-3 w-12 rounded bg-[var(--surface-2)] animate-pulse" />
                <div className="mt-2 w-full rounded-t-xl bg-[var(--surface-2)] animate-pulse" style={{ height: `${h}px` }} />
              </div>
            ))}
          </div>
          {/* Rows skeleton */}
          <div className="bg-[var(--surface-1)] top-light rounded-[10px] overflow-hidden divide-y divide-[var(--hairline)]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-6 py-4">
                <div className="w-6 h-6 rounded bg-[var(--surface-2)] animate-pulse" />
                <div className="w-10 h-10 rounded-full bg-[var(--surface-2)] animate-pulse" />
                <div className="flex-1 h-4 rounded bg-[var(--surface-2)] animate-pulse max-w-[120px]" />
                <div className="w-10 h-5 rounded bg-[var(--surface-2)] animate-pulse" />
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
    crownCount?: number; mziCount?: number;
    rankChange?: number; delta?: number; inactive?: boolean;
  };

  const generalRows: UnifiedRow[] = [
    ...activePlayers.map((e): UnifiedRow => ({
      key: e.user_id, rank: e.rank, slug: e.member_slug, name: e.member_name.split(' ')[0],
      isMe: e.user_id === currentUserId, isDrere: e.is_drere_today, isMzi: e.is_mzi_today,
      points: e.total_points, pronos: `${e.matches_predicted}/${totalMatchesWithResults}`,
      exacts: e.exact_scores, visionnaires: e.visionary_count,
      crownCount: e.crown_count, mziCount: e.mzi_count, rankChange: e.rank_change,
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

  // ---- Records grid: fusion data (K/D leader, Hall of Fame leader, fun-stat slugs) ----
  const slugFor = (id: string) => MEMBERS.find((m) => m.id === id)?.slug ?? '';
  const kdLeader = leaderboard
    .filter((e) => e.crown_count > 0 || e.mzi_count > 0)
    .map((e) => ({ e, ratio: e.mzi_count === 0 ? e.crown_count : e.crown_count / e.mzi_count }))
    .sort((a, b) => b.ratio - a.ratio || b.e.crown_count - a.e.crown_count)[0] ?? null;
  const hallLeader = drereWeekLeaderboard[0] ?? null;
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' });

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <Navbar />

      {/* Header */}
      <section className="max-w-4xl mx-auto px-4 pt-8">
        <PageHeader title="Classement" subtitle="Pronostics CDM 2026" />
      </section>

      {loadError && (
        <section className="max-w-4xl mx-auto px-4 pt-4">
          <div className="flex items-center justify-between gap-3 rounded-[10px] bg-[var(--surface-2)] border border-[var(--danger)]/30 px-4 py-3">
            <p className="text-[13px] text-[var(--text-secondary)]">Impossible de charger — vérifie ta connexion.</p>
            <button onClick={() => loadData()} className="shrink-0 h-8 px-3 rounded-[8px] bg-[var(--surface-3)] text-[13px] text-[var(--text-primary)] hover:bg-[var(--surface-4)] transition-colors">Réessayer</button>
          </div>
        </section>
      )}

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
                  className={`px-3 py-2.5 sm:py-1.5 rounded-[6px] text-[13px] transition-colors ${
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

        {/* Column headers — aligned on the row columns */}
        <div className="flex items-center gap-3 px-3 pb-2">
          <span className="w-7 shrink-0" aria-hidden />
          {activeView === 'general' && <span className="w-5 shrink-0" aria-hidden />}
          <span className="w-8 shrink-0" aria-hidden />
          <span className="flex-1" aria-hidden />
          {activeView === 'general' && (
            <div className="hidden sm:flex items-center gap-4">
              <span className="eyebrow w-12 text-right">Pronos</span>
              <span className="eyebrow w-8 text-right">Exacts</span>
              <span className="eyebrow w-8 text-right">Visio</span>
              <span className="eyebrow w-8 text-right">Drère</span>
              <span className="eyebrow w-8 text-right">Mzi</span>
            </div>
          )}
          {activeView === 'live' && <span className="eyebrow w-10 text-right">Δ</span>}
          <span className="eyebrow w-12 text-right">Pts</span>
        </div>

        <div>
          {rows.length === 0 ? (
            <EmptyState
              title="Rien à afficher"
              description={activeView === 'semaine' ? 'La course de la semaine démarrera avec les premiers pronos.' : activeView === 'live' ? 'Aucun match en direct pour le moment.' : 'Le classement se remplira dès les premiers pronos.'}
            />
          ) : rows.map((r, i) => (
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
                <div className="hidden sm:flex items-center gap-4 text-[var(--text-tertiary)]">
                  <span className="score text-[13px] w-12 text-right tabular-nums">{r.pronos}</span>
                  <span className="score text-[13px] w-8 text-right tabular-nums">{r.exacts}</span>
                  <span className="score text-[13px] w-8 text-right tabular-nums">{r.visionnaires}</span>
                  <span className="score text-[13px] w-8 text-right tabular-nums">{r.crownCount}</span>
                  <span className="score text-[13px] w-8 text-right tabular-nums">{r.mziCount}</span>
                </div>
              )}

              {activeView === 'live' && (
                <span className={`score text-[13px] w-10 text-right tabular-nums ${r.delta && r.delta > 0 ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}>
                  {r.delta && r.delta > 0 ? `+${r.delta}` : '·'}
                </span>
              )}

              <span className="score text-[20px] text-[var(--text-primary)] w-12 text-right tabular-nums">{r.points}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Évolution */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <h2 className="display text-[22px] text-[var(--text-primary)] mb-4">Évolution</h2>
        <EvolutionChart />
      </section>

      {/* Records */}
      <section data-shot="records" className="max-w-4xl mx-auto px-4 pb-8">
        <h2 className="display text-[22px] text-[var(--text-primary)] mb-4">Records</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {dailyRecord && (
            <RecordCard label="Record Drère du jour" value={dailyRecord.points} detail={fmtDate(dailyRecord.date)} holders={[dailyRecord]} />
          )}
          {weeklyRecord && (
            <RecordCard label="Record Drère of the Week" value={weeklyRecord.points} detail={`sem. du ${fmtDate(weeklyRecord.date)}`} holders={[weeklyRecord]} />
          )}
          {mostDrereRecord && mostDrereRecord.holders.length > 0 && (
            <RecordCard label="Plus de Drère du jour" value={mostDrereRecord.count} detail="titres du jour" holders={mostDrereRecord.holders} />
          )}
          {kdLeader && (
            <RecordCard
              label="Meilleur ratio Drère / Mzi"
              value={kdLeader.e.mzi_count === 0 ? `${kdLeader.e.crown_count}.00` : kdLeader.ratio.toFixed(2)}
              detail={`${kdLeader.e.crown_count} drère · ${kdLeader.e.mzi_count} mzi`}
              holders={[kdLeader.e]}
            />
          )}
          {hallLeader && (
            <RecordCard label="Drère of the Week" value={`×${hallLeader.drere_week_count}`} detail={`${hallLeader.total_points_earned} pts gagnés`} holders={[hallLeader]} />
          )}
          {mostExactScoresRecord && mostExactScoresRecord.holders.length > 0 && (
            <RecordCard label="Plus de scores exacts" value={mostExactScoresRecord.count} detail="scores au but près" holders={mostExactScoresRecord.holders} />
          )}
          {stats?.most_optimistic && (
            <RecordCard
              label="Le plus optimiste"
              value={stats.most_optimistic.avg_goals}
              detail="buts/match en moyenne"
              holders={[{ member_name: stats.most_optimistic.member_name, member_slug: slugFor(stats.most_optimistic.user_id) }]}
            />
          )}
          {stats?.top_visionary && (
            <RecordCard
              label="Le visionnaire"
              value={stats.top_visionary.count}
              detail="scores exacts en solo"
              holders={[{ member_name: stats.top_visionary.member_name, member_slug: slugFor(stats.top_visionary.user_id) }]}
            />
          )}
        </div>
      </section>

      {/* Mur de la honte */}
      <section data-shot="wall" className="max-w-4xl mx-auto px-4 pb-8">
        <h2 className="display text-[22px] text-[var(--text-primary)] mb-4">Mur de la honte</h2>
        <WallOfShame />
      </section>

      {/* Barème */}
      <section className="max-w-4xl mx-auto px-4 pb-12">
        <p className="eyebrow mb-3">Barème</p>
        <div className="rounded-[10px] bg-[var(--surface-1)] top-light divide-y divide-[var(--hairline)]">
          {[
            { pts: '+1', label: 'Bon résultat (V/N/D)' },
            { pts: '+2', label: 'Bon résultat + bonne différence' },
            { pts: '+3', label: 'Score exact' },
            { pts: '+1', label: 'Bonus visionnaire (exact solo)' },
            { pts: '+20', label: 'Prono global correct (Vainqueur, MVP…)' },
          ].map((r) => (
            <div key={r.label} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-[13px] text-[var(--text-secondary)]">{r.label}</span>
              <span className="score text-[13px] text-[var(--text-primary)]">{r.pts}</span>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
