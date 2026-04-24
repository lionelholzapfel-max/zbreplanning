'use client';

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { MEMBERS } from '@/data/members';
import matches from '@/data/matches.json';
import { useSupabase, Activity, ActivityParticipation } from '@/hooks/useSupabase';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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
  const [showCastor, setShowCastor] = useState(false);
  const [upcomingActivities, setUpcomingActivities] = useState<UpcomingActivity[]>([]);
  const [myUpcomingMatches, setMyUpcomingMatches] = useState<UpcomingMatch[]>([]);
  const router = useRouter();
  const { currentUser, loading, getUserStats, getUpcomingActivities, getMyUpcomingMatches } = useSupabase();

  const loadData = useCallback(async () => {
    const [userStats, activities, myMatches] = await Promise.all([
      getUserStats(),
      getUpcomingActivities(),
      getMyUpcomingMatches(),
    ]);
    setStats(userStats);
    setUpcomingActivities(activities);
    setMyUpcomingMatches(myMatches);
  }, [getUserStats, getUpcomingActivities, getMyUpcomingMatches]);

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

  // Helper to get match data from ID
  const getMatchData = (matchId: number): Match | undefined => {
    return (matches as Match[]).find(m => m.id === matchId);
  };

  // Parse match teams
  const parseMatch = (matchStr: string) => {
    const parts = matchStr.split(' - ');
    return parts.length === 2 ? { team1: parts[0].trim(), team2: parts[1].trim() } : { team1: matchStr, team2: '' };
  };

  if (loading || !currentUser) return null;

  // Calculate days until World Cup
  const worldCupStart = new Date('2026-06-11');
  const today = new Date();
  const daysUntil = Math.ceil((worldCupStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar />

      {/* Hero Section */}
      <section className="relative h-[80vh] flex items-center justify-center overflow-hidden">
        {/* Animated gradient orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[#6366f1]/20 rounded-full blur-[128px] animate-pulse" />
          <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-[#a855f7]/20 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <Image
          src="/team/group.png"
          alt="Zbre Team"
          fill
          className="object-cover object-top"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/70 to-[#0a0a0f]/40" />

        <div className={`relative z-10 text-center px-4 transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white/80 text-sm font-medium mb-6 border border-white/10">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            {MEMBERS.length} membres • En ligne
          </div>

          <h1 className="text-6xl md:text-8xl font-black mb-6">
            <span className="bg-gradient-to-r from-[#6366f1] via-[#a855f7] to-[#ec4899] bg-clip-text text-transparent">La Zbre Team</span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto mb-8">
            Toujours ensemble, toujours prêts pour l&apos;aventure
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link
              href="/world-cup"
              className="px-8 py-4 bg-gradient-to-r from-[#1a472a] to-[#2d5a3d] text-white rounded-2xl font-bold text-lg hover:scale-105 transition-transform shadow-lg shadow-[#1a472a]/30 flex items-center gap-3"
            >
              <span>⚽</span>
              Coupe du Monde
            </Link>
            <Link
              href="/activities"
              className="px-8 py-4 bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white rounded-2xl font-bold text-lg hover:scale-105 transition-transform shadow-lg shadow-[#6366f1]/30 flex items-center gap-3"
            >
              <span>🎉</span>
              Activités
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 rounded-full border-2 border-white/30 flex items-start justify-center p-2">
            <div className="w-1 h-2 bg-white/50 rounded-full animate-pulse" />
          </div>
        </div>
      </section>

      {/* Stats Banner */}
      <section className="max-w-7xl mx-auto px-4 -mt-16 relative z-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass rounded-2xl p-6 text-center border border-white/5 hover:border-[#6366f1]/30 transition-colors group">
            <span className="text-4xl mb-2 block group-hover:scale-110 transition-transform">👥</span>
            <span className="text-3xl font-bold text-white">{MEMBERS.length}</span>
            <p className="text-gray-400 text-sm">Membres</p>
          </div>
          <div className="glass rounded-2xl p-6 text-center border border-white/5 hover:border-[#fbbf24]/30 transition-colors group">
            <span className="text-4xl mb-2 block group-hover:scale-110 transition-transform">⚽</span>
            <span className="text-3xl font-bold text-white">104</span>
            <p className="text-gray-400 text-sm">Matchs à venir</p>
          </div>
          <div className="glass rounded-2xl p-6 text-center border border-white/5 hover:border-[#22c55e]/30 transition-colors group">
            <span className="text-4xl mb-2 block group-hover:scale-110 transition-transform">⏰</span>
            <span className="text-3xl font-bold text-[#fbbf24]">{daysUntil > 0 ? daysUntil : 'C\'est parti!'}</span>
            <p className="text-gray-400 text-sm">{daysUntil > 0 ? 'Jours avant la CDM' : ''}</p>
          </div>
          <div className="glass rounded-2xl p-6 text-center border border-white/5 hover:border-[#ec4899]/30 transition-colors group">
            <span className="text-4xl mb-2 block group-hover:scale-110 transition-transform">🏆</span>
            <span className="text-3xl font-bold text-white">48</span>
            <p className="text-gray-400 text-sm">Équipes</p>
          </div>
        </div>
      </section>

      {/* My Upcoming Events Section */}
      {(myUpcomingMatches.length > 0 || upcomingActivities.length > 0) && (
        <section className="max-w-7xl mx-auto px-4 py-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-3">
                <span className="text-3xl">📅</span>
                Mes prochains rendez-vous
              </h2>
              <p className="text-gray-400 mt-1">Tes events confirmés et à venir</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Upcoming Matches */}
            {myUpcomingMatches.slice(0, 3).map((um) => {
              const matchData = getMatchData(um.matchId);
              if (!matchData) return null;
              const { team1, team2 } = parseMatch(matchData.match);

              return (
                <Link
                  key={`match-${um.matchId}`}
                  href="/world-cup"
                  className="group relative overflow-hidden rounded-2xl border transition-all hover:scale-[1.02]"
                  style={{
                    borderColor: um.isConfirmed ? 'rgba(34, 197, 94, 0.3)' : 'rgba(251, 191, 36, 0.2)',
                    background: um.isConfirmed
                      ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(18, 18, 26, 1))'
                      : 'linear-gradient(135deg, rgba(251, 191, 36, 0.1), rgba(18, 18, 26, 1))',
                  }}
                >
                  {/* Confirmed Badge */}
                  {um.isConfirmed && (
                    <div className="absolute top-3 right-3 px-2 py-1 bg-[#22c55e] text-white text-xs font-bold rounded-lg flex items-center gap-1">
                      <span>✓</span> Confirmé
                    </div>
                  )}

                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">⚽</span>
                      <span className="text-xs text-gray-400">{matchData.dateDisplay}</span>
                      <span className="text-xs text-[#fbbf24] font-bold">{matchData.time}</span>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-1">{team1}</h3>
                    <p className="text-sm text-gray-400 mb-3">vs {team2}</p>

                    {/* Response Progress Bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-400">{um.totalResponses}/{MEMBERS.length} ont répondu</span>
                        <span className="text-[#22c55e] font-bold">{um.yesCount} viennent</span>
                      </div>
                      <div className="h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#22c55e] to-[#16a34a] transition-all"
                          style={{ width: `${(um.totalResponses / MEMBERS.length) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                        um.status === 'yes' ? 'bg-[#22c55e]/20 text-[#22c55e]' : 'bg-[#fbbf24]/20 text-[#fbbf24]'
                      }`}>
                        {um.status === 'yes' ? '✓ Tu viens' : '🤔 Peut-être'}
                      </span>
                      <span className="text-xs text-gray-500 group-hover:text-white transition-colors">
                        Voir →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}

            {/* Upcoming Activities */}
            {upcomingActivities.slice(0, 3).map((activity) => (
              <Link
                key={`activity-${activity.id}`}
                href="/activities"
                className="group relative overflow-hidden rounded-2xl border transition-all hover:scale-[1.02]"
                style={{
                  borderColor: activity.isConfirmed ? 'rgba(34, 197, 94, 0.3)' : 'rgba(99, 102, 241, 0.2)',
                  background: activity.isConfirmed
                    ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(18, 18, 26, 1))'
                    : 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(18, 18, 26, 1))',
                }}
              >
                {/* Confirmed Badge */}
                {activity.isConfirmed && (
                  <div className="absolute top-3 right-3 px-2 py-1 bg-[#22c55e] text-white text-xs font-bold rounded-lg flex items-center gap-1">
                    <span>✓</span> Confirmé
                  </div>
                )}

                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">🎉</span>
                    {activity.date && (
                      <span className="text-xs text-gray-400">
                        {format(new Date(activity.date), 'EEE d MMM', { locale: fr })}
                      </span>
                    )}
                    {activity.time && (
                      <span className="text-xs text-[#6366f1] font-bold">{activity.time}</span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-white mb-1 truncate">{activity.title}</h3>
                  {activity.location && (
                    <p className="text-sm text-gray-400 mb-3 flex items-center gap-1">
                      <span>📍</span> {activity.location}
                    </p>
                  )}

                  {/* Response Progress Bar */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-400">{activity.totalResponses}/{MEMBERS.length} ont répondu</span>
                      <span className="text-[#22c55e] font-bold">{activity.yesCount} viennent</span>
                    </div>
                    <div className="h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#6366f1] to-[#a855f7] transition-all"
                        style={{ width: `${(activity.totalResponses / MEMBERS.length) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                      activity.myStatus === 'yes' ? 'bg-[#22c55e]/20 text-[#22c55e]' :
                      activity.myStatus === 'maybe' ? 'bg-[#fbbf24]/20 text-[#fbbf24]' :
                      activity.myStatus === 'no' ? 'bg-[#ef4444]/20 text-[#ef4444]' :
                      'bg-white/10 text-gray-400'
                    }`}>
                      {activity.myStatus === 'yes' ? '✓ Tu viens' :
                       activity.myStatus === 'maybe' ? '🤔 Peut-être' :
                       activity.myStatus === 'no' ? '✗ Non' : '❓ Pas répondu'}
                    </span>
                    <span className="text-xs text-gray-500 group-hover:text-white transition-colors">
                      Voir →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Empty state */}
          {myUpcomingMatches.length === 0 && upcomingActivities.length === 0 && (
            <div className="text-center py-12 px-4 glass rounded-2xl border border-white/5">
              <span className="text-5xl mb-4 block">📅</span>
              <h3 className="text-xl font-bold mb-2">Aucun événement à venir</h3>
              <p className="text-gray-400 mb-4">Inscris-toi à des matchs ou crée une activité !</p>
              <div className="flex justify-center gap-3">
                <Link href="/world-cup" className="px-4 py-2 bg-[#fbbf24]/20 text-[#fbbf24] rounded-xl font-bold hover:bg-[#fbbf24]/30 transition-colors">
                  ⚽ Voir les matchs
                </Link>
                <Link href="/activities" className="px-4 py-2 bg-[#6366f1]/20 text-[#6366f1] rounded-xl font-bold hover:bg-[#6366f1]/30 transition-colors">
                  🎉 Voir les activités
                </Link>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Quick Actions */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 gap-6">
          {/* World Cup Card */}
          <Link href="/world-cup" className="group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#1a472a] to-[#0d2818] opacity-90" />
            <div className="absolute inset-0 bg-[url('/team/group.png')] bg-cover bg-center opacity-10" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#fbbf24]/10 rounded-full blur-3xl" />

            <div className="relative p-8 h-full min-h-[280px] rounded-3xl border border-[#fbbf24]/20 group-hover:border-[#fbbf24]/50 transition-all">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-[#fbbf24]/20 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                    ⚽
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Coupe du Monde 2026</h2>
                    <p className="text-[#fbbf24]">USA • Mexique • Canada</p>
                  </div>
                </div>
                <span className="text-6xl opacity-20 group-hover:opacity-40 group-hover:rotate-12 transition-all">🏆</span>
              </div>

              <p className="text-gray-300 mb-6 text-lg">
                Regardons les matchs ensemble ! Inscris-toi pour les matchs que tu veux voir avec la team.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <span className="px-4 py-2 bg-[#fbbf24]/20 text-[#fbbf24] rounded-xl text-sm font-bold">
                  📅 11 juin - 19 juillet
                </span>
                <span className="px-4 py-2 bg-white/10 text-white rounded-xl text-sm font-medium">
                  104 matchs
                </span>
              </div>

              <div className="absolute bottom-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[#fbbf24] font-medium flex items-center gap-2">
                  Voir les matchs <span className="text-xl">→</span>
                </span>
              </div>
            </div>
          </Link>

          {/* Activities Card */}
          <Link href="/activities" className="group relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#6366f1]/20 to-[#12121a]" />
            <div className="absolute top-0 left-0 w-64 h-64 bg-[#6366f1]/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#a855f7]/10 rounded-full blur-3xl" />

            <div className="relative p-8 h-full min-h-[280px] rounded-3xl border border-[#6366f1]/20 group-hover:border-[#6366f1]/50 transition-all">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-[#6366f1]/20 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                    📅
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Activités</h2>
                    <p className="text-[#6366f1]">Propose ou rejoins une activité</p>
                  </div>
                </div>
                <span className="text-6xl opacity-20 group-hover:opacity-40 group-hover:rotate-12 transition-all">🎉</span>
              </div>

              <p className="text-gray-300 mb-6 text-lg">
                Soirées, restos, sorties, events... Crée une activité et vois qui est chaud !
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <span className="px-4 py-2 bg-[#6366f1]/20 text-[#6366f1] rounded-xl text-sm font-bold">
                  + Créer une activité
                </span>
                <span className="px-4 py-2 bg-white/10 text-white rounded-xl text-sm font-medium">
                  🍕 🎬 🎮 🍻
                </span>
              </div>

              <div className="absolute bottom-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[#6366f1] font-medium flex items-center gap-2">
                  Voir les activités <span className="text-xl">→</span>
                </span>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Team Members */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold flex items-center gap-3">
              <span className="text-4xl">👥</span>
              La Team
            </h2>
            <p className="text-gray-400 mt-1">{MEMBERS.length} membres • Toujours ensemble</p>
          </div>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-4 md:gap-6">
          {MEMBERS.map((member, index) => (
            <div
              key={member.id}
              className={`text-center group transition-all duration-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ transitionDelay: `${index * 50}ms` }}
            >
              <div className={`relative w-16 h-16 md:w-24 md:h-24 mx-auto mb-3 rounded-full overflow-hidden transition-all duration-300 group-hover:scale-110 ${
                currentUser.member_slug === member.slug
                  ? 'ring-4 ring-[#6366f1] ring-offset-4 ring-offset-[#0a0a0f]'
                  : 'ring-2 ring-[#2a2a3a] group-hover:ring-[#6366f1]/50'
              }`}>
                <Image
                  src={member.photo}
                  alt={member.name}
                  fill
                  className="object-cover"
                />
                {currentUser.member_slug === member.slug && (
                  <div className="absolute inset-0 bg-gradient-to-t from-[#6366f1]/50 to-transparent" />
                )}
              </div>
              <p className={`text-sm md:text-base font-medium truncate px-1 transition-colors ${
                currentUser.member_slug === member.slug ? 'text-[#6366f1]' : 'text-gray-300 group-hover:text-white'
              }`}>
                {member.name.split(' ')[0]}
              </p>
              {currentUser.member_slug === member.slug && (
                <span className="text-xs text-[#6366f1]">C&apos;est toi!</span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Your Stats (personal) */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="glass rounded-3xl p-8 border border-white/5">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative w-16 h-16 rounded-full overflow-hidden ring-4 ring-[#6366f1]">
              <Image
                src={`/members/${currentUser.member_slug}.png`}
                alt={currentUser.member_name}
                fill
                className="object-cover"
              />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Salut {currentUser.member_name.split(' ')[0]} !</h3>
              <p className="text-gray-400">Voici ton activité récente</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-[#1e1e2e] rounded-2xl text-center">
              <span className="text-2xl font-bold text-[#22c55e]">{stats.matchesJoined}</span>
              <p className="text-gray-400 text-sm">Matchs confirmés</p>
            </div>
            <div className="p-4 bg-[#1e1e2e] rounded-2xl text-center">
              <span className="text-2xl font-bold text-[#6366f1]">{stats.activitiesCreated}</span>
              <p className="text-gray-400 text-sm">Activités créées</p>
            </div>
            <div className="p-4 bg-[#1e1e2e] rounded-2xl text-center">
              <span className="text-2xl font-bold text-[#fbbf24]">#{MEMBERS.findIndex(m => m.slug === currentUser.member_slug) + 1}</span>
              <p className="text-gray-400 text-sm">Membre depuis</p>
            </div>
            <div className="p-4 bg-[#1e1e2e] rounded-2xl text-center">
              <span className="text-2xl font-bold text-[#ec4899]">100%</span>
              <p className="text-gray-400 text-sm">Zbre certifié</p>
            </div>
          </div>
        </div>
      </section>

      {/* Castor Easter Egg Section */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <button
          onClick={() => setShowCastor(!showCastor)}
          className="w-full glass rounded-3xl p-6 border border-white/5 hover:border-[#a855f7]/30 transition-all group cursor-pointer"
        >
          <div className="flex items-center justify-center gap-4">
            <span className="text-4xl group-hover:animate-bounce">🦫</span>
            <div className="text-center">
              <p className="text-gray-400 group-hover:text-white transition-colors">
                {showCastor ? 'Cacher le secret...' : 'Psst... clique ici pour un secret'}
              </p>
            </div>
            <span className="text-4xl group-hover:animate-bounce" style={{ animationDelay: '0.1s' }}>🦫</span>
          </div>
        </button>

        {/* Castor Photo */}
        <div className={`mt-6 overflow-hidden transition-all duration-500 ${showCastor ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="relative rounded-3xl overflow-hidden border-4 border-[#a855f7] shadow-2xl shadow-[#a855f7]/20">
            <Image
              src="/team/castor.png"
              alt="La Zbre Team en mode Castor"
              width={1200}
              height={800}
              className="w-full h-auto"
            />
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-6">
              <h3 className="text-2xl font-bold text-white text-center">La Zbre Team - Castor Edition</h3>
              <p className="text-gray-300 text-center mt-2">Les vrais savent 🦫</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#2a2a3a] mt-12">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full overflow-hidden group cursor-pointer" onClick={() => setShowCastor(!showCastor)}>
                <Image
                  src={showCastor ? "/team/castor.png" : "/team/group.png"}
                  alt="Zbre Team"
                  fill
                  className="object-cover transition-transform group-hover:scale-110"
                />
              </div>
              <span className="font-bold gradient-text">ZbrePlanning</span>
            </div>
            <p className="text-gray-500 text-sm">
              Made with ❤️ pour la team • Bruxelles 🇧🇪 {showCastor && '🦫'}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
