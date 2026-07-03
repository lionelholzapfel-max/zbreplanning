'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import matches from '@/data/matches.json';
import { useSupabase, Activity, MatchParticipation } from '@/hooks/useSupabase';
import { useTeamOverrides } from '@/hooks/useTeamOverrides';
import { PageHeader } from '@/components/ui';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';

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

// Get country flag emoji
const getFlag = (country: string): string => {
  const flags: Record<string, string> = {
    'Mexique': '🇲🇽', 'Afrique du Sud': '🇿🇦', 'Corée du Sud': '🇰🇷', 'République tchèque': '🇨🇿',
    'Canada': '🇨🇦', 'Bosnie-Herzégovine': '🇧🇦', 'Qatar': '🇶🇦', 'Suisse': '🇨🇭',
    'Brésil': '🇧🇷', 'Maroc': '🇲🇦', 'France': '🇫🇷', 'Belgique': '🇧🇪',
    'Allemagne': '🇩🇪', 'Angleterre': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Espagne': '🇪🇸', 'Argentine': '🇦🇷',
    'Portugal': '🇵🇹', 'Pays-Bas': '🇳🇱', 'Italie': '🇮🇹',
    'Vainqueur': '🎯', 'Perdant': '❌',
  };
  for (const [key, flag] of Object.entries(flags)) {
    if (country.includes(key)) return flag;
  }
  return '⚽';
};

const parseMatch = (matchStr: string) => {
  const parts = matchStr.split(' - ');
  if (parts.length === 2) {
    return { team1: parts[0].trim(), team2: parts[1].trim() };
  }
  return { team1: matchStr, team2: '' };
};

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 5, 1)); // June 2026
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [matchParticipations, setMatchParticipations] = useState<Record<number, MatchParticipation[]>>({});
  const { getActivities, getMatchParticipations } = useSupabase();
  const { getTeamNames } = useTeamOverrides();

  const loadActivities = useCallback(async () => {
    const data = await getActivities();
    setActivities(data);
  }, [getActivities]);

  const loadMatchParticipations = useCallback(async (matchIds: number[]) => {
    const participationsMap: Record<number, MatchParticipation[]> = {};
    await Promise.all(
      matchIds.map(async (matchId) => {
        const participations = await getMatchParticipations(matchId);
        participationsMap[matchId] = participations;
      })
    );
    setMatchParticipations(participationsMap);
  }, [getMatchParticipations]);

  useEffect(() => {
    setMounted(true);
    loadActivities();
  }, [loadActivities]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get first day of week (0 = Sunday, adjusted for Monday start)
  const startDay = monthStart.getDay();
  const emptyDays = Array(startDay === 0 ? 6 : startDay - 1).fill(null);

  // Get matches for a specific date
  const getMatchesForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return (matches as Match[]).filter(m => m.date === dateStr);
  };

  // Get activities for a specific date
  const getActivitiesForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return activities.filter(a => a.date === dateStr);
  };

  // Get all dates with matches
  const datesWithMatches = useMemo(() => {
    const dates = new Set<string>();
    (matches as Match[]).forEach(m => dates.add(m.date));
    return dates;
  }, []);

  const selectedDateMatches = selectedDate ? getMatchesForDate(selectedDate) : [];
  const selectedDateActivities = selectedDate ? getActivitiesForDate(selectedDate) : [];

  // Load participations when date is selected
  useEffect(() => {
    if (selectedDateMatches.length > 0) {
      loadMatchParticipations(selectedDateMatches.map(m => m.id));
    }
  }, [selectedDate, selectedDateMatches.length, loadMatchParticipations]);

  // Quick navigation to World Cup months
  const worldCupMonths = [
    { label: 'Juin 2026', date: new Date(2026, 5, 1) },
    { label: 'Juillet 2026', date: new Date(2026, 6, 1) },
  ];

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <Navbar />

      {/* Header */}
      <section className="max-w-7xl mx-auto px-4 pt-8">
        <PageHeader title="Calendrier" subtitle="Tous les événements de la team" />
        <div className="-mt-2 mb-6 flex flex-wrap items-center gap-2">
          <span className="eyebrow">Aller à</span>
          {worldCupMonths.map(m => (
            <button
              key={m.label}
              onClick={() => setCurrentMonth(m.date)}
              className="h-8 px-3 rounded-full bg-[var(--surface-2)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {m.label}
            </button>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 pb-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Calendar Grid */}
          <div className="lg:col-span-2">
            <div className="rounded-[10px] bg-[var(--surface-1)] top-light p-5">
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-5">
                <button
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="w-9 h-9 rounded-[8px] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center justify-center"
                >
                  ←
                </button>
                <h2 className="display text-[18px] text-[var(--text-primary)] capitalize">
                  {format(currentMonth, 'MMMM yyyy', { locale: fr })}
                </h2>
                <button
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="w-9 h-9 rounded-[8px] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center justify-center"
                >
                  →
                </button>
              </div>

              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-2 mb-3">
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
                  <div key={day} className="text-center eyebrow py-1">{day}</div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-2">
                {/* Empty cells for days before month start */}
                {emptyDays.map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}

                {/* Actual days */}
                {days.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const hasMatches = datesWithMatches.has(dateStr);
                  const matchCount = getMatchesForDate(day).length;
                  const activityCount = getActivitiesForDate(day).length;
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isTodayDate = isToday(day);

                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDate(day)}
                      className={`aspect-square rounded-[8px] flex flex-col items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-[var(--surface-3)] top-light'
                          : (hasMatches || activityCount > 0)
                          ? 'bg-[var(--surface-1)] hover:bg-[var(--surface-2)]'
                          : 'hover:bg-[var(--surface-1)]'
                      } ${isTodayDate && !isSelected ? 'ring-1 ring-[var(--accent)]' : ''}`}
                    >
                      <span className={`text-[15px] ${(hasMatches || activityCount > 0 || isSelected) ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>
                        {format(day, 'd')}
                      </span>
                      {(hasMatches || activityCount > 0) && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {hasMatches && <span className="score text-[11px] text-[var(--accent)]">{matchCount}</span>}
                          {activityCount > 0 && <span className="score text-[11px] text-[var(--text-secondary)]">{activityCount}</span>}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-5 mt-5 pt-5 border-t border-[var(--hairline)]">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                  <span className="text-[12px] text-[var(--text-tertiary)]">Match CDM</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)]" />
                  <span className="text-[12px] text-[var(--text-tertiary)]">Activité</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full ring-1 ring-[var(--accent)]" />
                  <span className="text-[12px] text-[var(--text-tertiary)]">Aujourd&apos;hui</span>
                </div>
              </div>
            </div>
          </div>

          {/* Selected Day Details */}
          <div>
            <div className="rounded-[10px] bg-[var(--surface-1)] top-light p-5 sticky top-24">
              {selectedDate ? (
                <>
                  <div className="mb-5">
                    <h2 className="display text-[18px] text-[var(--text-primary)] capitalize">
                      {format(selectedDate, 'EEEE', { locale: fr })}
                    </h2>
                    <p className="text-[13px] text-[var(--text-secondary)]">
                      {format(selectedDate, 'd MMMM yyyy', { locale: fr })}
                    </p>
                  </div>

                  {selectedDateMatches.length > 0 && (
                    <div className="mb-5">
                      <p className="eyebrow mb-2">Matchs Coupe du Monde</p>
                      <div>
                        {selectedDateMatches.map(match => {
                          const def = parseMatch(match.match);
                          const { home: team1, away: team2 } = getTeamNames(match.id, def.team1, def.team2);
                          const participation = matchParticipations[match.id] || [];
                          const yesCount = participation.filter(p => p.status === 'yes').length;

                          return (
                            <Link
                              key={match.id}
                              href="/world-cup"
                              className="flex items-center gap-3 px-2 py-2 rounded-[8px] hover:bg-[var(--surface-2)] transition-colors"
                            >
                              <span className="score text-[13px] text-[var(--text-tertiary)] w-12 shrink-0">{match.time}</span>
                              <span className="flex-1 min-w-0 text-[13px] text-[var(--text-primary)] truncate">
                                {getFlag(team1)} {team1} <span className="text-[var(--text-tertiary)]">—</span> {team2} {getFlag(team2)}
                              </span>
                              {yesCount > 0 && <span className="text-[12px] text-[var(--text-tertiary)] shrink-0">{yesCount} viennent</span>}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedDateActivities.length > 0 && (
                    <div>
                      <p className="eyebrow mb-2">Activités</p>
                      <div>
                        {selectedDateActivities.map(activity => (
                          <Link
                            key={activity.id}
                            href="/activities"
                            className="block px-2 py-2 rounded-[8px] hover:bg-[var(--surface-2)] transition-colors"
                          >
                            <p className="text-[14px] font-medium text-[var(--text-primary)]">{activity.title}</p>
                            {(activity.time || activity.location) && (
                              <p className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">
                                {activity.time}{activity.time && activity.location && ' · '}{activity.location}
                              </p>
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedDateMatches.length === 0 && selectedDateActivities.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-[13px] text-[var(--text-tertiary)]">Rien de prévu ce jour</p>
                      <Link
                        href="/activities"
                        className="inline-block mt-3 text-[13px] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                      >
                        Proposer une activité
                      </Link>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-[13px] text-[var(--text-secondary)]">Sélectionne une date</p>
                  <p className="mt-1 text-[12px] text-[var(--text-tertiary)]">pour voir les événements</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats — nues */}
        <div className="mt-12 flex flex-wrap items-start gap-x-14 gap-y-8">
          {[
            { value: 104, label: 'Matchs' },
            { value: 1, label: 'Finale' },
            { value: 39, label: 'Jours de compétition' },
            { value: 48, label: 'Équipes' },
          ].map((s) => (
            <div key={s.label} className="flex flex-col">
              <span className="score text-[40px] text-[var(--text-primary)]">{s.value}</span>
              <span className="eyebrow mt-2">{s.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
