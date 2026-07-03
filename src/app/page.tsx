'use client';

import { Fragment, useEffect, useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trophy, CalendarRange, ArrowRight, MapPin } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { MEMBERS } from '@/data/members';
import matches from '@/data/matches.json';
import { useSupabase, Activity, ActivityParticipation } from '@/hooks/useSupabase';
import { useTeamOverrides } from '@/hooks/useTeamOverrides';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { FunFactCard } from '@/components/FunFactCard';
import { Badge, ListRow, Avatar, Spinner } from '@/components/ui';
import { CountUp } from '@/components/CountUp';

interface UpcomingActivity extends Activity {
  participations: ActivityParticipation[];
  yesCount: number;
  totalResponses: number;
  isConfirmed: boolean;
  myStatus: 'yes' | 'no' | 'maybe' | null;
}

interface UpcomingMatch {
  matchId: number;
  status: 'yes' | 'maybe';
  yesCount: number;
  totalResponses: number;
  isConfirmed: boolean;
}

interface Match {
  id: number;
  date: string;
  dateDisplay: string;
  time: string;
  match: string;
  stadium: string;
  city: string;
  phase: string;
  group: string;
}


export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState({ matchesJoined: 0, activitiesCreated: 0 });
  const [upcomingActivities, setUpcomingActivities] = useState<UpcomingActivity[]>([]);
  const [myUpcomingMatches, setMyUpcomingMatches] = useState<UpcomingMatch[]>([]);
  const [myPredictions, setMyPredictions] = useState<Set<number>>(new Set());
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const router = useRouter();
  const { currentUser, loading, getUserStats, getUpcomingActivities, getMyUpcomingMatches } = useSupabase();
  const { getTeamNames } = useTeamOverrides();

  // Load user's predictions (single API call instead of 20+)
  const loadPredictions = useCallback(async () => {
    try {
      const res = await fetch('/api/predictions/my-scores');
      if (res.ok) {
        const data = await res.json();
        setMyPredictions(new Set(data.matchIds || []));
      }
    } catch (err) {
      console.error('Error loading predictions:', err);
    }
  }, []);

  const loadData = useCallback(async () => {
    const [userStats, activities, myMatches] = await Promise.all([
      getUserStats(),
      getUpcomingActivities(),
      getMyUpcomingMatches(),
      loadPredictions(),
    ]);
    setStats(userStats);
    setUpcomingActivities(activities);
    setMyUpcomingMatches(myMatches);
  }, [getUserStats, getUpcomingActivities, getMyUpcomingMatches, loadPredictions]);

  useEffect(() => {
    if (!loading && !currentUser) {
      router.push('/login');
      return;
    }

    if (currentUser) {
      loadData();
      setTimeout(() => setMounted(true), 100);
    }
  }, [currentUser, loading, router, loadData]);

  // Get next match for countdown
  const nextMatch = useMemo(() => {
    const now = new Date();
    const upcoming = (matches as Match[])
      .map(m => {
        const [year, month, day] = m.date.split('-').map(Number);
        const [hours, minutes] = m.time.split(':').map(Number);
        return { ...m, dateObj: new Date(year, month - 1, day, hours, minutes) };
      })
      .filter(m => m.dateObj > now)
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    return upcoming[0] || null;
  }, []);

  // Countdown timer effect
  useEffect(() => {
    if (!nextMatch) return;

    const updateCountdown = () => {
      const now = new Date();
      const diff = nextMatch.dateObj.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown({ days, hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextMatch]);

  // Helper to get match data from ID
  const getMatchData = (matchId: number): Match | undefined => {
    return (matches as Match[]).find(m => m.id === matchId);
  };

  // Parse match teams
  const parseMatch = (matchStr: string) => {
    const parts = matchStr.split(' - ');
    return parts.length === 2 ? { team1: parts[0].trim(), team2: parts[1].trim() } : { team1: matchStr, team2: '' };
  };

  // Resolve knockout placeholders ("Vainqueur M73") to real team names via overrides.
  // Placeholders remain only for genuinely undetermined matches.
  const resolveTeams = (matchId: number, matchStr: string) => {
    const def = parseMatch(matchStr);
    const r = getTeamNames(matchId, def.team1, def.team2);
    return { team1: r.home, team2: r.away };
  };

  // Get next upcoming matches (sorted by date)
  const nextMatches = useMemo(() => {
    const now = new Date();
    return (matches as Match[])
      .filter(m => {
        const [year, month, day] = m.date.split('-').map(Number);
        const [hours, minutes] = m.time.split(':').map(Number);
        const matchDate = new Date(year, month - 1, day, hours, minutes);
        return matchDate > now;
      })
      .sort((a, b) => {
        const [yearA, monthA, dayA] = a.date.split('-').map(Number);
        const [hoursA, minutesA] = a.time.split(':').map(Number);
        const dateA = new Date(yearA, monthA - 1, dayA, hoursA, minutesA);

        const [yearB, monthB, dayB] = b.date.split('-').map(Number);
        const [hoursB, minutesB] = b.time.split(':').map(Number);
        const dateB = new Date(yearB, monthB - 1, dayB, hoursB, minutesB);

        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, 6);
  }, []);

  // Count matches needing predictions
  const toPredictCount = useMemo(() => {
    const now = new Date();
    return (matches as Match[]).filter(m => {
      const [year, month, day] = m.date.split('-').map(Number);
      const [hours, minutes] = m.time.split(':').map(Number);
      const matchDate = new Date(year, month - 1, day, hours, minutes);
      return matchDate > now && !myPredictions.has(m.id);
    }).length;
  }, [myPredictions]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <Spinner size={28} />
      </div>
    );
  }

  if (!currentUser) return null;

  const statCards = [
    { value: MEMBERS.length, label: 'Membres', accent: false },
    { value: toPredictCount, label: 'À pronostiquer', accent: true },
    { value: matches.length, label: 'Matchs', accent: false },
    { value: 48, label: 'Équipes', accent: false },
  ];

  const countdownUnits = [
    { value: countdown.days, label: 'jours', pad: 0 },
    { value: countdown.hours, label: 'heures', pad: 2 },
    { value: countdown.minutes, label: 'min', pad: 2 },
    { value: countdown.seconds, label: 'sec', pad: 2 },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <Navbar />

      {/* Hero */}
      <section data-shot="hero" className="relative h-[420px] overflow-hidden">
        <Image
          src="/team/group.png"
          alt="Zbre Team"
          fill
          className="object-cover object-top grayscale contrast-[1.05]"
          priority
        />
        {/* Archive treatment: canvas tint 25% + grain + bottom scrim toward --canvas */}
        <div className="absolute inset-0 bg-[var(--canvas)]/25" />
        <div className="grain absolute inset-0 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--canvas)] via-[var(--canvas)]/60 to-transparent" />

        <div
          className={`absolute inset-x-0 bottom-0 px-4 pb-10 transition-all duration-500 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
        >
          <div className="max-w-5xl mx-auto">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--surface)]/80 backdrop-blur-sm border border-[var(--hairline)] text-xs text-[var(--text-secondary)] mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
              {MEMBERS.length} membres · En ligne
            </div>

            <h1 className="display text-[44px] sm:text-[52px] text-[var(--text-primary)] leading-[1.05]">
              La Zbre Team
            </h1>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/world-cup"
                className="inline-flex h-11 sm:h-9 items-center justify-center rounded-[6px] px-4 text-sm font-medium bg-[var(--accent)] text-[#0A0A0B] transition-opacity duration-150 ease-out hover:opacity-90"
              >
                Coupe du Monde
              </Link>
              <Link
                href="/activities"
                className="inline-flex h-11 sm:h-9 items-center justify-center rounded-[6px] px-4 text-sm font-medium bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--hairline-strong)] transition-colors duration-150 ease-out hover:bg-[var(--surface-raised)]"
              >
                Activités
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats nues — directement sur --canvas, le chiffre EST l'icône (§3) */}
      <section data-shot="stats" className="max-w-5xl mx-auto px-4 pt-16">
        <div className="flex flex-wrap items-start gap-x-14 gap-y-8">
          {statCards.map(({ value, label, accent }) => (
            <div key={label} className="flex flex-col">
              <span className={`score text-[40px] ${accent ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>
                {value}
              </span>
              <span className="eyebrow mt-2">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Fun fact */}
      <section className="max-w-5xl mx-auto px-4 pt-8">
        <FunFactCard />
      </section>

      {/* Next match — PILOTE "Tableau d'affichage" (surface-1, liseré, halo, .score count-up) */}
      {nextMatch && (
        <section className="max-w-5xl mx-auto px-4 pt-8">
          <Link href="/world-cup" className="block">
            <div data-shot="next-match" className="relative overflow-hidden rounded-[10px] bg-[var(--surface-1)] top-light p-6 transition-colors duration-150 hover:bg-[var(--surface-2)]">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-8">
                <div className="min-w-0">
                  <p className="eyebrow">Prochain match</p>
                  <h3 className="mt-3 text-[18px] font-medium text-[var(--text-primary)] truncate">
                    {(() => {
                      const { team1, team2 } = resolveTeams(nextMatch.id, nextMatch.match);
                      return `${team1} — ${team2}`;
                    })()}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {nextMatch.dateDisplay} à {nextMatch.time}
                  </p>
                </div>

                <div className="halo relative flex items-start gap-3 sm:gap-4 shrink-0">
                  {countdownUnits.map((u, i) => (
                    <Fragment key={u.label}>
                      <div className="relative z-10 flex flex-col items-center">
                        <CountUp value={u.value} pad={u.pad} className="score text-[56px] text-[var(--text-primary)]" />
                        <span className="mt-2.5 text-[11px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">{u.label}</span>
                      </div>
                      {i < countdownUnits.length - 1 && (
                        <span className="score text-[40px] text-[var(--text-tertiary)] relative z-10 self-start mt-[6px]">:</span>
                      )}
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* Upcoming matches */}
      {nextMatches.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 pt-12">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <h2 className="display text-[22px] text-[var(--text-primary)]">Prochains matchs</h2>
              {toPredictCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] uppercase tracking-[0.04em] bg-[var(--surface-raised)] border border-[var(--hairline)]">
                  <span className="stat text-[var(--accent)]">{toPredictCount}</span>
                  <span className="text-[var(--text-tertiary)]">à pronostiquer</span>
                </span>
              )}
            </div>
            <Link href="/world-cup" className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
              Voir tous →
            </Link>
          </div>

          <div data-shot="matches">
            {nextMatches.map((match) => {
              const { team1, team2 } = resolveTeams(match.id, match.match);
              const hasPrediction = myPredictions.has(match.id);
              return (
                <Link key={`next-${match.id}`} href="/world-cup" className="block group">
                  <ListRow interactive>
                    <div className="flex flex-col w-16 shrink-0 pr-3">
                      <span className="text-xs text-[var(--text-tertiary)] tabular-nums">{match.dateDisplay}</span>
                      <span className="score text-[15px] text-[var(--text-secondary)]">{match.time}</span>
                    </div>
                    <div className="flex-1 min-w-0 text-[var(--text-primary)] font-medium truncate">
                      {team1} <span className="text-[var(--text-tertiary)]">—</span> {team2}
                    </div>
                    {hasPrediction ? (
                      <Badge variant="accent">Enregistré</Badge>
                    ) : (
                      <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors duration-150 shrink-0">
                        Pronostiquer →
                      </span>
                    )}
                  </ListRow>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* My upcoming events */}
      {(myUpcomingMatches.length > 0 || upcomingActivities.length > 0) && (
        <section className="max-w-5xl mx-auto px-4 pt-12">
          <h2 className="display text-[22px] text-[var(--text-primary)] mb-4">
            Mes prochains rendez-vous
          </h2>

          <div className="rounded-[10px] bg-[var(--surface-1)] top-light overflow-hidden">
            {myUpcomingMatches.slice(0, 3).map((um) => {
              const matchData = getMatchData(um.matchId);
              if (!matchData) return null;
              const { team1, team2 } = resolveTeams(matchData.id, matchData.match);
              const pct = Math.round((um.totalResponses / MEMBERS.length) * 100);
              return (
                <Link key={`match-${um.matchId}`} href="/world-cup" className="block">
                  <ListRow interactive className="py-3">
                    <div className="flex-1 min-w-0">
                      <p className="eyebrow">Match</p>
                      <p className="mt-1 text-[15px] font-medium text-[var(--text-primary)] truncate">
                        {team1} <span className="text-[var(--text-tertiary)]">—</span> {team2}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">{matchData.dateDisplay}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="w-40 h-0.5 bg-[var(--hairline)] rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-[var(--text-tertiary)]">{um.totalResponses}/{MEMBERS.length} ont répondu</span>
                      </div>
                    </div>
                    <Badge variant={um.status === 'yes' ? 'accent' : 'neutral'}>
                      {um.status === 'yes' ? 'Oui' : 'Peut-être'}
                    </Badge>
                  </ListRow>
                </Link>
              );
            })}

            {upcomingActivities.slice(0, 3).map((activity) => {
              const pct = Math.round((activity.totalResponses / MEMBERS.length) * 100);
              const statusLabel =
                activity.myStatus === 'yes' ? 'Oui'
                : activity.myStatus === 'maybe' ? 'Peut-être'
                : activity.myStatus === 'no' ? 'Non'
                : 'Sans réponse';
              return (
                <Link key={`activity-${activity.id}`} href="/activities" className="block">
                  <ListRow interactive className="py-3">
                    <div className="flex-1 min-w-0">
                      <p className="eyebrow">Activité</p>
                      <p className="mt-1 text-[15px] font-medium text-[var(--text-primary)] truncate">{activity.title}</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5 flex items-center gap-1.5">
                        {activity.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3" strokeWidth={1.75} />
                            {activity.location}
                          </span>
                        )}
                        {activity.date && (
                          <span>{format(new Date(activity.date), 'EEE d MMM', { locale: fr })}</span>
                        )}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="w-40 h-0.5 bg-[var(--hairline)] rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-[var(--text-tertiary)]">{activity.totalResponses}/{MEMBERS.length} ont répondu</span>
                      </div>
                    </div>
                    <Badge variant={activity.myStatus === 'yes' ? 'accent' : 'neutral'}>{statusLabel}</Badge>
                  </ListRow>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Navigation cards */}
      <section className="max-w-5xl mx-auto px-4 pt-12">
        <div className="grid md:grid-cols-2 gap-3">
          <Link href="/world-cup" className="block group">
            <div className="rounded-[10px] bg-[var(--surface-1)] top-light p-6 h-full transition-colors duration-150 ease-out hover:bg-[var(--surface-2)]">
              <div className="flex items-center gap-2.5">
                <Trophy className="w-[18px] h-[18px] text-[var(--text-secondary)]" strokeWidth={1.75} />
                <h2 className="text-base font-semibold text-[var(--text-primary)]">Coupe du Monde 2026</h2>
              </div>
              <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
                USA · Mexique · Canada — 104 matchs. Pronostique et regarde-les avec la team.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors duration-150">
                Voir les matchs <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
              </span>
            </div>
          </Link>

          <Link href="/activities" className="block group">
            <div className="rounded-[10px] bg-[var(--surface-1)] top-light p-6 h-full transition-colors duration-150 ease-out hover:bg-[var(--surface-2)]">
              <div className="flex items-center gap-2.5">
                <CalendarRange className="w-[18px] h-[18px] text-[var(--text-secondary)]" strokeWidth={1.75} />
                <h2 className="text-base font-semibold text-[var(--text-primary)]">Activités</h2>
              </div>
              <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
                Propose une soirée, un resto, une sortie.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors duration-150">
                Voir les activités <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* Team */}
      <section className="max-w-5xl mx-auto px-4 pt-12">
        <h2 className="display text-[22px] text-[var(--text-primary)] mb-4">La team</h2>
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-4">
          {MEMBERS.map((member) => {
            const isMe = currentUser.member_slug === member.slug;
            return (
              <div key={member.id} className="text-center">
                <div className="mx-auto w-14 h-14 md:w-20 md:h-20">
                  <Avatar slug={member.slug} name={member.name} size={80} ring={isMe ? 'accent' : 'none'} className="w-full h-full" />
                </div>
                <p className={`mt-2 text-sm truncate ${isMe ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'}`}>
                  {member.name.split(' ')[0]}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Personal stats */}
      <section className="max-w-5xl mx-auto px-4 pt-12">
        <div className="rounded-[10px] bg-[var(--surface-1)] top-light p-5">
          <div className="flex items-center justify-between gap-6 flex-wrap">
            <div className="flex items-center gap-3">
              <Avatar slug={currentUser.member_slug} name={currentUser.member_name} size={40} />
              <div>
                <p className="text-base font-semibold text-[var(--text-primary)]">{currentUser.member_name.split(' ')[0]}</p>
                <p className="text-[13px] text-[var(--text-secondary)]">Ton activité récente</p>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <div>
                <p className="score text-2xl text-[var(--text-primary)]">{myPredictions.size}</p>
                <p className="eyebrow mt-1">Pronos</p>
              </div>
              <div>
                <p className="score text-2xl text-[var(--text-primary)]">{stats.matchesJoined}</p>
                <p className="eyebrow mt-1">Matchs</p>
              </div>
              <div>
                <p className="score text-2xl text-[var(--text-primary)]">{stats.activitiesCreated}</p>
                <p className="eyebrow mt-1">Activités</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--hairline)] mt-16">
        <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="font-medium text-[var(--text-primary)]">ZbrePlanning</span>
          <p className="text-sm text-[var(--text-tertiary)]">
            Made with ❤️ pour la team · Bruxelles 🇧🇪
          </p>
        </div>
      </footer>
    </div>
  );
}
