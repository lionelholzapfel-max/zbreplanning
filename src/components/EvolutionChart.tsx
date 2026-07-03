'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useSupabase } from '@/hooks/useSupabase';
import { Spinner } from '@/components/ui';
import { chartTheme, chartGridProps, chartAxisProps, chartTooltipStyle } from '@/lib/chart-theme';

interface Member {
  id: string;
  name: string;
  slug: string;
}

interface HistoryPoint {
  date: string;
  [userId: string]: number | string;
}

export function EvolutionChart() {
  const { currentUser } = useSupabase();
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hovered, setHovered] = useState<string | null>(null);
  // Tap-to-show works, but recharts leaves the tooltip stuck on touch (no
  // hover-out). Dismiss it when the user taps anywhere outside the chart by
  // firing a mouseleave on recharts' wrapper.
  const chartWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dismiss = (e: Event) => {
      const el = chartWrapRef.current;
      if (!el || (e.target instanceof Node && el.contains(e.target))) return;
      el.querySelector('.recharts-wrapper')?.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/leaderboard/history');
        if (res.ok) {
          const data = await res.json();
          setHistory(data.history || []);
          setMembers(data.members || []);
        }
      } catch (error) {
        console.error('Error loading history:', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const currentUserId = currentUser?.member_id;

  // Leader = highest points at the last recorded date.
  const leaderId = useMemo(() => {
    if (!history.length || !members.length) return null;
    const last = history[history.length - 1];
    let best: string | null = null;
    let bestVal = -Infinity;
    for (const m of members) {
      const v = Number(last[m.id] ?? -Infinity);
      if (v > bestVal) {
        bestVal = v;
        best = m.id;
      }
    }
    return best;
  }, [history, members]);

  // Semantic colors only: you = accent, leader = gold, everyone else muted.
  const baseColor = (id: string) =>
    id === currentUserId ? chartTheme.accent : id === leaderId ? chartTheme.gold : chartTheme.other;

  const toggle = (id: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  // Tooltip: surface-3 panel, sorted, numbers in .score
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ dataKey: string; value: number; color: string }>; label?: string }) => {
    if (!active || !payload || payload.length === 0) return null;
    const sorted = [...payload].sort((a, b) => (b.value || 0) - (a.value || 0));
    return (
      <div className="rounded-[8px] bg-[var(--surface-3)] top-light p-3">
        <p className="eyebrow mb-2">{formatDate(String(label))}</p>
        <div className="space-y-1">
          {sorted.map((entry, i) => {
            const member = members.find((m) => m.id === entry.dataKey);
            return (
              <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
                <span className="text-[var(--text-tertiary)] w-4 tabular-nums">{i + 1}.</span>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-[var(--text-secondary)] flex-1">{member?.name || entry.dataKey}</span>
                <span className="score text-[13px] text-[var(--text-primary)]">{entry.value}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="rounded-[10px] bg-[var(--surface-1)] top-light p-6">
        <div className="flex items-center justify-center h-64">
          <Spinner />
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="rounded-[10px] bg-[var(--surface-1)] top-light p-6">
        <div className="flex items-center justify-center h-48 text-sm text-[var(--text-tertiary)]">
          Pas encore de données
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] bg-[var(--surface-1)] top-light p-4 sm:p-6">
      <div ref={chartWrapRef} className="h-64 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="date" tickFormatter={formatDate} {...chartAxisProps} interval="preserveStartEnd" />
            <YAxis {...chartAxisProps} />
            <Tooltip content={<CustomTooltip />} cursor={chartTooltipStyle.cursor} />
            {members.map((member) => {
              if (hidden.has(member.id)) return null;
              const highlighted = member.id === currentUserId || member.id === leaderId;
              const isHovered = hovered === member.id;
              const stroke = isHovered && !highlighted ? chartTheme.otherHover : baseColor(member.id);
              return (
                <Line
                  key={member.id}
                  type="monotone"
                  dataKey={member.id}
                  name={member.id}
                  stroke={stroke}
                  strokeWidth={highlighted || isHovered ? 2 : chartTheme.strokeWidth}
                  dot={false}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                  onMouseOver={() => setHovered(member.id)}
                  onMouseOut={() => setHovered(null)}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend — interactive (toggle), names in secondary */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        {members.map((member) => {
          const isHidden = hidden.has(member.id);
          return (
            <button
              key={member.id}
              onClick={() => toggle(member.id)}
              onMouseOver={() => setHovered(member.id)}
              onMouseOut={() => setHovered(null)}
              className={`text-xs transition-colors flex items-center gap-1.5 ${
                isHidden
                  ? 'text-[var(--text-tertiary)] line-through'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: isHidden ? 'var(--text-tertiary)' : baseColor(member.id) }}
              />
              {member.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
