'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import matches from '@/data/matches.json';
import { useSupabase, Activity, MatchParticipation } from '@/hooks/useSupabase';
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
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar />

      {/* Header */}
      <section className="relative py-12 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#6366f1]/10 to-transparent" />
        <div className="absolute top-0 left-1/2 w-[600px] h-[300px] -translate-x-1/2 bg-[#6366f1]/10 rounded-full blur-[100px]" />

        <div className={`max-w-7xl mx-auto relative transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <h1 className="text-4xl md:text-5xl font-black flex items-center gap-4 mb-2">
            <span className="text-5xl">🗓️</span>
            Calendrier
          </h1>
          <p className="text-gray-400 text-lg">Tous les événements de la team</p>

          {/* Quick jump to World Cup */}
          <div className="mt-6 flex flex-wrap gap-3">
            <span className="text-gray-500 text-sm self-center">Aller à:</span>
            {worldCupMonths.map(m => (
              <button
                key={m.label}
                onClick={() => setCurrentMonth(m.date)}
                className="px-4 py-2 bg-[#1a472a] text-[#fbbf24] rounded-xl font-medium hover:bg-[#22c55e]/20 transition-colors flex items-center gap-2"
              >
                <span>⚽</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 pb-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Calendar Grid */}
          <div className="lg:col-span-2">
            <div className="glass rounded-3xl p-6 border border-white/5">
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="w-12 h-12 rounded-xl bg-[#1e1e2e] text-gray-400 hover:text-white hover:bg-[#2a2a3a] transition-all flex items-center justify-center text-xl"
                >
                  ←
                </button>
                <h2 className="text-2xl font-bold capitalize">
                  {format(currentMonth, 'MMMM yyyy', { locale: fr })}
                </h2>
                <button
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="w-12 h-12 rounded-xl bg-[#1e1e2e] text-gray-400 hover:text-white hover:bg-[#2a2a3a] transition-all flex items-center justify-center text-xl"
                >
                  →
                </button>
              </div>

              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-2 mb-4">
                {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
                  <div key={day} className="text-center text-sm text-gray-500 font-medium py-2">
                    {day}
                  </div>
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
                      className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all hover:scale-105 ${
                        isSelected
                          ? 'bg-gradient-to-br from-[#6366f1] to-[#a855f7] text-white shadow-lg shadow-[#6366f1]/30 scale-105'
                          : hasMatches
                          ? 'bg-gradient-to-br from-[#1a472a] to-[#0d2818] text-white hover:shadow-lg hover:shadow-[#1a472a]/30'
                          : activityCount > 0
                          ? 'bg-[#6366f1]/20 text-white hover:bg-[#6366f1]/30'
                          : 'hover:bg-[#1e1e2e] text-gray-400 hover:text-white'
                      } ${isTodayDate && !isSelected ? 'ring-2 ring-[#fbbf24]' : ''}`}
                    >
                      <span className={`text-lg font-bold ${isSelected ? 'text-white' : ''}`}>
                        {format(day, 'd')}
                      </span>
                      {(hasMatches || activityCount > 0) && (
                        <div className="flex items-center gap-1 mt-1">
                          {hasMatches && (
                            <span className={`text-xs ${isSelected ? 'text-white/80' : 'text-[#fbbf24]'}`}>
                              {matchCount}⚽
                            </span>
                          )}
                          {activityCount > 0 && (
                            <span className={`text-xs ${isSelected ? 'text-white/80' : 'text-[#6366f1]'}`}>
                              {activityCount}📌
                            </span>
                          )}
                        </div>
                      )}
                      {isTodayDate && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#fbbf24] animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-6 mt-6 pt-6 border-t border-white/10 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-gradient-to-br from-[#1a472a] to-[#0d2818]" />
                  <span className="text-gray-400">Match CDM</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-[#6366f1]/30" />
                  <span className="text-gray-400">Activité</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded ring-2 ring-[#fbbf24]" />
                  <span className="text-gray-400">Aujourd&apos;hui</span>
                </div>
              </div>
            </div>
          </div>

          {/* Selected Day Details */}
          <div>
            <div className="glass rounded-3xl p-6 sticky top-24 border border-white/5">
              {selectedDate ? (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#a855f7] flex items-center justify-center text-2xl">
                      📅
                    </div>
                    <div>
                      <h2 className="text-xl font-bold capitalize">
                        {format(selectedDate, 'EEEE', { locale: fr })}
                      </h2>
                      <p className="text-gray-400">
                        {format(selectedDate, 'd MMMM yyyy', { locale: fr })}
                      </p>
                    </div>
                  </div>

                  {selectedDateMatches.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-bold text-[#fbbf24] mb-3 flex items-center gap-2">
                        <span>⚽</span>
                        Matchs Coupe du Monde
                      </h3>
                      <div className="space-y-3">
                        {selectedDateMatches.map(match => {
                          const { team1, team2 } = parseMatch(match.match);
                          const participation = matchParticipations[match.id] || [];
                          const yesCount = participation.filter(p => p.status === 'yes').length;

                          return (
                            <Link
                              key={match.id}
                              href="/world-cup"
                              className="block p-4 bg-gradient-to-br from-[#1a472a]/50 to-[#0d2818]/50 rounded-2xl border border-[#fbbf24]/20 hover:border-[#fbbf24]/50 transition-all"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-[#fbbf24] font-bold">{match.time}</span>
                                {yesCount > 0 && (
                                  <span className="px-2 py-1 bg-[#22c55e]/20 text-[#22c55e] rounded-lg text-xs font-bold">
                                    {yesCount} viennent
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-white">
                                <span>{getFlag(team1)}</span>
                                <span className="font-medium">{team1}</span>
                                <span className="text-[#fbbf24]">vs</span>
                                <span className="font-medium">{team2}</span>
                                <span>{getFlag(team2)}</span>
                              </div>
                              <p className="text-xs text-gray-500 mt-2">
                                {match.group || match.phase}
                              </p>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedDateActivities.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-[#6366f1] mb-3 flex items-center gap-2">
                        <span>📌</span>
                        Activités
                      </h3>
                      <div className="space-y-3">
                        {selectedDateActivities.map(activity => (
                          <Link
                            key={activity.id}
                            href="/activities"
                            className="block p-4 bg-[#6366f1]/10 rounded-2xl border border-[#6366f1]/20 hover:border-[#6366f1]/50 transition-all"
                          >
                            <h4 className="font-bold text-white mb-1">{activity.title}</h4>
                            {activity.time && (
                              <p className="text-sm text-[#6366f1]">⏰ {activity.time}</p>
                            )}
                            {activity.location && (
                              <p className="text-xs text-gray-500 mt-1">📍 {activity.location}</p>
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedDateMatches.length === 0 && selectedDateActivities.length === 0 && (
                    <div className="text-center py-8">
                      <span className="text-4xl mb-3 block">😴</span>
                      <p className="text-gray-500">Rien de prévu ce jour</p>
                      <Link
                        href="/activities"
                        className="inline-block mt-4 px-4 py-2 bg-[#6366f1]/20 text-[#6366f1] rounded-xl text-sm font-medium hover:bg-[#6366f1]/30 transition-colors"
                      >
                        Proposer une activité
                      </Link>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <span className="text-5xl mb-4 block">📅</span>
                  <p className="text-gray-500 mb-2">Sélectionne une date</p>
                  <p className="text-gray-600 text-sm">pour voir les événements</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass rounded-2xl p-6 text-center border border-white/5 hover:border-[#fbbf24]/30 transition-colors">
            <span className="text-4xl mb-2 block">⚽</span>
            <span className="text-3xl font-bold text-white">104</span>
            <p className="text-gray-400 text-sm">Matchs</p>
          </div>
          <div className="glass rounded-2xl p-6 text-center border border-white/5 hover:border-[#fbbf24]/30 transition-colors">
            <span className="text-4xl mb-2 block">🏆</span>
            <span className="text-3xl font-bold text-[#fbbf24]">1</span>
            <p className="text-gray-400 text-sm">Finale</p>
          </div>
          <div className="glass rounded-2xl p-6 text-center border border-white/5 hover:border-[#6366f1]/30 transition-colors">
            <span className="text-4xl mb-2 block">📅</span>
            <span className="text-3xl font-bold text-white">39</span>
            <p className="text-gray-400 text-sm">Jours de compétition</p>
          </div>
          <div className="glass rounded-2xl p-6 text-center border border-white/5 hover:border-[#6366f1]/30 transition-colors">
            <span className="text-4xl mb-2 block">🌍</span>
            <span className="text-3xl font-bold text-white">48</span>
            <p className="text-gray-400 text-sm">Équipes</p>
          </div>
        </div>
      </section>
    </div>
  );
}
