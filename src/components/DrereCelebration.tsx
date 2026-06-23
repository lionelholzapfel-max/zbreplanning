'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import confetti from 'canvas-confetti';

interface DrereData {
  member_name: string;
  member_slug: string;
  points: number;
  type: 'daily' | 'weekly';
}

export default function DrereCelebration() {
  const pathname = usePathname();
  const [showCelebration, setShowCelebration] = useState(false);
  const [drereData, setDrereData] = useState<DrereData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
        colors: ['#fbbf24', '#f59e0b', '#22c55e', '#6366f1'],
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#fbbf24', '#f59e0b', '#22c55e', '#6366f1'],
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

  // Play/pause music
  const toggleMusic = useCallback((type: 'daily' | 'weekly' = 'daily') => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (audioTimeoutRef.current) {
        clearTimeout(audioTimeoutRef.current);
      }
      return;
    }

    const soundFile = type === 'weekly' ? '/sounds/drere-week.mp3' : '/sounds/drere.mp3';

    if (!audioRef.current || audioRef.current.src !== soundFile) {
      audioRef.current = new Audio(soundFile);
      audioRef.current.volume = 0.7;
      audioRef.current.onended = () => setIsPlaying(false);
    }

    audioRef.current.play()
      .then(() => {
        setIsPlaying(true);
      })
      .catch((err) => {
        console.log('[DrereCelebration] Autoplay blocked:', err);
        setIsPlaying(false);
      });

    if (type === 'weekly') {
      fireWeeklyConfetti();
    } else {
      fireDailyConfetti();
    }

    // Auto-stop after 30 seconds
    audioTimeoutRef.current = setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
      }
    }, 30000);
  }, [isPlaying, fireDailyConfetti, fireWeeklyConfetti]);

  // Check if current user is Drère - runs on navigation changes
  useEffect(() => {
    if (pathname === '/login') return;
    if (showCelebration) return;

    const today = new Date().toISOString().split('T')[0];
    const lastSeenDaily = localStorage.getItem('drere-celebration-seen');
    const lastSeenWeekly = localStorage.getItem('drere-week-celebration-seen');

    const checkDrere = async () => {
      try {
        const res = await fetch('/api/drere-celebration/check');
        if (!res.ok) return;

        const data = await res.json();

        // Check weekly first (higher priority)
        if (data.isDrereWeek && !data.alreadySeenWeek && lastSeenWeekly !== data.weekDate) {
          setDrereData({
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

          localStorage.setItem('drere-week-celebration-seen', data.weekDate);
          return;
        }

        // Then check daily
        if (data.isDrere && !data.alreadySeen && lastSeenDaily !== today) {
          setDrereData({
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

          localStorage.setItem('drere-celebration-seen', today);
        }
      } catch (error) {
        // Silently fail
      }
    };

    checkDrere();

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (audioTimeoutRef.current) {
        clearTimeout(audioTimeoutRef.current);
      }
    };
  }, [pathname, showCelebration]);

  // Start music when celebration shows
  useEffect(() => {
    if (showCelebration && drereData) {
      toggleMusic(drereData.type);
    }
  }, [showCelebration, drereData]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeCelebration = () => {
    setShowCelebration(false);
  };

  if (!showCelebration || !drereData) return null;

  const isWeekly = drereData.type === 'weekly';

  return (
    <>
      {/* Celebration Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className={`relative w-full max-w-md bg-gradient-to-br ${
          isWeekly
            ? 'from-[#2a1a0a] to-[#0f0a00] border-[#FFD700]'
            : 'from-[#1a1a2e] to-[#0a0a0f] border-[#fbbf24]'
        } rounded-3xl border-2 p-8 text-center animate-bounce-in`}>
          {/* Icon animation */}
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-7xl animate-bounce">
            {isWeekly ? '🏆' : '👑'}
          </div>

          {/* Close button */}
          <button
            onClick={closeCelebration}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Content */}
          <div className="mt-8">
            <h2 className={`text-2xl font-black mb-2 ${isWeekly ? 'text-[#FFD700]' : 'text-[#fbbf24]'}`}>
              {isWeekly ? 'TU ES LE DRÈRE OF THE WEEK !' : 'TU ES LE DRÈRE DU JOUR !'}
            </h2>
            <p className="text-gray-400 mb-6">
              Avec <span className={`font-bold ${isWeekly ? 'text-[#FFD700]' : 'text-[#fbbf24]'}`}>
                {drereData.points} points
              </span> {isWeekly ? 'cette semaine' : "aujourd'hui"}
            </p>

            {/* Avatar */}
            <div className={`relative w-32 h-32 mx-auto mb-6 rounded-full overflow-hidden ring-4 ${
              isWeekly ? 'ring-[#FFD700]' : 'ring-[#fbbf24]'
            }`}>
              <Image
                src={`/members/${drereData.member_slug}.png`}
                alt={drereData.member_name}
                fill
                className="object-cover object-top"
              />
            </div>

            <p className="text-xl font-bold text-white mb-6">
              {drereData.member_name}
            </p>

            {/* Music control button */}
            <button
              onClick={() => toggleMusic(drereData?.type || 'daily')}
              className={`mb-4 px-6 py-2 rounded-full transition-all flex items-center gap-2 mx-auto ${
                isPlaying
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : isWeekly
                    ? 'bg-[#FFD700]/20 text-[#FFD700] hover:bg-[#FFD700]/30'
                    : 'bg-[#fbbf24]/20 text-[#fbbf24] hover:bg-[#fbbf24]/30'
              }`}
            >
              <span className="text-xl">{isPlaying ? '⏸️' : '▶️'}</span>
              <span className="text-sm font-medium">
                {isPlaying ? 'Pause la musique' : 'Jouer la musique'}
              </span>
            </button>

            <button
              onClick={closeCelebration}
              className={`px-8 py-3 font-bold rounded-xl transition-colors ${
                isWeekly
                  ? 'bg-[#FFD700] text-black hover:bg-[#FFA500]'
                  : 'bg-[#fbbf24] text-black hover:bg-[#f59e0b]'
              }`}
            >
              {isWeekly ? 'Champion! 🏆' : 'Merci, je sais ! 😎'}
            </button>
          </div>
        </div>
      </div>

      {/* Floating music control (visible after closing modal) */}
      {!showCelebration && isPlaying && (
        <button
          onClick={() => toggleMusic(drereData?.type || 'daily')}
          className={`fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-colors ${
            isWeekly
              ? 'bg-[#FFD700] hover:bg-[#FFA500]'
              : 'bg-[#fbbf24] hover:bg-[#f59e0b]'
          }`}
        >
          <span className="text-2xl">⏸️</span>
        </button>
      )}
    </>
  );
}
