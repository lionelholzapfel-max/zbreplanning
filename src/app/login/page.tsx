'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { MEMBERS, Member } from '@/data/members';
import { toast } from 'sonner';
import { Avatar, Spinner } from '@/components/ui';

type Step = 'select' | 'pin' | 'setup';

export default function LoginPage() {
  const [step, setStep] = useState<Step>('select');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [pin, setPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [pinError, setPinError] = useState('');
  const [shake, setShake] = useState(false);
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
    setPinError('');
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
    if (!isConfirm) setPinError('');

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
      setPinError('Entre ton PIN à 4 chiffres');
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
          // Inline error + shake, then reset for a retry
          setPinError(data.error || 'PIN incorrect');
          setShake(true);
          setTimeout(() => setShake(false), 200);
          setPin(['', '', '', '']);
          pinRefs.current[0]?.focus();
          setTimeout(() => setPinError(''), 2000);
        }
        return;
      }

      toast.success(`Bienvenue ${selectedMember.name.split(' ')[0]}`);
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
      setPinError('Entre un PIN à 4 chiffres');
      return;
    }

    if (pinString !== confirmPinString) {
      setPinError('Les PINs ne correspondent pas');
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

      toast.success('PIN configuré');
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
    setPinError('');
  };

  // Auto-submit when PIN is complete
  useEffect(() => {
    if (step === 'pin' && pin.every(d => d !== '') && !loading) {
      handleLogin();
    }
  }, [pin, step]);

  if (!mounted) return null;

  const pinBoxClass = (hasError: boolean) =>
    `w-14 h-14 text-center text-xl font-semibold rounded-[6px] bg-[var(--surface-raised)] border text-[var(--text-primary)] focus:outline-none transition-colors duration-150 ${
      hasError ? 'border-[var(--danger)]' : 'border-[var(--hairline)] focus:border-[var(--accent)]'
    }`;

  return (
    <div className="min-h-screen flex flex-col items-center px-4 pt-20 pb-10">
      <div className="w-full max-w-2xl">
        {/* Wordmark */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold tracking-[-0.02em] text-[var(--text-primary)]">ZbrePlanning</h1>
        </div>

        {/* Card */}
        <div className="rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-10">
          {step === 'select' && (
            <div>
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-[var(--hairline)] bg-[var(--surface-raised)] text-[13px] text-[var(--text-secondary)] mb-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                  {MEMBERS.length} membres actifs
                </div>
                <h2 className="text-[22px] font-semibold text-[var(--text-primary)]">Qui es-tu ?</h2>
                <p className="mt-1 text-[15px] text-[var(--text-secondary)]">Sélectionne ton profil pour rejoindre la team</p>
              </div>

              <div className="mt-8 grid grid-cols-4 md:grid-cols-7 gap-6">
                {MEMBERS.map((member) => (
                  <button
                    key={member.id}
                    data-testid={`member-${member.slug}`}
                    onClick={() => handleMemberSelect(member)}
                    disabled={loading}
                    className="group flex flex-col items-center gap-2 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="relative w-[72px] h-[72px] rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-[var(--accent)] group-focus-visible:ring-[var(--accent)] transition-all duration-150">
                      <Image
                        src={member.photo}
                        alt={member.name}
                        fill
                        sizes="72px"
                        className="object-cover"
                      />
                    </div>
                    <span className="text-[13px] font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] group-focus-visible:text-[var(--text-primary)] transition-colors truncate max-w-full">
                      {member.name.split(' ')[0]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(step === 'pin' || step === 'setup') && selectedMember && (
            <div>
              <button
                onClick={handleBack}
                className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                ← Retour
              </button>

              <div className="text-center mt-6">
                <div className="mx-auto w-[88px] h-[88px] mb-4">
                  <Avatar slug={selectedMember.slug} name={selectedMember.name} size={88} ring="accent" className="w-full h-full" />
                </div>
                <h2 className="text-xl font-semibold text-[var(--text-primary)]">{selectedMember.name.split(' ')[0]}</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {isSettingUp ? 'Configure ton PIN à 4 chiffres' : 'Entre ton PIN'}
                </p>
              </div>

              {/* PIN Input */}
              <div className="mt-6">
                <div className={`flex justify-center gap-3 ${shake ? 'animate-shake' : ''}`}>
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
                      className={pinBoxClass(!!pinError && !isSettingUp)}
                    />
                  ))}
                </div>

                {!isSettingUp && pinError && (
                  <p className="mt-3 text-center text-[13px] text-[var(--danger)]">{pinError}</p>
                )}

                {isSettingUp && (
                  <>
                    <p className="mt-5 text-center text-sm text-[var(--text-secondary)]">Confirme ton PIN</p>
                    <div className="mt-3 flex justify-center gap-3">
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
                          className={pinBoxClass(false)}
                        />
                      ))}
                    </div>
                    {pinError && (
                      <p className="mt-3 text-center text-[13px] text-[var(--danger)]">{pinError}</p>
                    )}
                  </>
                )}
              </div>

              {isSettingUp && (
                <button
                  onClick={handleSetupPin}
                  disabled={loading || pin.some(d => !d) || confirmPin.some(d => !d)}
                  className="mt-6 w-full h-10 rounded-[6px] text-sm font-medium bg-[var(--accent)] text-[#0A0A0B] transition-opacity duration-150 ease-out hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none inline-flex items-center justify-center gap-2"
                >
                  {loading ? <Spinner size={18} /> : 'Configurer mon PIN'}
                </button>
              )}

              {!isSettingUp && loading && (
                <div className="mt-6 flex justify-center">
                  <Spinner size={22} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-[13px] text-[var(--text-tertiary)]">🇧🇪 La Zbre Team - Bruxelles ❤️</p>
        </div>
      </div>
    </div>
  );
}
