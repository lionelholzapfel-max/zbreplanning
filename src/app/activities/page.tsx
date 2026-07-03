'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useSupabase, Activity, ActivityParticipation } from '@/hooks/useSupabase';
import { PageHeader } from '@/components/ui';

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
  const { currentUser, loading: userLoading, getActivities, createActivity, updateActivity, getActivityParticipations, setActivityParticipation } = useSupabase();

  const [activities, setActivitiesState] = useState<Activity[]>([]);
  const [participations, setParticipations] = useState<Record<string, ActivityParticipation[]>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [newActivity, setNewActivity] = useState({ title: '', description: '', date: '', time: '', location: '' });
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
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

  const handleSubmitActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (editingActivityId) {
      await updateActivity(editingActivityId, {
        title: newActivity.title,
        description: newActivity.description,
        date: newActivity.date,
        time: newActivity.time,
        location: newActivity.location,
      });
    } else {
      if (!selectedType) return;
      const type = ACTIVITY_TYPES.find(t => t.id === selectedType);
      await createActivity({
        title: newActivity.title || `${type?.icon} ${type?.label}`,
        description: newActivity.description,
        date: newActivity.date,
        time: newActivity.time,
        location: newActivity.location,
      });
    }

    setShowCreateModal(false);
    setSelectedType(null);
    setEditingActivityId(null);
    setNewActivity({ title: '', description: '', date: '', time: '', location: '' });
    loadData();
  };

  const openEditActivity = (activity: Activity) => {
    setEditingActivityId(activity.id);
    setNewActivity({
      title: activity.title,
      description: activity.description || '',
      date: activity.date || '',
      time: activity.time || '',
      location: activity.location || '',
    });
    setShowCreateModal(true);
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

  // Show loading spinner while validating session
  if (userLoading) {
    return (
      <div className="min-h-screen bg-[var(--canvas)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar />

      <section className="max-w-7xl mx-auto px-4 pt-8">
        <PageHeader
          title="Activités"
          subtitle="Propose une soirée, un resto, une sortie."
          action={
            <button
              onClick={() => setShowCreateModal(true)}
              className="h-9 px-4 rounded-[8px] bg-[var(--accent)] text-[#0A0C0B] text-[13px] font-medium hover:opacity-90 transition-opacity"
            >
              Créer une activité
            </button>
          }
        />
        <div className="-mt-2 mb-6 flex flex-wrap gap-2">
          {ACTIVITY_TYPES.slice(0, 6).map(type => (
            <button
              key={type.id}
              onClick={() => { setSelectedType(type.id); setShowCreateModal(true); }}
              className="h-8 px-3 rounded-full bg-[var(--surface-2)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {type.label}
            </button>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 pb-12">
        <div className="space-y-4">
          {activities.map((activity, index) => {
            const myStatus = getMyStatus(activity.id);
            const yesParticipants = getParticipantsByStatus(activity.id, 'yes');
            const maybeParticipants = getParticipantsByStatus(activity.id, 'maybe');
            const isLoading = loadingActivity === activity.id;

            return (
              <div
                key={activity.id}
                className={`rounded-[10px] bg-[var(--surface-1)] top-light transition-all duration-300 ${
                  mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
                style={{ transitionDelay: `${Math.min(index, 20) * 50}ms` }}
              >
                <div className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[17px] font-medium text-[var(--text-primary)]">{activity.title}</h3>
                      {activity.description && <p className="mt-1 text-[14px] text-[var(--text-secondary)]">{activity.description}</p>}

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[var(--text-tertiary)]">
                        {activity.date && <span>{format(new Date(activity.date), 'EEEE d MMMM', { locale: fr })}</span>}
                        {activity.time && <span>{activity.time}</span>}
                        {activity.location && <span>{activity.location}</span>}
                      </div>

                      <p className="mt-2 text-[12px] text-[var(--text-tertiary)]">Proposé par {activity.creator?.member_name || 'Anonyme'}</p>

                      <div className="mt-4 flex items-center gap-3">
                        <div className="w-40 h-1 rounded-full bg-[var(--hairline)] overflow-hidden">
                          <div className="h-full bg-[var(--accent)]" style={{ width: `${((yesParticipants.length + maybeParticipants.length + getParticipantsByStatus(activity.id, 'no').length) / 14) * 100}%` }} />
                        </div>
                        <span className="text-[12px] text-[var(--text-tertiary)]">
                          {yesParticipants.length > 0 && `${yesParticipants.length} viennent`}
                          {yesParticipants.length > 0 && maybeParticipants.length > 0 && ' · '}
                          {maybeParticipants.length > 0 && `${maybeParticipants.length} peut-être`}
                          {yesParticipants.length === 0 && maybeParticipants.length === 0 && 'Personne pour l’instant'}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 self-start flex items-center gap-3">
                      {(activity.created_by === currentUser.id || myStatus) && (
                        <button
                          onClick={() => openEditActivity(activity)}
                          className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                        >
                          Modifier
                        </button>
                      )}
                      <div className="inline-flex rounded-[8px] bg-[var(--surface-2)] p-0.5">
                        {([['yes', 'Je viens'], ['maybe', 'Peut-être'], ['no', 'Non']] as const).map(([k, label]) => (
                          <button
                            key={k}
                            onClick={() => handleParticipation(activity.id, k, activity.title, activity.created_by)}
                            disabled={isLoading}
                            className={`px-3 py-1.5 rounded-[6px] text-[13px] transition-colors ${
                              myStatus === k ? 'bg-[var(--accent-muted)] text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            } ${isLoading ? 'opacity-50' : ''}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {(yesParticipants.length > 0 || maybeParticipants.length > 0) && (
                    <div className="mt-4 pt-4 border-t border-[var(--hairline)] flex flex-wrap gap-2">
                      {yesParticipants.map(p => (
                        <div key={p.id} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[var(--surface-2)]">
                          <div className="relative w-5 h-5 rounded-full overflow-hidden ring-1 ring-[var(--hairline)]">
                            <Image src={`/members/${p.users?.member_slug || 'default'}.png`} alt="" fill sizes="20px" className="object-cover object-top" />
                          </div>
                          <span className="text-[12px] text-[var(--text-secondary)]">{p.users?.member_name?.split(' ')[0]}</span>
                        </div>
                      ))}
                      {maybeParticipants.map(p => (
                        <div key={p.id} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-[var(--surface-2)]">
                          <div className="relative w-5 h-5 rounded-full overflow-hidden ring-1 ring-[var(--hairline)]">
                            <Image src={`/members/${p.users?.member_slug || 'default'}.png`} alt="" fill sizes="20px" className="object-cover object-top" />
                          </div>
                          <span className="text-[12px] text-[var(--text-tertiary)]">{p.users?.member_name?.split(' ')[0]} ?</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {activities.length === 0 && (
            <div className="text-center py-16">
              <p className="text-[var(--text-secondary)] font-medium">Aucune activité pour le moment</p>
              <p className="mt-1 text-[13px] text-[var(--text-tertiary)]">Propose une sortie pour lancer le mouvement.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 h-9 px-4 rounded-[8px] bg-[var(--accent)] text-[#0A0C0B] text-[13px] font-medium hover:opacity-90 transition-opacity"
              >
                Créer une activité
              </button>
            </div>
          )}
        </div>
      </section>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--canvas)]/90 backdrop-blur-sm">
          <div className="bg-[var(--surface-3)] top-light rounded-[16px] p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="display text-[20px] text-[var(--text-primary)]">{editingActivityId ? 'Modifier l’activité' : 'Nouvelle activité'}</h2>
              <button onClick={() => { setShowCreateModal(false); setSelectedType(null); setEditingActivityId(null); }} className="w-8 h-8 rounded-[8px] bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">✕</button>
            </div>

            {!selectedType && !editingActivityId ? (
              <div className="space-y-4">
                <p className="text-[13px] text-[var(--text-secondary)] mb-3">Quel type d&apos;activité ?</p>
                <div className="grid grid-cols-2 gap-2">
                  {ACTIVITY_TYPES.map(type => (
                    <button key={type.id} onClick={() => setSelectedType(type.id)} className="p-3 rounded-[10px] bg-[var(--surface-2)] hover:bg-[var(--surface-1)] transition-colors text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{type.icon}</span>
                        <span className="text-[14px] font-medium text-[var(--text-primary)]">{type.label}</span>
                      </div>
                      <p className="text-[12px] text-[var(--text-tertiary)]">{type.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitActivity} className="space-y-4">
                {selectedType && (
                  <div className="flex items-center gap-3 p-3 rounded-[8px] bg-[var(--surface-2)] mb-2">
                    <span className="text-xl">{ACTIVITY_TYPES.find(t => t.id === selectedType)?.icon}</span>
                    <div>
                      <p className="text-[14px] font-medium text-[var(--text-primary)]">{ACTIVITY_TYPES.find(t => t.id === selectedType)?.label}</p>
                      <button type="button" onClick={() => setSelectedType(null)} className="text-[12px] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">Changer</button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[13px] text-[var(--text-secondary)] mb-1.5">Titre</label>
                  <input type="text" value={newActivity.title} onChange={(e) => setNewActivity({ ...newActivity, title: e.target.value })}
                    placeholder={`Ex: ${ACTIVITY_TYPES.find(t => t.id === selectedType)?.icon} ${ACTIVITY_TYPES.find(t => t.id === selectedType)?.label} chez Kevin`}
                    className="w-full px-4 py-3 bg-[var(--surface-2)] border border-[var(--hairline)] rounded-[8px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)] focus:border-[var(--accent)] transition-colors" />
                </div>

                <div>
                  <label className="block text-[13px] text-[var(--text-secondary)] mb-1.5">Description (optionnel)</label>
                  <textarea value={newActivity.description} onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
                    placeholder="Plus de détails..." rows={3}
                    className="w-full px-4 py-3 bg-[var(--surface-2)] border border-[var(--hairline)] rounded-[8px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)] focus:border-[var(--accent)] resize-none transition-colors" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[13px] text-[var(--text-secondary)] mb-1.5">Date</label>
                    <input type="date" value={newActivity.date} onChange={(e) => setNewActivity({ ...newActivity, date: e.target.value })}
                      className="w-full px-4 py-3 bg-[var(--surface-2)] border border-[var(--hairline)] rounded-[8px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)] focus:border-[var(--accent)] transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[13px] text-[var(--text-secondary)] mb-1.5">Heure</label>
                    <input type="time" value={newActivity.time} onChange={(e) => setNewActivity({ ...newActivity, time: e.target.value })}
                      className="w-full px-4 py-3 bg-[var(--surface-2)] border border-[var(--hairline)] rounded-[8px] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)] focus:border-[var(--accent)] transition-colors" />
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] text-[var(--text-secondary)] mb-1.5">Lieu</label>
                  <input type="text" value={newActivity.location} onChange={(e) => setNewActivity({ ...newActivity, location: e.target.value })}
                    placeholder="Ex: Chez Kevin, Bar XYZ..."
                    className="w-full px-4 py-3 bg-[var(--surface-2)] border border-[var(--hairline)] rounded-[8px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-glow)] focus:border-[var(--accent)] transition-colors" />
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => { setShowCreateModal(false); setSelectedType(null); setEditingActivityId(null); }} className="flex-1 h-11 rounded-[8px] bg-[var(--surface-2)] text-[14px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">Annuler</button>
                  <button type="submit" className="flex-1 h-11 rounded-[8px] bg-[var(--accent)] text-[#0A0C0B] text-[14px] font-medium hover:opacity-90 transition-opacity">{editingActivityId ? 'Enregistrer' : 'Créer'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
