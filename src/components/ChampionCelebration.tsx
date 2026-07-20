'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { Play, Pause } from 'lucide-react';
import { CountUp } from '@/components/CountUp';
import { CHAMPION_ANTHEM_URL } from '@/components/ChampionSong';

// One-off coronation announcement — the tournament is over and these values
// are final, so they live here rather than behind an API call.
const CHAMPION_NAME = 'Kevin';
const CHAMPION_POINTS = 128;
const SEEN_KEY = 'champion-celebration-seen';

export default function ChampionCelebration() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Champion confetti — same epic gold style as the weekly Drère celebration.
  const fireChampionConfetti = useCallback(() => {
    import('canvas-confetti').then(({ default: confetti }) => {
      const duration = 5000;
      const end = Date.now() + duration;

      confetti({
        particleCount: 100,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#FFD700', '#FFA500', '#FFDF00', '#F0E68C', '#DAA520'],
        scalar: 1.5,
      });

      const frame = () => {
        confetti({
          particleCount: 8,
          angle: 60,
          spread: 70,
          origin: { x: 0, y: 0.5 },
          colors: ['#FFD700', '#FFA500', '#FFDF00', '#ffffff'],
          scalar: 1.3,
          gravity: 0.8,
        });
        confetti({
          particleCount: 8,
          angle: 120,
          spread: 70,
          origin: { x: 1, y: 0.5 },
          colors: ['#FFD700', '#FFA500', '#FFDF00', '#ffffff'],
          scalar: 1.3,
          gravity: 0.8,
        });
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
    });
  }, []);

  const toggleAnthem = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(CHAMPION_ANTHEM_URL);
      audioRef.current.volume = 0.7;
      audioRef.current.onended = () => setIsPlaying(false);
      audioRef.current.onerror = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, [isPlaying]);

  // Show once per browser — localStorage is enough for a global announcement.
  useEffect(() => {
    if (pathname === '/login') return;
    if (localStorage.getItem(SEEN_KEY)) return;
    localStorage.setItem(SEEN_KEY, '2026');
    setShow(true);
  }, [pathname]);

  // Staggered confetti after the modal entrance, gated on prefers-reduced-motion.
  useEffect(() => {
    if (!show) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const timer = setTimeout(fireChampionConfetti, 1000);
    return () => clearTimeout(timer);
  }, [show, fireChampionConfetti]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const close = () => {
    setShow(false);
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--canvas)]/90 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-[var(--surface-3)] top-light rounded-[16px] overflow-hidden text-center animate-enter-soft">
        {/* Close button */}
        <button
          onClick={close}
          className="absolute top-4 right-4 z-10 text-white/80 hover:text-white transition-colors"
          aria-label="Fermer"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* The coronation portrait */}
        <div className="relative w-full h-72">
          <Image
            src="/champion-throne.webp"
            alt={`${CHAMPION_NAME} — Drère du Tournoi`}
            fill
            priority
            className="object-cover object-[center_18%]"
          />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--surface-3)] to-transparent" />
        </div>

        <div className="p-6 pt-2">
          <p className="eyebrow text-[var(--gold)] mb-2">🏆 Drère du Tournoi</p>

          <p className="display text-2xl text-[var(--text-primary)] mb-3">{CHAMPION_NAME}</p>

          <p className="score text-[44px] text-[var(--gold)]">
            <CountUp value={CHAMPION_POINTS} durationMs={600} />
          </p>
          <p className="eyebrow mt-1 mb-5">points — champion de la CDM 2026</p>

          <button
            onClick={toggleAnthem}
            className={`mb-4 px-5 py-2 rounded-full transition-colors flex items-center gap-2 mx-auto ${
              isPlaying
                ? 'bg-[var(--surface-4)] text-[var(--text-primary)]'
                : 'bg-[var(--gold)]/15 text-[var(--gold)] hover:bg-[var(--gold)]/25'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4" strokeWidth={2} /> : <Play className="w-4 h-4" strokeWidth={2} />}
            <span className="text-sm font-medium">{isPlaying ? 'Pause' : "Écouter l'hymne"}</span>
          </button>

          <button
            onClick={close}
            className="px-8 py-3 font-medium rounded-[8px] bg-[var(--gold)] text-black hover:opacity-90 transition-opacity"
          >
            Vive le roi !
          </button>
        </div>
      </div>
    </div>
  );
}
