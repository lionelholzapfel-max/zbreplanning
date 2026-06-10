'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { MEMBERS } from '@/data/members';
import { useSupabase } from '@/hooks/useSupabase';
import { toast } from 'sonner';

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

  if (loading || !currentUser?.is_admin) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <Navbar />

      {/* Hero */}
      <section className="relative py-12 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 via-[#1a472a]/20 to-transparent" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />

        <div className={`max-w-4xl mx-auto relative transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <span className="text-5xl">👥</span>
              <h1 className="text-4xl md:text-5xl font-black">
                <span className="text-white">Admin </span>
                <span className="bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">Membres</span>
              </h1>
            </div>
            <p className="text-gray-400 text-lg">Gestion des comptes et PIN</p>
          </div>
        </div>
      </section>

      {/* Members List */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <div className="space-y-4">
          {MEMBERS.map((member, index) => {
            const status = userStatuses[member.id];
            const hasPin = status?.has_pin ?? false;
            const isAdmin = status?.is_admin ?? false;
            const isCurrentUser = member.id === currentUser.id;

            return (
              <div
                key={member.id}
                className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${
                  mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                } ${
                  isCurrentUser
                    ? 'border-[#fbbf24]/30 bg-gradient-to-r from-[#fbbf24]/10 to-transparent'
                    : 'border-white/10 bg-[#12121a]'
                }`}
                style={{ transitionDelay: `${index * 50}ms` }}
              >
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative w-12 h-12 rounded-full overflow-hidden">
                      <Image
                        src={member.photo}
                        alt={member.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{member.name}</span>
                        {isAdmin && (
                          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                            Admin
                          </span>
                        )}
                        {isCurrentUser && (
                          <span className="px-2 py-0.5 bg-[#fbbf24]/20 text-[#fbbf24] text-xs rounded-full">
                            Toi
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        {status ? (
                          hasPin ? (
                            <span className="text-green-400">PIN configuré</span>
                          ) : (
                            <span className="text-gray-500">Pas de PIN</span>
                          )
                        ) : (
                          <span className="text-gray-600">Non inscrit</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {hasPin && !isCurrentUser && (
                      <button
                        onClick={() => handleResetPin(member.id, member.name)}
                        disabled={resetting === member.id}
                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition-all disabled:opacity-50"
                      >
                        {resetting === member.id ? 'Reset...' : 'Reset PIN'}
                      </button>
                    )}
                    {isCurrentUser && (
                      <span className="text-sm text-gray-500">
                        (Ton compte)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
