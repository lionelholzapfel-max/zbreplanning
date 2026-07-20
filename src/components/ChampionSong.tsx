'use client';

import { useState, useEffect, useRef } from 'react';

// Hymne du Drère du Tournoi — generated once with Suno (flamenco), stored in
// the public drere-speeches bucket. Static: the tournament is over, this
// song will never change.
const AUDIO_URL =
  'https://wsimtsbtiijcyvgzavlp.supabase.co/storage/v1/object/public/drere-speeches/songs/drere-du-tournoi-kevin.mp3';

const LYRICS = `[Couplet 1]
Kevin au sommet, dréré, regarde bien
128 points, t'as mis tout le monde en chien
L'Espagne championne, t'avais déjà signé
Les autres lisaient le match, toi tu l'avais gagné

Lionel 121, doublé sur le fil
T'as cru revenir ? Trop tard, c'est fragile
Edu 121, même score, même décor
Mais sur le trône, c'est Kevin, pas vous deux d'abord

Ian 115, t'étais pas dans la danse
Sacha 109, Greg 109, même chance, même cadence
Sam 100, t'as fini tout rond
Et Martin 54, t'as joué, t'as coulé au fond

[Refrain]
Kevin, roi du tournoi
Kevin, roi du tournoi
Dréré, dréré, roi du tournoi
Les autres regardent, toi t'es déjà en haut

Kevin, roi du tournoi
Kevin, roi du tournoi
Dréré, dréré, roi du tournoi
Zbre Team s'incline, t'as pris tout le solo

[Couplet 2]
Max 26 points, le "Mzi", quelle purge
T'as fait rire la salle, t'as perdu dans l'urgence
Vingt-six petits points, c'est pas un score, c'est une blague
On t'a vu faire le malin, finir en carnaval de gags

T'as parlé trop fort, t'avais le torero
Mais t'as fini en mousse, sans gueule et sans bravo
Kevin, lui, tranquille, royal sur son siège
Pendant que vos pronos s'écroulaient comme des pièges

Lionel, Edu, vous étiez collés
Ian, Sacha, Greg, Sam, vous avez décroché
Martin, pauvre carton, tu faisais la figurine
Quand Kevin levait l'or, vous comptiez les ruines

[Refrain]
Kevin, roi du tournoi
Kevin, roi du tournoi
Dréré, dréré, roi du tournoi
Les autres regardent, toi t'es déjà en haut

Kevin, roi du tournoi
Kevin, roi du tournoi
Dréré, dréré, roi du tournoi
Zbre Team s'incline, t'as pris tout le solo

[Pont]
Ô Kevin, sur ton trône en feu
Les drapeaux tournent, les jaloux baissent les yeux
Un pas de plus, et tout le monde applaudit
Les perdants font la grimace, le vainqueur rit

Dréré, dréré, le roi est là
Dréré, dréré, personne ne bouge pas

[Refrain]
Kevin, roi du tournoi
Kevin, roi du tournoi
Dréré, dréré, roi du tournoi
Les autres regardent, toi t'es déjà en haut

Kevin, roi du tournoi
Kevin, roi du tournoi
Dréré, dréré, roi du tournoi
Zbre Team s'incline, t'as pris tout le solo`;

export function ChampionSong({ championName }: { championName: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(AUDIO_URL);
      audioRef.current.onended = () => setIsPlaying(false);
      audioRef.current.onerror = () => setIsPlaying(false);
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

  return (
    <div className="mt-4 p-4 rounded-[10px] bg-[var(--surface-1)] top-light">
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="w-14 h-14 rounded-[8px] flex items-center justify-center bg-[var(--surface-3)] hover:bg-[var(--surface-4)] transition-colors"
          aria-label={isPlaying ? 'Arrêter' : 'Écouter'}
        >
          <span className="text-[var(--gold)] text-xl">{isPlaying ? '⏹' : '▶'}</span>
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[var(--text-primary)] font-medium flex items-center gap-2">
            « Dréré sur le trône »
            {isPlaying && (
              <span className="flex gap-0.5">
                <span className="w-1 h-3 bg-[var(--gold)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-4 bg-[var(--gold)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-3 bg-[var(--gold)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            )}
          </p>
          <p className="text-xs text-[var(--text-tertiary)]">L&apos;hymne du sacre de {championName}</p>
        </div>
        <button
          onClick={() => setShowLyrics(!showLyrics)}
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
        >
          {showLyrics ? 'Masquer' : 'Paroles'}
        </button>
      </div>

      {showLyrics && (
        <div className="mt-3 p-3 rounded-[8px] bg-[var(--surface-3)]">
          <p className="text-xs text-[var(--text-secondary)] whitespace-pre-line italic">{LYRICS}</p>
        </div>
      )}
    </div>
  );
}
