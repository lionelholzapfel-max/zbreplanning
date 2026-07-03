'use client';

import { useEffect, useRef } from 'react';

export interface DayOption {
  /** ISO date "YYYY-MM-DD" */
  date: string;
  /** Number of matches that day */
  count: number;
}

interface DayStripProps {
  /** Unique tournament days, sorted ascending, with their match counts. */
  days: DayOption[];
  /** Current selection: 'all' or a "YYYY-MM-DD". */
  selectedDay: string;
  /** Today's ISO date, or null before mount. Used for the "Auj" marker. */
  todayISO: string | null;
  /** Total number of matches (for the "Tous" chip counter). */
  totalCount: number;
  onSelect: (day: string) => void;
}

const WEEKDAYS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

function parseISO(iso: string): { weekday: string; day: number } {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return { weekday: WEEKDAYS[date.getDay()], day };
}

/**
 * Horizontal, scrollable strip of tournament days (prono-app style).
 * Tap a day to see its matches. Auto-centers the active day.
 */
export function DayStrip({ days, selectedDay, todayISO, totalCount, onSelect }: DayStripProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const firstCenterRef = useRef(true);

  // Center the active chip. Instant on the first run (mount), smooth afterwards.
  // Uses scrollLeft math (not scrollIntoView) to avoid any vertical page jump.
  useEffect(() => {
    const container = containerRef.current;
    const active = activeRef.current;
    if (!container || !active) return;
    const target = active.offsetLeft - container.clientWidth / 2 + active.clientWidth / 2;
    container.scrollTo({ left: Math.max(0, target), behavior: firstCenterRef.current ? 'auto' : 'smooth' });
    firstCenterRef.current = false;
  }, [selectedDay]);

  const chipClass = (active: boolean) =>
    `shrink-0 flex flex-col items-center justify-center gap-0.5 w-14 h-14 rounded-[10px] transition-colors ${
      active
        ? 'bg-[var(--accent-muted)] text-[var(--accent)]'
        : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
    }`;

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label="Filtrer par jour"
      className="flex gap-1.5 overflow-x-auto scrollbar-hide"
    >
      {/* "Tous" — reset to every day */}
      <button
        ref={selectedDay === 'all' ? activeRef : undefined}
        role="tab"
        aria-selected={selectedDay === 'all'}
        onClick={() => onSelect('all')}
        className={chipClass(selectedDay === 'all')}
      >
        <span className="text-[13px] font-medium leading-none">Tous</span>
        <span className="text-[10px] opacity-70 leading-none">{totalCount}</span>
      </button>

      {days.map(({ date, count }) => {
        const { weekday, day } = parseISO(date);
        const isSelected = selectedDay === date;
        const isToday = todayISO === date;
        return (
          <button
            key={date}
            ref={isSelected ? activeRef : undefined}
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelect(date)}
            className={chipClass(isSelected)}
          >
            <span
              className={`text-[10px] uppercase tracking-[0.06em] leading-none ${
                isToday && !isSelected ? 'text-[var(--accent)]' : ''
              }`}
            >
              {isToday ? 'Auj' : weekday}
            </span>
            <span className="score text-[16px]">{day}</span>
            <span className="text-[10px] opacity-70 leading-none">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
