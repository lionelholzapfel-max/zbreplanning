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
      <div className="mt-4 p-4 bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-xl border border-purple-500/30">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎵</span>
          <div>
            <p className="text-sm text-white font-medium">Hymne du Drère of the Week</p>
            <p className="text-xs text-gray-400">Bientôt disponible...</p>
          </div>
        </div>
      </div>
    );
  }

  // Song is being generated
  if (song.status === 'generating' || song.status === 'pending') {
    return (
      <div className="mt-4 p-4 bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-xl border border-purple-500/30">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="text-2xl">🎵</span>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
            </span>
          </div>
          <div>
            <p className="text-sm text-white font-medium">Hymne en création...</p>
            <p className="text-xs text-gray-400">L&apos;IA compose la chanson de {drereName}</p>
          </div>
        </div>
      </div>
    );
  }

  // Song failed
  if (song.status === 'failed') {
    return null;
  }

  // Song is ready!
  return (
    <div className="mt-4 p-4 bg-gradient-to-r from-purple-900/40 to-pink-900/40 rounded-xl border border-purple-500/40">
      {/* Header with cover art and play button */}
      <div className="flex items-center gap-3">
        {/* Album cover or play button */}
        <div className="relative">
          {song.cover_image_url ? (
            <div className="relative w-14 h-14">
              <img
                src={song.cover_image_url}
                alt="Album cover"
                className={`w-14 h-14 rounded-lg object-cover shadow-lg ${isPlaying ? 'ring-2 ring-purple-500 ring-offset-2 ring-offset-gray-900' : ''}`}
              />
              <button
                onClick={togglePlay}
                disabled={!song.audio_url}
                className={`absolute inset-0 flex items-center justify-center rounded-lg transition-all ${
                  isPlaying
                    ? 'bg-black/50'
                    : 'bg-black/30 hover:bg-black/50'
                }`}
              >
                {isPlaying ? (
                  <span className="text-white text-xl">⏹</span>
                ) : (
                  <span className="text-white text-xl">▶</span>
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={togglePlay}
              disabled={!song.audio_url}
              className={`w-14 h-14 rounded-lg flex items-center justify-center transition-all ${
                isPlaying
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                  : song.audio_url
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                  : 'bg-gray-600 cursor-not-allowed'
              }`}
            >
              {isPlaying ? (
                <span className="text-white text-xl">⏹</span>
              ) : (
                <span className="text-white text-xl">▶</span>
              )}
            </button>
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm text-white font-bold flex items-center gap-2">
            🎵 Hymne du Drère of the Week
            {isPlaying && (
              <span className="flex gap-0.5">
                <span className="w-1 h-3 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1 h-4 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1 h-3 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </span>
            )}
          </p>
          <p className="text-xs text-gray-400">La chanson de {drereName} - Drère of the Week</p>
        </div>
        <button
          onClick={() => setShowLyrics(!showLyrics)}
          className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
        >
          {showLyrics ? 'Masquer' : 'Paroles'}
        </button>
      </div>

      {/* Lyrics dropdown */}
      {showLyrics && song.lyrics && (
        <div className="mt-3 p-3 bg-black/30 rounded-lg">
          <p className="text-xs text-gray-300 whitespace-pre-line italic">
            {song.lyrics}
          </p>
        </div>
      )}

      {/* Animated visualizer when playing */}
      {isPlaying && (
        <div className="mt-3 flex justify-center gap-1">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-gradient-to-t from-purple-500 to-pink-500 rounded-full animate-pulse"
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
