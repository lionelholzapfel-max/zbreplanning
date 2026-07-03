'use client';

import { useState, useEffect, useRef } from 'react';

interface DrereWeekSongProps {
  weekStartDate?: string;
  drereName: string;
}

interface SongData {
  id: number;
  week_start_date: string;
  user_id: string;
  lyrics: string;
  audio_url: string | null;
  cover_image_url: string | null;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  member_name: string;
  member_slug: string;
}

export function DrereWeekSong({ weekStartDate, drereName }: DrereWeekSongProps) {
  const [song, setSong] = useState<SongData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [loading, setLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    async function loadSong() {
      try {
        const url = weekStartDate
          ? `/api/drere-song?week=${weekStartDate}`
          : '/api/drere-song';
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setSong(data.song);
        }
      } catch (error) {
        console.error('Error loading song:', error);
      } finally {
        setLoading(false);
      }
    }

    loadSong();
  }, [weekStartDate]);

  const togglePlay = () => {
    if (!song?.audio_url) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(song.audio_url);
      audioRef.current.onended = () => setIsPlaying(false);
      audioRef.current.onerror = () => {
        console.error('Audio playback error');
        setIsPlaying(false);
      };
    }

    if (isPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  if (loading) {
    return null;
  }

  // No song available yet
  if (!song) {
    return (
      <div className="mt-4 p-4 rounded-[10px] bg-[var(--surface-2)] top-light">
        <p className="text-sm text-[var(--text-primary)] font-medium">Hymne du Drère of the Week</p>
        <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Bientôt disponible…</p>
      </div>
    );
  }

  // Song is being generated
  if (song.status === 'generating' || song.status === 'pending') {
    return (
      <div className="mt-4 p-4 rounded-[10px] bg-[var(--surface-2)] top-light">
        <div className="flex items-center gap-3">
          <span className="flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-[var(--gold)] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--gold)]" />
          </span>
          <div>
            <p className="text-sm text-[var(--text-primary)] font-medium">Hymne en création…</p>
            <p className="text-xs text-[var(--text-tertiary)]">La chanson de {drereName} se compose</p>
          </div>
        </div>
      </div>
    );
  }

  // Song failed
  if (song.status === 'failed') {
    return null;
  }

  // Song is ready
  return (
    <div className="mt-4 p-4 rounded-[10px] bg-[var(--surface-2)] top-light">
      <div className="flex items-center gap-3">
        {/* Album cover or play button — gold ring = the Drère (legitimate) */}
        <div className="relative">
          {song.cover_image_url ? (
            <div className="relative w-14 h-14">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={song.cover_image_url}
                alt="Pochette"
                className={`w-14 h-14 rounded-[8px] object-cover ${
                  isPlaying ? 'ring-2 ring-[var(--gold)] ring-offset-2 ring-offset-[var(--surface-2)]' : ''
                }`}
              />
              <button
                onClick={togglePlay}
                disabled={!song.audio_url}
                className="absolute inset-0 flex items-center justify-center rounded-[8px] bg-black/30 hover:bg-black/50 transition-colors"
              >
                <span className="text-[var(--text-primary)] text-xl">{isPlaying ? '⏹' : '▶'}</span>
              </button>
            </div>
          ) : (
            <button
              onClick={togglePlay}
              disabled={!song.audio_url}
              className={`w-14 h-14 rounded-[8px] flex items-center justify-center transition-colors ${
                song.audio_url
                  ? 'bg-[var(--surface-3)] hover:bg-[var(--surface-4)]'
                  : 'bg-[var(--surface-3)] cursor-not-allowed'
              }`}
            >
              <span className="text-[var(--gold)] text-xl">{isPlaying ? '⏹' : '▶'}</span>
            </button>
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm text-[var(--text-primary)] font-medium flex items-center gap-2">
            Hymne du Drère of the Week
            {isPlaying && (
              <span className="flex gap-0.5">
                <span className="w-1 h-3 bg-[var(--gold)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-4 bg-[var(--gold)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-3 bg-[var(--gold)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            )}
          </p>
          <p className="text-xs text-[var(--text-tertiary)]">La chanson de {drereName}</p>
        </div>
        <button
          onClick={() => setShowLyrics(!showLyrics)}
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
        >
          {showLyrics ? 'Masquer' : 'Paroles'}
        </button>
      </div>

      {/* Lyrics dropdown */}
      {showLyrics && song.lyrics && (
        <div className="mt-3 p-3 rounded-[8px] bg-[var(--surface-3)]">
          <p className="text-xs text-[var(--text-secondary)] whitespace-pre-line italic">
            {song.lyrics}
          </p>
        </div>
      )}

      {/* Visualizer when playing */}
      {isPlaying && (
        <div className="mt-3 flex justify-center gap-1">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-[var(--gold)] rounded-full animate-pulse"
              style={{
                height: `${Math.random() * 20 + 5}px`,
                animationDelay: `${i * 50}ms`,
                animationDuration: `${300 + Math.random() * 200}ms`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
