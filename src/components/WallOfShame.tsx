'use client';

import { useState, useEffect } from 'react';
import { Avatar } from '@/components/ui';

interface ShameEntry {
  user_id: string;
  member_name: string;
  member_slug: string;
  match_id: number;
  match_name: string;
  predicted_home: number;
  predicted_away: number;
  actual_home: number;
  actual_away: number;
  shame_score: number;
  date: string;
}

const SHAME_QUOTES = [
  "T'as pronostiqué avec les pieds ?",
  "Même ma grand-mère aurait fait mieux",
  "Le football, c'est pas ton truc hein",
  "Tu regardais quel sport exactement ?",
  "L'optimisme, c'est bien. Là c'était trop.",
  "Faut arrêter de pronostiquer bourré",
];

export function WallOfShame() {
  const [shameList, setShameList] = useState<ShameEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/wall-of-shame');
        if (res.ok) {
          const data = await res.json();
          setShameList(data.shameList || []);
        }
      } catch (error) {
        console.error('Error loading wall of shame:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return null;
  }

  if (shameList.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[10px] bg-[var(--surface-1)] top-light overflow-hidden">
      {shameList.map((entry, index) => (
        <div
          key={`${entry.user_id}-${entry.match_id}`}
          className="flex items-start gap-3 p-4 border-b border-[var(--hairline)] last:border-b-0"
        >
          <Avatar slug={entry.member_slug} name={entry.member_name} size={28} ring="muted" className="mt-0.5" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium text-[var(--text-primary)]">{entry.member_name.split(' ')[0]}</span>
              <span className="text-[12px] text-[var(--text-tertiary)] truncate">{entry.match_name}</span>
            </div>

            <p className="mt-0.5 text-[13px] text-[var(--text-tertiary)]">
              Prono <span className="score">{entry.predicted_home}-{entry.predicted_away}</span>
              <span className="mx-1.5">·</span>
              Réel <span className="score">{entry.actual_home}-{entry.actual_away}</span>
            </p>

            {/* The quote is the star */}
            <p className="mt-1.5 text-[14px] italic text-[var(--text-secondary)]">
              « {SHAME_QUOTES[index % SHAME_QUOTES.length]} »
            </p>
          </div>

          <span className="score text-[13px] text-[var(--danger)] shrink-0 mt-0.5">−{entry.shame_score}</span>
        </div>
      ))}
    </div>
  );
}
