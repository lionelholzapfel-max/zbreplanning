'use client';

import { useEffect, useRef, useState } from 'react';

interface CountUpProps {
  value: number;
  className?: string;
  /** zero-pad to this width (e.g. 2 → "07"). 0 = no padding. */
  pad?: number;
  /** animation duration in ms */
  durationMs?: number;
}

/**
 * Hero number that counts up from 0 → value over 500ms (ease-out) ON MOUNT only.
 * After the first mount it simply follows `value` (so a live countdown keeps
 * ticking without re-animating). Respects prefers-reduced-motion.
 */
export function CountUp({ value, className, pad = 0, durationMs = 500 }: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      setDisplay(value);
      return;
    }
    started.current = true;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || value === 0) {
      setDisplay(value);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setDisplay(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplay(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  const text = pad > 0 ? String(display).padStart(pad, '0') : String(display);
  return <span className={className}>{text}</span>;
}
