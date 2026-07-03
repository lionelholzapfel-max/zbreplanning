'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { MEMBERS } from '@/data/members';
import { useSupabase } from '@/hooks/useSupabase';
import { toast } from 'sonner';
import { PageHeader, Avatar } from '@/components/ui';

interface UserStatus {
  id: string;
  has_pin: boolean;
  is_admin: boolean;
}

export default function AdminMembersPage() {
  const router = useRouter();
  const { currentUser, loading } = useSupabase();
  const [userStatuses, setUserStatuses] = useState<Record<string, UserStatus>>({});
  const [resetting, setResetting] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const loadUserStatuses = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/members');
      if (!res.ok) return;
      const data = await res.json();

      const statusMap: Record<string, UserStatus> = {};
      (data.users || []).forEach((u: UserStatus) => {
        statusMap[u.id] = u;
      });
      setUserStatuses(statusMap);
    } catch (err) {
      console.error('Error loading user statuses:', err);
    }
  }, []);

  useEffect(() => {
    if (loading) return;

    if (!currentUser) {
      router.push('/login');
      return;
    }

    if (!currentUser.is_admin) {
      router.push('/');
      toast.error('Accès admin requis');
      return;
    }

    loadUserStatuses();
    setMounted(true);
  }, [currentUser, loading, router, loadUserStatuses]);

  const handleResetPin = async (memberId: string, memberName: string) => {
    if (!confirm(`Réinitialiser le PIN de ${memberName} ?`)) return;

    setResetting(memberId);
    try {
      const res = await fetch('/api/admin/reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Erreur lors du reset');
        return;
      }

      toast.success(data.message || `PIN de ${memberName} réinitialisé`);

      // Update local state
      setUserStatuses(prev => ({
        ...prev,
        [memberId]: { ...prev[memberId], has_pin: false },
      }));
    } catch (err) {
      console.error('Error resetting PIN:', err);
      toast.error('Erreur de connexion');
    } finally {
      setResetting(null);
    }
  };

  // Show loading spinner while validating session
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--canvas)] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser?.is_admin) return null;

  return (
    <div className="min-h-screen bg-[var(--canvas)] pb-24">
      <Navbar />

      {/* Header */}
      <section className="max-w-4xl mx-auto px-4 pt-8">
        <PageHeader title="Admin — Membres" subtitle="Gestion des comptes et PIN" />
      </section>

      {/* Members */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="rounded-[10px] overflow-hidden">
          {MEMBERS.map((member) => {
            const status = userStatuses[member.id];
            const hasPin = status?.has_pin ?? false;
            const isAdmin = status?.is_admin ?? false;
            const isMe = member.id === currentUser.id;

            return (
              <div
                key={member.id}
                className={`flex items-center justify-between gap-3 min-h-[56px] px-3 border-b border-[var(--hairline)] last:border-b-0 transition-colors ${
                  isMe ? 'bg-[var(--surface-1)] top-light' : 'hover:bg-[var(--surface-1)]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar slug={member.slug} name={member.name} size={32} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[14px] font-medium ${isMe ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>{member.name}</span>
                      {isAdmin && <span className="text-[10px] uppercase tracking-[0.08em] px-1.5 py-0.5 rounded bg-[var(--surface-3)] text-[var(--text-secondary)]">Admin</span>}
                      {isMe && <span className="text-[10px] uppercase tracking-[0.08em] px-1.5 py-0.5 rounded bg-[var(--surface-3)] text-[var(--text-secondary)]">Toi</span>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)]">
                      {status ? (
                        hasPin ? (
                          <><span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />PIN configuré</>
                        ) : (
                          'Pas de PIN'
                        )
                      ) : (
                        'Non inscrit'
                      )}
                    </div>
                  </div>
                </div>

                {hasPin && !isMe && (
                  <button
                    onClick={() => handleResetPin(member.id, member.name)}
                    disabled={resetting === member.id}
                    className="shrink-0 h-10 sm:h-8 px-3 rounded-[8px] border border-[var(--danger)]/40 text-[13px] text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors disabled:opacity-50"
                  >
                    {resetting === member.id ? 'Reset…' : 'Reset PIN'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
