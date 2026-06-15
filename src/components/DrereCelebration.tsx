'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import confetti from 'canvas-confetti';

interface DrereData {
  member_name: string;
  member_slug: string;
  points: number;
}

export default function DrereCelebration() {
  const [showCelebration, setShowCelebration] = useState(false);
  const [drereData, setDrereData] = useState<DrereData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fire confetti
  const fireConfetti = useCallback(() => {
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

  // Play/pause music
  const toggleMusic = useCallback(() => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (audioTimeoutRef.current) {
        clearTimeout(audioTimeoutRef.current);
      }
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio('/sounds/drere.mp3');
      audioRef.current.volume = 0.7;
      audioRef.current.onended = () => setIsPlaying(false);
    }

    audioRef.current.play();
    setIsPlaying(true);
    fireConfetti();

    // Auto-stop after 30 seconds
    audioTimeoutRef.current = setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
      }
    }, 30000);
  }, [isPlaying, fireConfetti]);

  // Check if current user is Drère on mount
  useEffect(() => {
    const checkDrere = async () => {
      try {
        const res = await fetch('/api/drere-celebration/check');
        if (!res.ok) return;

        const data = await res.json();
        if (data.isDrere && !data.alreadySeen) {
          setDrereData({
            member_name: data.member_name,
            member_slug: data.member_slug,
            points: data.points,
          });
          setShowCelebration(true);

          // Record that user saw celebration
          fetch('/api/drere-celebration/seen', { method: 'POST' }).catch(() => {});

          // Store in localStorage too
          localStorage.setItem('drere-celebration-seen', new Date().toISOString().split('T')[0]);
        }
      } catch (error) {
        console.error('Error checking drere status:', error);
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
  }, []);

  // Start music when celebration shows
  useEffect(() => {
    if (showCelebration && drereData) {
      toggleMusic();
    }
  }, [showCelebration, drereData]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeCelebration = () => {
    setShowCelebration(false);
    // Music continues playing
  };

  if (!showCelebration || !drereData) return null;

  return (
    <>
      {/* Celebration Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="relative w-full max-w-md bg-gradient-to-br from-[#1a1a2e] to-[#0a0a0f] rounded-3xl border-2 border-[#fbbf24] p-8 text-center animate-bounce-in">
          {/* Crown animation */}
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-7xl animate-bounce">
            👑
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
            <h2 className="text-2xl font-black text-[#fbbf24] mb-2">
              TU ES LE DRÈRE DU JOUR !
            </h2>
            <p className="text-gray-400 mb-6">
              Avec <span className="text-[#fbbf24] font-bold">{drereData.points} points</span> aujourd&apos;hui
            </p>

            {/* Avatar */}
            <div className="relative w-32 h-32 mx-auto mb-6 rounded-full overflow-hidden ring-4 ring-[#fbbf24]">
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

            <button
              onClick={closeCelebration}
              className="px-8 py-3 bg-[#fbbf24] text-black font-bold rounded-xl hover:bg-[#f59e0b] transition-colors"
            >
              Merci, je sais ! 😎
            </button>
          </div>
        </div>
      </div>

      {/* Floating music control (visible after closing modal) */}
      {!showCelebration && isPlaying && (
        <button
          onClick={toggleMusic}
          className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-[#fbbf24] rounded-full flex items-center justify-center shadow-lg hover:bg-[#f59e0b] transition-colors"
        >
          <span className="text-2xl">⏸️</span>
        </button>
      )}
    </>
  );
}
