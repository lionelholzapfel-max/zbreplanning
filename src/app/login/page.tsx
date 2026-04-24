'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { MEMBERS, Member } from '@/data/members';
import { useSupabase } from '@/hooks/useSupabase';

export default function LoginPage() {
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hoveredMember, setHoveredMember] = useState<string | null>(null);
  const router = useRouter();
  const { currentUser, login } = useSupabase();

  useEffect(() => {
    if (currentUser) {
      router.push('/');
      return;
    }
    setMounted(true);
  }, [currentUser, router]);

  const handleLogin = async () => {
    if (!selectedMember) return;

    setLoading(true);
    await login(selectedMember);

    setTimeout(() => {
      router.push('/');
    }, 500);
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#6366f1]/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#a855f7]/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-[#ec4899]/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Background with team photo */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/team/group.png"
          alt="Zbre Team"
          fill
          className="object-cover opacity-15 scale-110"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f]/90 via-[#0a0a0f]/95 to-[#0a0a0f]" />
      </div>

      {/* Content */}
      <div className={`relative z-10 w-full max-w-2xl transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-block mb-4 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-[#6366f1] via-[#a855f7] to-[#ec4899] blur-xl opacity-50 animate-pulse" />
            <h1 className="relative text-6xl md:text-7xl font-black tracking-tight">
              <span className="gradient-text">Zbre</span>
              <span className="text-white">Planning</span>
            </h1>
          </div>
          <p className="text-gray-400 text-xl">La team au complet</p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="w-12 h-px bg-gradient-to-r from-transparent via-[#6366f1] to-transparent" />
            <span className="text-[#6366f1]">●</span>
            <span className="w-12 h-px bg-gradient-to-r from-transparent via-[#6366f1] to-transparent" />
          </div>
        </div>

        {/* Card */}
        <div className="glass rounded-3xl p-8 border border-white/5 shadow-2xl shadow-[#6366f1]/5">
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#6366f1]/10 rounded-full text-[#6366f1] text-sm font-medium mb-4">
                <span className="w-2 h-2 rounded-full bg-[#6366f1] animate-pulse" />
                {MEMBERS.length} membres actifs
              </div>
              <h2 className="text-2xl font-bold mb-2">Salut ! Qui es-tu ?</h2>
              <p className="text-gray-400">Sélectionne ton profil pour rejoindre la team</p>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-3">
              {MEMBERS.map((member, index) => (
                <button
                  key={member.id}
                  onClick={() => setSelectedMember(member)}
                  onMouseEnter={() => setHoveredMember(member.id)}
                  onMouseLeave={() => setHoveredMember(null)}
                  className={`group relative p-2 rounded-2xl border-2 transition-all duration-300 ${
                    selectedMember?.id === member.id
                      ? 'border-[#6366f1] bg-[#6366f1]/20 scale-105 shadow-lg shadow-[#6366f1]/20'
                      : hoveredMember === member.id
                      ? 'border-[#6366f1]/50 bg-[#1e1e2e]'
                      : 'border-transparent bg-[#1e1e2e]/50 hover:bg-[#1e1e2e]'
                  }`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {selectedMember?.id === member.id && (
                    <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#6366f1] via-[#a855f7] to-[#ec4899] opacity-50 blur animate-pulse" />
                  )}

                  <div className="relative">
                    <div className={`relative w-12 h-12 md:w-14 md:h-14 mx-auto rounded-full overflow-hidden ring-2 transition-all duration-300 ${
                      selectedMember?.id === member.id
                        ? 'ring-[#6366f1] ring-offset-2 ring-offset-[#12121a]'
                        : 'ring-[#2a2a3a] group-hover:ring-[#6366f1]/50'
                    }`}>
                      <Image
                        src={member.photo}
                        alt={member.name}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-110"
                      />
                    </div>

                    <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full pointer-events-none transition-all duration-200 ${
                      hoveredMember === member.id || selectedMember?.id === member.id
                        ? 'opacity-100'
                        : 'opacity-0'
                    }`}>
                      <div className="bg-[#1e1e2e] border border-[#2a2a3a] rounded-lg px-2 py-1 text-xs font-medium whitespace-nowrap shadow-lg mt-2">
                        {member.name}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className={`transition-all duration-500 overflow-hidden ${
              selectedMember ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'
            }`}>
              {selectedMember && (
                <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-[#6366f1]/10 to-transparent rounded-2xl border border-[#6366f1]/20">
                  <div className="relative w-16 h-16 rounded-full overflow-hidden ring-2 ring-[#6366f1]">
                    <Image
                      src={selectedMember.photo}
                      alt={selectedMember.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-white">{selectedMember.name}</p>
                    <p className="text-sm text-[#6366f1]">Prêt à rejoindre la team</p>
                  </div>
                  <div className="ml-auto">
                    <span className="text-3xl animate-bounce inline-block">👋</span>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleLogin}
              disabled={!selectedMember || loading}
              className={`w-full py-4 rounded-2xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-3 ${
                selectedMember && !loading
                  ? 'bg-gradient-to-r from-[#6366f1] via-[#a855f7] to-[#ec4899] text-white hover:shadow-lg hover:shadow-[#6366f1]/30 hover:scale-[1.02]'
                  : 'bg-[#1e1e2e] text-gray-500 cursor-not-allowed'
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Connexion en cours...
                </>
              ) : selectedMember ? (
                <>
                  <span>C&apos;est parti !</span>
                  <span className="text-xl">🚀</span>
                </>
              ) : (
                'Sélectionne ton profil'
              )}
            </button>
          </div>
        </div>

        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-4 text-gray-500 text-sm">
            <span>🇧🇪</span>
            <span>La Zbre Team - Bruxelles</span>
            <span>❤️</span>
          </div>
        </div>
      </div>
    </div>
  );
}
