'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { MEMBERS, Member } from '@/data/members';
import { toast } from 'sonner';

type Step = 'select' | 'pin' | 'setup';

export default function LoginPage() {
  const [step, setStep] = useState<Step>('select');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [pin, setPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hoveredMember, setHoveredMember] = useState<string | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmPinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();

  useEffect(() => {
    // Check if already logged in
    fetch('/api/auth/me')
      .then(res => {
        if (res.ok) {
          router.push('/');
        } else {
          setMounted(true);
        }
      })
      .catch(() => setMounted(true));
  }, [router]);

  const handleMemberSelect = async (member: Member) => {
    setSelectedMember(member);
    setPin(['', '', '', '']);
    setConfirmPin(['', '', '', '']);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: member.id }),
      });

      const data = await res.json();

      if (data.needsSetup) {
        setIsSettingUp(true);
        setStep('setup');
      } else {
        setIsSettingUp(false);
        setStep('pin');
      }
    } catch {
      toast.error('Erreur de connexion au serveur');
      setStep('select');
    } finally {
      setLoading(false);
    }
  };

  const handlePinChange = (index: number, value: string, isConfirm = false) => {
    if (!/^\d*$/.test(value)) return;

    const newPin = isConfirm ? [...confirmPin] : [...pin];
    newPin[index] = value.slice(-1);

    if (isConfirm) {
      setConfirmPin(newPin);
    } else {
      setPin(newPin);
    }

    // Auto-focus next input
    if (value && index < 3) {
      const refs = isConfirm ? confirmPinRefs : pinRefs;
      refs.current[index + 1]?.focus();
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent, isConfirm = false) => {
    if (e.key === 'Backspace') {
      const currentPin = isConfirm ? confirmPin : pin;
      if (!currentPin[index] && index > 0) {
        const refs = isConfirm ? confirmPinRefs : pinRefs;
        refs.current[index - 1]?.focus();
      }
    }
  };

  const handleLogin = async () => {
    if (!selectedMember) return;

    const pinString = pin.join('');
    if (pinString.length !== 4) {
      toast.error('Entre ton PIN à 4 chiffres');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: selectedMember.id,
          pin: pinString,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.needsSetup) {
          setStep('setup');
          setIsSettingUp(true);
        } else {
          toast.error(data.error || 'Erreur de connexion');
          setPin(['', '', '', '']);
          pinRefs.current[0]?.focus();
        }
        return;
      }

      toast.success(`Bienvenue ${selectedMember.name.split(' ')[0]} !`);
      router.push('/');
    } catch {
      toast.error('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupPin = async () => {
    if (!selectedMember) return;

    const pinString = pin.join('');
    const confirmPinString = confirmPin.join('');

    if (pinString.length !== 4) {
      toast.error('Entre un PIN à 4 chiffres');
      return;
    }

    if (pinString !== confirmPinString) {
      toast.error('Les PINs ne correspondent pas');
      setConfirmPin(['', '', '', '']);
      confirmPinRefs.current[0]?.focus();
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/setup-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: selectedMember.id,
          pin: pinString,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de la configuration');
        return;
      }

      toast.success('PIN configuré ! Bienvenue !');
      router.push('/');
    } catch {
      toast.error('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep('select');
    setSelectedMember(null);
    setPin(['', '', '', '']);
    setConfirmPin(['', '', '', '']);
  };

  // Auto-submit when PIN is complete
  useEffect(() => {
    if (step === 'pin' && pin.every(d => d !== '') && !loading) {
      handleLogin();
    }
  }, [pin, step]);

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
          {step === 'select' && (
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
                    onClick={() => handleMemberSelect(member)}
                    onMouseEnter={() => setHoveredMember(member.id)}
                    onMouseLeave={() => setHoveredMember(null)}
                    disabled={loading}
                    className={`group relative p-2 rounded-2xl border-2 transition-all duration-300 ${
                      hoveredMember === member.id
                        ? 'border-[#6366f1]/50 bg-[#1e1e2e]'
                        : 'border-transparent bg-[#1e1e2e]/50 hover:bg-[#1e1e2e]'
                    } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="relative">
                      <div className={`relative w-12 h-12 md:w-14 md:h-14 mx-auto rounded-full overflow-hidden ring-2 transition-all duration-300 ${
                        'ring-[#2a2a3a] group-hover:ring-[#6366f1]/50'
                      }`}>
                        <Image
                          src={member.photo}
                          alt={member.name}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-110"
                        />
                      </div>

                      <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full pointer-events-none transition-all duration-200 ${
                        hoveredMember === member.id ? 'opacity-100' : 'opacity-0'
                      }`}>
                        <div className="bg-[#1e1e2e] border border-[#2a2a3a] rounded-lg px-2 py-1 text-xs font-medium whitespace-nowrap shadow-lg mt-2">
                          {member.name}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(step === 'pin' || step === 'setup') && selectedMember && (
            <div className="space-y-6">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <span>←</span>
                <span>Retour</span>
              </button>

              <div className="text-center">
                <div className="relative w-20 h-20 mx-auto rounded-full overflow-hidden ring-4 ring-[#6366f1] mb-4">
                  <Image
                    src={selectedMember.photo}
                    alt={selectedMember.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <h2 className="text-2xl font-bold mb-2">{selectedMember.name}</h2>
                <p className="text-gray-400">
                  {isSettingUp
                    ? 'Configure ton PIN à 4 chiffres'
                    : 'Entre ton PIN'}
                </p>
              </div>

              {/* PIN Input */}
              <div className="space-y-4">
                <div className="flex justify-center gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <input
                      key={i}
                      ref={(el) => { pinRefs.current[i] = el; }}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={pin[i]}
                      onChange={(e) => handlePinChange(i, e.target.value)}
                      onKeyDown={(e) => handlePinKeyDown(i, e)}
                      autoFocus={i === 0}
                      className="w-14 h-16 text-center text-2xl font-bold bg-[#1e1e2e] border-2 border-white/10 rounded-xl focus:border-[#6366f1] focus:outline-none transition-colors"
                    />
                  ))}
                </div>

                {isSettingUp && (
                  <>
                    <p className="text-center text-gray-400 text-sm">Confirme ton PIN</p>
                    <div className="flex justify-center gap-3">
                      {[0, 1, 2, 3].map((i) => (
                        <input
                          key={i}
                          ref={(el) => { confirmPinRefs.current[i] = el; }}
                          type="password"
                          inputMode="numeric"
                          maxLength={1}
                          value={confirmPin[i]}
                          onChange={(e) => handlePinChange(i, e.target.value, true)}
                          onKeyDown={(e) => handlePinKeyDown(i, e, true)}
                          className="w-14 h-16 text-center text-2xl font-bold bg-[#1e1e2e] border-2 border-white/10 rounded-xl focus:border-[#6366f1] focus:outline-none transition-colors"
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {isSettingUp && (
                <button
                  onClick={handleSetupPin}
                  disabled={loading || pin.some(d => !d) || confirmPin.some(d => !d)}
                  className={`w-full py-4 rounded-2xl font-bold text-lg transition-all duration-300 flex items-center justify-center gap-3 ${
                    !loading && pin.every(d => d) && confirmPin.every(d => d)
                      ? 'bg-gradient-to-r from-[#6366f1] via-[#a855f7] to-[#ec4899] text-white hover:shadow-lg hover:shadow-[#6366f1]/30'
                      : 'bg-[#1e1e2e] text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Configuration...
                    </>
                  ) : (
                    <>
                      <span>Configurer mon PIN</span>
                      <span className="text-xl">🔐</span>
                    </>
                  )}
                </button>
              )}

              {!isSettingUp && loading && (
                <div className="flex justify-center">
                  <svg className="animate-spin h-8 w-8 text-[#6366f1]" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              )}
            </div>
          )}
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
