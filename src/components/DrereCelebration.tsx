'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import confetti from 'canvas-confetti';
import { Play, Pause } from 'lucide-react';
import { CountUp } from '@/components/CountUp';

interface CelebrationData {
  member_name: string;
  member_slug: string;
  points: number;
  type: 'daily' | 'weekly' | 'mzi';
}

export default function DrereCelebration() {
  const pathname = usePathname();
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<CelebrationData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loserIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fire daily confetti (classic style)
  const fireDailyConfetti = useCallback(() => {
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#E8B93E', '#DAA520', '#F0E68C'],
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#E8B93E', '#DAA520', '#F0E68C'],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  // Fire weekly confetti (champion style - bigger, more gold, more epic)
  const fireWeeklyConfetti = useCallback(() => {
    const duration = 5000;
    const end = Date.now() + duration;

    // Initial big burst
    confetti({
      particleCount: 100,
      spread: 100,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FFA500', '#FFDF00', '#F0E68C', '#DAA520'],
      scalar: 1.5,
    });

    // Continuous gold rain
    const frame = () => {
      // Left cannon
      confetti({
        particleCount: 8,
        angle: 60,
        spread: 70,
        origin: { x: 0, y: 0.5 },
        colors: ['#FFD700', '#FFA500', '#FFDF00', '#ffffff'],
        scalar: 1.3,
        gravity: 0.8,
      });
      // Right cannon
      confetti({
        particleCount: 8,
        angle: 120,
        spread: 70,
        origin: { x: 1, y: 0.5 },
        colors: ['#FFD700', '#FFA500', '#FFDF00', '#ffffff'],
        scalar: 1.3,
        gravity: 0.8,
      });
      // Center shower
      confetti({
        particleCount: 3,
        angle: 270,
        spread: 60,
        origin: { x: 0.5, y: 0 },
        colors: ['#FFD700', '#FFDF00', '#DAA520'],
        scalar: 1.2,
        drift: 0,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();

    // Star bursts every second
    const starBurst = setInterval(() => {
      if (Date.now() >= end) {
        clearInterval(starBurst);
        return;
      }
      confetti({
        particleCount: 50,
        spread: 360,
        origin: { x: Math.random(), y: Math.random() * 0.5 + 0.2 },
        colors: ['#FFD700', '#FFA500'],
        scalar: 0.8,
        shapes: ['star'],
      });
    }, 800);
  }, []);

  // Fire MZI "loser" effect - sad falling particles
  const fireLoserEffect = useCallback(() => {
    const duration = 5000;
    const end = Date.now() + duration;

    // Sad grey/brown falling particles
    const frame = () => {
      // Falling from top - slow and sad
      confetti({
        particleCount: 2,
        angle: 270,
        spread: 30,
        origin: { x: Math.random(), y: 0 },
        colors: ['#6b7280', '#4b5563', '#374151', '#78716c', '#57534e'],
        scalar: 1.5,
        gravity: 2,
        drift: Math.random() * 2 - 1,
        ticks: 300,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();

    // Occasional "thumbs down" burst
    const sadBurst = setInterval(() => {
      if (Date.now() >= end) {
        clearInterval(sadBurst);
        return;
      }
      confetti({
        particleCount: 10,
        spread: 60,
        origin: { x: Math.random(), y: 0.3 },
        colors: ['#ef4444', '#991b1b', '#7f1d1d'],
        scalar: 0.6,
        gravity: 1.5,
      });
    }, 1200);

    loserIntervalRef.current = sadBurst;
  }, []);

  // Play/pause music
  const toggleMusic = useCallback((type: 'daily' | 'weekly' | 'mzi' = 'daily') => {
    // Always clear existing timeouts first
    if (audioTimeoutRef.current) {
      clearTimeout(audioTimeoutRef.current);
      audioTimeoutRef.current = null;
    }
    if (loserIntervalRef.current) {
      clearInterval(loserIntervalRef.current);
      loserIntervalRef.current = null;
    }

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    const soundFile = type === 'weekly'
      ? '/sounds/drere-week.mp3'
      : type === 'mzi'
        ? '/sounds/mzi.mp3'
        : '/sounds/drere.mp3';

    if (!audioRef.current || audioRef.current.src !== soundFile) {
      audioRef.current = new Audio(soundFile);
      audioRef.current.volume = 0.7;
      audioRef.current.onended = () => setIsPlaying(false);
    }

    audioRef.current.play()
      .then(() => {
        setIsPlaying(true);
      })
      .catch(() => {
        // Autoplay blocked by browser - user needs to click play
        setIsPlaying(false);
      });

    // Confetti is fired separately (staggered ~1s after the entrance) — see the
    // dedicated useEffect below. Keeping it out of here means the modal's fade/scale
    // entrance plays first, then the confetti follows.

    // Auto-stop: 40s for MZI, 80s for others
    const timeout = type === 'mzi' ? 40000 : 80000;
    audioTimeoutRef.current = setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
      }
      if (loserIntervalRef.current) {
        clearInterval(loserIntervalRef.current);
      }
    }, timeout);
  }, [isPlaying]);

  // Track if we've already checked to prevent multiple fetches
  const hasCheckedRef = useRef(false);

  // Check if current user is Drère or MZI - runs on navigation changes
  useEffect(() => {
    if (pathname === '/login') return;
    if (showCelebration) return;
    if (hasCheckedRef.current) return; // Already checked this session

    const today = new Date().toISOString().split('T')[0];
    const lastSeenDaily = localStorage.getItem('drere-celebration-seen');
    const lastSeenWeekly = localStorage.getItem('drere-week-celebration-seen');
    const lastSeenMzi = localStorage.getItem('mzi-celebration-seen');

    const checkCelebration = async () => {
      hasCheckedRef.current = true; // Mark as checked
      try {
        const res = await fetch('/api/drere-celebration/check');
        if (!res.ok) return;

        const data = await res.json();

        // Check weekly first (higher priority)
        // Only show if: is drère week + server says not seen + localStorage doesn't have this week
        if (data.isDrereWeek && !data.alreadySeenWeek && lastSeenWeekly !== data.weekDate) {
          // Double-check: set localStorage FIRST to prevent race conditions
          localStorage.setItem('drere-week-celebration-seen', data.weekDate);

          setCelebrationData({
            member_name: data.member_name,
            member_slug: data.member_slug,
            points: data.weekPoints,
            type: 'weekly',
          });
          setShowCelebration(true);

          fetch('/api/drere-celebration/seen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'weekly' }),
          }).catch(() => {});

          return;
        }

        // Then check daily Drère
        if (data.isDrere && !data.alreadySeen && lastSeenDaily !== today) {
          // Set localStorage FIRST
          localStorage.setItem('drere-celebration-seen', today);

          setCelebrationData({
            member_name: data.member_name,
            member_slug: data.member_slug,
            points: data.points,
            type: 'daily',
          });
          setShowCelebration(true);

          fetch('/api/drere-celebration/seen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'daily' }),
          }).catch(() => {});

          return;
        }

        // Finally check MZI (lowest priority)
        if (data.isMzi && !data.alreadySeenMzi && lastSeenMzi !== today) {
          // Set localStorage FIRST
          localStorage.setItem('mzi-celebration-seen', today);

          setCelebrationData({
            member_name: data.member_name,
            member_slug: data.member_slug,
            points: data.mziPoints,
            type: 'mzi',
          });
          setShowCelebration(true);

          fetch('/api/drere-celebration/seen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'mzi' }),
          }).catch(() => {});
        }
      } catch {
        // Silently fail
      }
    };

    checkCelebration();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (audioTimeoutRef.current) {
        clearTimeout(audioTimeoutRef.current);
      }
      if (loserIntervalRef.current) {
        clearInterval(loserIntervalRef.current);
      }
    };
  }, [pathname, showCelebration]);

  // Start music when celebration shows
  useEffect(() => {
    if (showCelebration && celebrationData) {
      toggleMusic(celebrationData.type);
    }
  }, [showCelebration, celebrationData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Staggered confetti: let the entrance (overlay fade → avatar → name → points
  // count-up) play first, THEN fire the confetti ~1s later. Confetti is JS, not
  // CSS, so we gate it behind prefers-reduced-motion ourselves.
  useEffect(() => {
    if (!showCelebration || !celebrationData) return;

    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return; // Entrance fades are enough — skip the confetti burst.
    }

    const type = celebrationData.type;
    const timer = setTimeout(() => {
      if (type === 'weekly') {
        fireWeeklyConfetti();
      } else if (type === 'mzi') {
        fireLoserEffect();
      } else {
        fireDailyConfetti();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [showCelebration, celebrationData, fireDailyConfetti, fireWeeklyConfetti, fireLoserEffect]);

  const closeCelebration = () => {
    setShowCelebration(false);
    if (loserIntervalRef.current) {
      clearInterval(loserIntervalRef.current);
    }
  };

  if (!showCelebration || !celebrationData) return null;

  const isWeekly = celebrationData.type === 'weekly';
  const isMzi = celebrationData.type === 'mzi';

  // Styling by type — gold is legitimate here (the Drère celebration); danger for Mzi.
  const getTextColor = () => (isMzi ? 'text-[var(--danger)]' : 'text-[var(--gold)]');
  const getRingColor = () => (isMzi ? 'ring-[var(--danger)]' : 'ring-[var(--gold)]');
  const getButtonStyle = () =>
    isMzi ? 'bg-[var(--danger)] text-white hover:opacity-90' : 'bg-[var(--gold)] text-black hover:opacity-90';

  const getMusicButtonStyle = () => {
    if (isPlaying) return 'bg-[var(--surface-4)] text-[var(--text-primary)]';
    if (isMzi) return 'bg-[var(--danger)]/15 text-[var(--danger)] hover:bg-[var(--danger)]/25';
    return 'bg-[var(--gold)]/15 text-[var(--gold)] hover:bg-[var(--gold)]/25';
  };

  const getTitle = () => {
    if (isMzi) return 'Type Mzi du jour';
    if (isWeekly) return 'Drère de la semaine';
    return 'Drère du jour';
  };

  const getCloseButtonText = () => (isMzi ? 'Je ferai mieux demain' : 'Merci');

  // Start music on first interaction (for browsers that block autoplay)
  const handleModalClick = () => {
    if (!isPlaying && audioRef.current) {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    }
  };

  return (
    <>
      {/* Celebration Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--canvas)]/90 backdrop-blur-sm animate-fade-in"
        onClick={handleModalClick}
      >
        <div className="relative w-full max-w-md bg-[var(--surface-3)] top-light rounded-[16px] p-8 text-center animate-enter-soft">
          {/* Close button */}
          <button
            onClick={closeCelebration}
            className="absolute top-4 right-4 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Content */}
          <div>
            <p className="eyebrow mb-4">{getTitle()}</p>

            {/* Avatar */}
            <div
              className={`relative w-28 h-28 mx-auto mb-5 rounded-full overflow-hidden ring-2 animate-scale-in ${getRingColor()} ${isMzi ? 'grayscale' : ''}`}
              style={{ animationDelay: '80ms' }}
            >
              <Image
                src={`/members/${celebrationData.member_slug}.png`}
                alt={celebrationData.member_name}
                fill
                className="object-cover object-top"
              />
              {isMzi && <div className="absolute inset-0 bg-black/30" />}
            </div>

            <p className="display text-xl text-[var(--text-primary)] mb-4">
              {celebrationData.member_name}
            </p>

            {/* Points — the number is the signature */}
            <p className={`score text-[44px] ${getTextColor()}`}>
              <CountUp value={celebrationData.points} durationMs={600} />
            </p>
            <p className="eyebrow mt-1 mb-6">points {isWeekly ? 'cette semaine' : "aujourd'hui"}</p>

            {/* Music control button */}
            <button
              onClick={() => toggleMusic(celebrationData?.type || 'daily')}
              className={`mb-4 px-5 py-2 rounded-full transition-colors flex items-center gap-2 mx-auto ${getMusicButtonStyle()}`}
            >
              {isPlaying ? <Pause className="w-4 h-4" strokeWidth={2} /> : <Play className="w-4 h-4" strokeWidth={2} />}
              <span className="text-sm font-medium">{isPlaying ? 'Pause' : 'Jouer la musique'}</span>
            </button>

            <button
              onClick={closeCelebration}
              className={`px-8 py-3 font-medium rounded-[8px] transition-opacity ${getButtonStyle()}`}
            >
              {getCloseButtonText()}
            </button>
          </div>
        </div>
      </div>

      {/* Floating music control (visible after closing modal) */}
      {!showCelebration && isPlaying && (
        <button
          onClick={() => toggleMusic(celebrationData?.type || 'daily')}
          className={`fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center transition-opacity hover:opacity-90 ${
            isMzi ? 'bg-[var(--danger)]' : 'bg-[var(--gold)]'
          }`}
        >
          <Pause className={`w-5 h-5 ${isMzi ? 'text-white' : 'text-black'}`} strokeWidth={2} />
        </button>
      )}
    </>
  );
}
