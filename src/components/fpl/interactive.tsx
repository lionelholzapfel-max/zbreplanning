'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, X } from 'lucide-react';
import { MANAGER_BY_SLUG, photoUrl, type ManagerSlug } from '@/lib/fpl/config';

/** Live countdown to the next FPL deadline. */
export function Countdown({ iso }: { iso: string }) {
  const target = new Date(iso).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // First tick deferred so server and client markup match (no Date.now() during render).
    const first = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  if (now === null) return <span className="f-num">—</span>;
  const diff = Math.max(0, target - now);
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  if (diff === 0) return <span className="f-num">Deadline passée</span>;
  return (
    <span className="f-num tabular-nums" suppressHydrationWarning>
      {d > 0 ? `${d}j ` : ''}
      {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

/** Small play/pause button for a song or sound. */
export function SoundButton({ src, label }: { src: string; label: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  return (
    <>
      <audio ref={ref} src={src} preload="none" onEnded={() => setPlaying(false)} onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} />
      <button
        type="button"
        onClick={() => {
          const a = ref.current;
          if (!a) return;
          if (a.paused) a.play().catch(() => setPlaying(false));
          else a.pause();
        }}
        className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-full bg-[var(--f-surface-3)] hover:bg-[#2a2f3b] border border-[var(--f-line)] text-sm font-semibold transition-colors"
        aria-label={playing ? `Pause ${label}` : `Écouter ${label}`}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        {label}
      </button>
    </>
  );
}

/**
 * Full-screen "Drère / Mzi of the GW" reveal, shown ONCE per gameweek per
 * browser (localStorage), then only the regular page blocks remain.
 */
export function GwCelebration({
  gw,
  drere,
  mzi,
  drerePts,
  mziPts,
}: {
  gw: number;
  drere: ManagerSlug[];
  mzi: ManagerSlug[];
  drerePts: number | null;
  mziPts: number | null;
}) {
  const key = `fpl-celebration-seen-gw${gw}`;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // Small delay so the page paints first, then the reveal.
    // The one-time World Cup champion announcement (global, rendered in Providers
    // right after the page) wins the first visit. The page's effects run before
    // that sibling's, so its flag is read here before it marks itself as seen.
    // (A loading.tsx / Suspense boundary around the page would break this order.)
    // The FPL reveal then shows on the next visit instead of stacking two overlays.
    let championFirst = false;
    try {
      championFirst = !localStorage.getItem('champion-celebration-seen');
    } catch {
      // storage blocked: handled below
    }
    const t = setTimeout(() => {
      if (championFirst) return;
      try {
        if (!localStorage.getItem(key)) setOpen(true);
      } catch {
        // storage blocked: never show the overlay rather than show it every time
      }
    }, 500);
    return () => clearTimeout(t);
  }, [key]);
  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(key, '1');
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!open || !drere.length) return null;
  const d = MANAGER_BY_SLUG[drere[0]];
  const z = mzi.length ? MANAGER_BY_SLUG[mzi[0]] : null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Résultats de la GW${gw}`}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="theme-fpl f-champ f-in w-full max-w-md p-6 text-center !min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center text-[var(--f-muted)] hover:text-white"
          aria-label="Fermer"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="f-label !text-[var(--f-gold)]">GW{gw} · terminée</div>
        <div className="relative mx-auto my-5 w-40 h-40">
          <div className="absolute inset-0 rounded-full f-glow" style={{ ['--c' as string]: d.color }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl(d.slug, 'face')}
            alt={d.firstName}
            className="relative w-40 h-40 rounded-full object-cover"
            style={{ boxShadow: `0 0 0 4px var(--f-gold)` }}
          />
        </div>
        <div className="f-anton text-5xl">
          {drere.map((s) => MANAGER_BY_SLUG[s].firstName).join(' & ')}
        </div>
        <div className="f-display text-xl text-[var(--f-gold)] mt-1">Drère de la semaine</div>
        {drerePts !== null ? <div className="f-num text-lg mt-1">{drerePts} pts</div> : null}
        {z ? (
          <div className="mt-6 pt-4 border-t border-[var(--f-line)] flex items-center justify-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl(z.slug, 'face')} alt={z.firstName} className="w-12 h-12 rounded-full object-cover grayscale" />
            <div className="text-left">
              <div className="f-label">Mzi de la semaine</div>
              <div className="font-semibold">
                {mzi.map((s) => MANAGER_BY_SLUG[s].firstName).join(' & ')}
                {mziPts !== null ? <span className="text-[var(--f-muted)] font-normal"> · {mziPts} pts</span> : null}
              </div>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onClick={close}
          className="mt-6 w-full min-h-[44px] rounded-md bg-[var(--f-gold)] text-black font-bold f-display"
        >
          Voir la review
        </button>
      </div>
    </div>
  );
}

/** Collapsible long text (review per manager, transfers list…). */
export function Expandable({ children, label = 'Voir plus', className = '' }: { children: React.ReactNode; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={className}>
      {open ? children : null}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-2 min-h-[44px] text-sm font-semibold text-[var(--f-blue)] hover:underline"
        aria-expanded={open}
      >
        {open ? 'Réduire' : label}
      </button>
    </div>
  );
}
