'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useSupabase, Activity, ActivityParticipation } from '@/hooks/useSupabase';

const ACTIVITY_TYPES = [
  { id: 'resto', label: 'Restaurant', icon: '🍕', description: 'Sortie resto entre potes' },
  { id: 'bar', label: 'Bar / Drinks', icon: '🍻', description: 'Apéro, bar, soirée' },
  { id: 'sport', label: 'Sport', icon: '⚽', description: 'Foot, basket, padel...' },
  { id: 'cinema', label: 'Cinéma', icon: '🎬', description: 'Film au ciné' },
  { id: 'gaming', label: 'Gaming', icon: '🎮', description: 'Session jeux vidéo' },
  { id: 'soiree', label: 'Soirée', icon: '🎉', description: 'Fête, anniversaire...' },
  { id: 'voyage', label: 'Voyage', icon: '✈️', description: 'Trip, week-end...' },
  { id: 'autre', label: 'Autre', icon: '📌', description: 'Autre activité' },
];

export default function ActivitiesPage() {
  const router = useRouter();
  const { currentUser, loading: userLoading, getActivities, createActivity, getActivityParticipations, setActivityParticipation } = useSupabase();

  const [activities, setActivitiesState] = useState<Activity[]>([]);
  const [participations, setParticipations] = useState<Record<string, ActivityParticipation[]>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [newActivity, setNewActivity] = useState({ title: '', description: '', date: '', time: '', location: '' });
  const [mounted, setMounted] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const acts = await getActivities();
    setActivitiesState(acts);

    const allParticipations: Record<string, ActivityParticipation[]> = {};
    await Promise.all(acts.map(async (act) => {
      allParticipations[act.id] = await getActivityParticipations(act.id);
    }));
    setParticipations(allParticipations);
  }, [getActivities, getActivityParticipations]);

  useEffect(() => {
    if (!userLoading && !currentUser) {
      router.push('/login');
    }
  }, [userLoading, currentUser, router]);

  useEffect(() => {
    setMounted(true);
    if (currentUser) loadData();
  }, [currentUser, loadData]);

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedType) return;

    const type = ACTIVITY_TYPES.find(t => t.id === selectedType);

    await createActivity({
      title: newActivity.title || `${type?.icon} ${type?.label}`,
      description: newActivity.description,
      date: newActivity.date,
      time: newActivity.time,
      location: newActivity.location,
    });

    setShowCreateModal(false);
    setSelectedType(null);
    setNewActivity({ title: '', description: '', date: '', time: '', location: '' });
    loadData();
  };

  const handleParticipation = async (activityId: string, status: 'yes' | 'no' | 'maybe', activityTitle: string, creatorId: string) => {
    if (!currentUser) return;
    setLoadingActivity(activityId);

    await setActivityParticipation(activityId, status, activityTitle, creatorId);
    const parts = await getActivityParticipations(activityId);
    setParticipations(prev => ({ ...prev, [activityId]: parts }));

    setLoadingActivity(null);
  };

  const getMyStatus = (activityId: string) => {
    if (!currentUser) return null;
    return participations[activityId]?.find(p => p.user_id === currentUser.id)?.status;
  };

  const getParticipantsByStatus = (activityId: string, status: 'yes' | 'no' | 'maybe') => {
    return participations[activityId]?.filter(p => p.status === status) || [];
  };

  const getActivityIcon = (title: string) => {
    for (const type of ACTIVITY_TYPES) {
      if (title.includes(type.icon) || title.toLowerCase().includes(type.label.toLowerCase())) {
        return type.icon;
      }
    }
    return '📌';
  };

  if (userLoading || !currentUser) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar />

      <section className="relative py-12 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#6366f1]/20 to-transparent" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#a855f7]/10 rounded-full blur-3xl" />

        <div className={`max-w-7xl mx-auto relative transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-black flex items-center gap-4 mb-2">
                <span className="text-5xl">📅</span>
                Activités
              </h1>
              <p className="text-gray-400 text-lg">Propose une sortie ou rejoins-en une !</p>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-8 py-4 bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white rounded-2xl font-bold text-lg hover:scale-105 transition-transform shadow-lg shadow-[#6366f1]/30 flex items-center gap-3"
            >
              <span className="text-xl">+</span>
              Créer une activité
            </button>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {ACTIVITY_TYPES.slice(0, 6).map(type => (
              <button
                key={type.id}
                onClick={() => { setSelectedType(type.id); setShowCreateModal(true); }}
                className="px-4 py-2 bg-[#1e1e2e] rounded-xl text-gray-300 hover:text-white hover:bg-[#2a2a3a] transition-all flex items-center gap-2 border border-transparent hover:border-white/10"
              >
                <span>{type.icon}</span>
                <span className="text-sm font-medium">{type.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 pb-12">
        <div className="space-y-4">
          {activities.map((activity, index) => {
            const myStatus = getMyStatus(activity.id);
            const yesParticipants = getParticipantsByStatus(activity.id, 'yes');
            const maybeParticipants = getParticipantsByStatus(activity.id, 'maybe');
            const icon = getActivityIcon(activity.title);
            const isUpcoming = activity.date && new Date(activity.date) >= new Date();
            const isLoading = loadingActivity === activity.id;

            return (
              <div
                key={activity.id}
                className={`relative overflow-hidden rounded-3xl border transition-all duration-300 ${
                  mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                } ${
                  yesParticipants.length > 0
                    ? 'border-[#22c55e]/30 bg-gradient-to-br from-[#22c55e]/10 to-[#12121a]'
                    : 'border-[#6366f1]/20 bg-gradient-to-br from-[#6366f1]/10 to-[#12121a]'
                }`}
                style={{ transitionDelay: `${index * 50}ms` }}
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#6366f1]/5 rounded-full blur-2xl" />

                <div className="relative p-6">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-14 h-14 rounded-2xl bg-[#6366f1]/20 flex items-center justify-center text-2xl shrink-0">{icon}</div>
                        <div>
                          <h3 className="text-xl font-bold text-white mb-1">{activity.title}</h3>
                          {activity.description && <p className="text-gray-400">{activity.description}</p>}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        {activity.date && (
                          <span className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${isUpcoming ? 'bg-[#6366f1]/20 text-[#6366f1]' : 'bg-white/10 text-gray-400'}`}>
                            <span>📅</span>
                            <span className="font-medium">{format(new Date(activity.date), 'EEEE d MMMM', { locale: fr })}</span>
                          </span>
                        )}
                        {activity.time && (
                          <span className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg text-gray-300">
                            <span>⏰</span>
                            <span className="font-medium">{activity.time}</span>
                          </span>
                        )}
                        {activity.location && (
                          <span className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-lg text-gray-300">
                            <span>📍</span>
                            <span className="font-medium">{activity.location}</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-500 mt-3 flex items-center gap-2">
                        <span>Proposé par</span>
                        <span className="text-white font-medium">{activity.creator?.member_name || 'Anonyme'}</span>
                      </p>

                      {/* Response Progress Bar */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-gray-400">{yesParticipants.length + maybeParticipants.length + getParticipantsByStatus(activity.id, 'no').length}/14 ont répondu</span>
                          {yesParticipants.length < 5 && yesParticipants.length > 0 && (
                            <span className="text-[#6366f1]">Encore {5 - yesParticipants.length} pour confirmer</span>
                          )}
                        </div>
                        <div className="h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${yesParticipants.length >= 5 ? 'bg-gradient-to-r from-[#22c55e] to-[#16a34a]' : 'bg-gradient-to-r from-[#6366f1] to-[#a855f7]'}`}
                            style={{ width: `${((yesParticipants.length + maybeParticipants.length + getParticipantsByStatus(activity.id, 'no').length) / 14) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2">
                        {/* Confirmed Badge */}
                        {yesParticipants.length >= 5 && (
                          <div className="px-3 py-1.5 bg-[#22c55e] text-white text-sm font-bold rounded-xl flex items-center gap-1.5 shadow-lg shadow-[#22c55e]/30">
                            <span>✓</span> Confirmé !
                          </div>
                        )}
                        {yesParticipants.length > 0 && (
                          <div className="flex items-center gap-2 px-4 py-2 bg-[#22c55e]/20 rounded-xl border border-[#22c55e]/30">
                            <div className="flex -space-x-2">
                              {yesParticipants.slice(0, 3).map(p => (
                                <div key={p.id} className="w-6 h-6 rounded-full overflow-hidden relative ring-2 ring-[#12121a]">
                                  <Image src={`/members/${p.users?.member_slug || 'default'}.png`} alt="" fill className="object-cover" />
                                </div>
                              ))}
                              {yesParticipants.length > 3 && (
                                <div className="w-6 h-6 rounded-full bg-[#22c55e] flex items-center justify-center text-xs font-bold text-white ring-2 ring-[#12121a]">+{yesParticipants.length - 3}</div>
                              )}
                            </div>
                            <span className="text-[#22c55e] font-bold">{yesParticipants.length}</span>
                            <span className="text-[#22c55e]/70 text-sm">viennent</span>
                          </div>
                        )}
                        {maybeParticipants.length > 0 && (
                          <div className="flex items-center gap-2 px-4 py-2 bg-[#fbbf24]/20 rounded-xl border border-[#fbbf24]/30">
                            <span className="text-[#fbbf24] font-bold">{maybeParticipants.length}</span>
                            <span className="text-[#fbbf24]/70 text-sm">peut-être</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button onClick={() => handleParticipation(activity.id, 'yes', activity.title, activity.created_by)} disabled={isLoading}
                          className={`px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${myStatus === 'yes' ? 'bg-[#22c55e] text-white shadow-lg shadow-[#22c55e]/30' : 'bg-[#22c55e]/20 text-[#22c55e] hover:bg-[#22c55e]/30 border border-[#22c55e]/30'} ${isLoading ? 'opacity-50' : ''}`}>
                          <span>✓</span><span>Je viens</span>
                        </button>
                        <button onClick={() => handleParticipation(activity.id, 'maybe', activity.title, activity.created_by)} disabled={isLoading}
                          className={`px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${myStatus === 'maybe' ? 'bg-[#fbbf24] text-black shadow-lg shadow-[#fbbf24]/30' : 'bg-[#fbbf24]/20 text-[#fbbf24] hover:bg-[#fbbf24]/30 border border-[#fbbf24]/30'} ${isLoading ? 'opacity-50' : ''}`}>
                          <span>🤔</span><span>Peut-être</span>
                        </button>
                        <button onClick={() => handleParticipation(activity.id, 'no', activity.title, activity.created_by)} disabled={isLoading}
                          className={`px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 ${myStatus === 'no' ? 'bg-[#ef4444] text-white shadow-lg shadow-[#ef4444]/30' : 'bg-[#ef4444]/20 text-[#ef4444] hover:bg-[#ef4444]/30 border border-[#ef4444]/30'} ${isLoading ? 'opacity-50' : ''}`}>
                          <span>✗</span><span>Non</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {(yesParticipants.length > 0 || maybeParticipants.length > 0) && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="flex flex-wrap gap-2">
                        {yesParticipants.map(p => (
                          <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 bg-[#22c55e]/20 rounded-xl">
                            <div className="w-6 h-6 rounded-full overflow-hidden relative">
                              <Image src={`/members/${p.users?.member_slug || 'default'}.png`} alt="" fill className="object-cover" />
                            </div>
                            <span className="text-sm font-medium text-[#22c55e]">{p.users?.member_name?.split(' ')[0]}</span>
                          </div>
                        ))}
                        {maybeParticipants.map(p => (
                          <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 bg-[#fbbf24]/20 rounded-xl">
                            <div className="w-6 h-6 rounded-full overflow-hidden relative">
                              <Image src={`/members/${p.users?.member_slug || 'default'}.png`} alt="" fill className="object-cover" />
                            </div>
                            <span className="text-sm font-medium text-[#fbbf24]">{p.users?.member_name?.split(' ')[0]} ?</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {activities.length === 0 && (
            <div className="text-center py-16 px-4">
              <div className="inline-block p-8 rounded-3xl bg-gradient-to-br from-[#6366f1]/20 to-transparent border border-[#6366f1]/20">
                <span className="text-6xl mb-4 block">🎉</span>
                <h3 className="text-2xl font-bold mb-2">Aucune activité pour le moment</h3>
                <p className="text-gray-400 mb-6">Sois le premier à proposer quelque chose !</p>
                <button onClick={() => setShowCreateModal(true)} className="px-8 py-4 bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white rounded-2xl font-bold hover:scale-105 transition-transform">
                  Créer une activité
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass rounded-3xl p-8 w-full max-w-lg border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Nouvelle activité</h2>
              <button onClick={() => { setShowCreateModal(false); setSelectedType(null); }} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/20 transition-all">✕</button>
            </div>

            {!selectedType ? (
              <div className="space-y-4">
                <p className="text-gray-400 mb-4">Quel type d&apos;activité ?</p>
                <div className="grid grid-cols-2 gap-3">
                  {ACTIVITY_TYPES.map(type => (
                    <button key={type.id} onClick={() => setSelectedType(type.id)} className="p-4 rounded-2xl border border-white/10 bg-[#1e1e2e] hover:bg-[#2a2a3a] hover:border-white/20 transition-all text-left group">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl group-hover:scale-110 transition-transform">{type.icon}</span>
                        <span className="font-bold text-white">{type.label}</span>
                      </div>
                      <p className="text-sm text-gray-500">{type.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateActivity} className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-[#6366f1]/20 rounded-2xl border border-[#6366f1]/30 mb-4">
                  <span className="text-3xl">{ACTIVITY_TYPES.find(t => t.id === selectedType)?.icon}</span>
                  <div>
                    <p className="font-bold text-white">{ACTIVITY_TYPES.find(t => t.id === selectedType)?.label}</p>
                    <button type="button" onClick={() => setSelectedType(null)} className="text-sm text-[#6366f1] hover:underline">Changer</button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Titre</label>
                  <input type="text" value={newActivity.title} onChange={(e) => setNewActivity({ ...newActivity, title: e.target.value })}
                    placeholder={`Ex: ${ACTIVITY_TYPES.find(t => t.id === selectedType)?.icon} ${ACTIVITY_TYPES.find(t => t.id === selectedType)?.label} chez Kevin`}
                    className="w-full px-4 py-3 bg-[#1e1e2e] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#6366f1] transition-colors" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Description (optionnel)</label>
                  <textarea value={newActivity.description} onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                    placeholder="Plus de détails..." rows={3}
                    className="w-full px-4 py-3 bg-[#1e1e2e] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#6366f1] resize-none transition-colors" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">📅 Date</label>
                    <input type="date" value={newActivity.date} onChange={(e) => setNewActivity({ ...newActivity, date: e.target.value })}
                      className="w-full px-4 py-3 bg-[#1e1e2e] border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#6366f1] transition-colors" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">⏰ Heure</label>
                    <input type="time" value={newActivity.time} onChange={(e) => setNewActivity({ ...newActivity, time: e.target.value })}
                      className="w-full px-4 py-3 bg-[#1e1e2e] border border-white/10 rounded-xl text-white focus:outline-none focus:border-[#6366f1] transition-colors" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">📍 Lieu</label>
                  <input type="text" value={newActivity.location} onChange={(e) => setNewActivity({ ...newActivity, location: e.target.value })}
                    placeholder="Ex: Chez Kevin, Bar XYZ..."
                    className="w-full px-4 py-3 bg-[#1e1e2e] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#6366f1] transition-colors" />
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => { setShowCreateModal(false); setSelectedType(null); }} className="flex-1 px-6 py-3 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-colors">Annuler</button>
                  <button type="submit" className="flex-1 px-6 py-3 bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white rounded-xl font-bold hover:scale-[1.02] transition-transform shadow-lg shadow-[#6366f1]/30">Créer</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
