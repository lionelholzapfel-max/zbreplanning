'use client';

import { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface Member {
  id: string;
  name: string;
  slug: string;
}

interface HistoryPoint {
  date: string;
  [userId: string]: number | string;
}

// Colors for each member (cycle through if more than 16)
const COLORS = [
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
  '#84cc16', // lime
  '#14b8a6', // teal
  '#a855f7', // purple
  '#eab308', // yellow
  '#3b82f6', // blue
  '#22c55e', // green
  '#e11d48', // rose
  '#0ea5e9', // sky
];

export function EvolutionChart() {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [hiddenMembers, setHiddenMembers] = useState<Set<string>>(new Set());

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

  const toggleMember = (memberId: string) => {
    setHiddenMembers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
      return newSet;
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <div className="bg-[#1e1e2e] rounded-2xl p-6 border border-white/10">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="bg-[#1e1e2e] rounded-2xl p-6 border border-white/10">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <span>📈</span>
          Évolution des points
        </h3>
        <div className="flex items-center justify-center h-48 text-gray-500">
          Pas encore de données
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#1e1e2e] rounded-2xl p-4 sm:p-6 border border-white/10">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <span>📈</span>
        Évolution des points
      </h3>

      {/* Chart */}
      <div className="h-64 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              stroke="#666"
              tick={{ fill: '#888', fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#666"
              tick={{ fill: '#888', fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e1e2e',
                border: '1px solid #333',
                borderRadius: '8px',
              }}
              labelFormatter={formatDate}
              formatter={(value: number, name: string) => {
                const member = members.find(m => m.id === name);
                return [value + ' pts', member?.name || name];
              }}
            />
            {members.map((member, index) => (
              !hiddenMembers.has(member.id) && (
                <Line
                  key={member.id}
                  type="monotone"
                  dataKey={member.id}
                  name={member.id}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              )
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend - clickable to toggle */}
      <div className="mt-4 flex flex-wrap gap-2">
        {members.map((member, index) => (
          <button
            key={member.id}
            onClick={() => toggleMember(member.id)}
            className={`px-2 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              hiddenMembers.has(member.id)
                ? 'bg-white/5 text-gray-500 line-through'
                : 'bg-white/10 text-white'
            }`}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            {member.name}
          </button>
        ))}
      </div>
    </div>
  );
}
