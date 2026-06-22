'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

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

const SHAME_TITLES = [
  '🏆 Champion du Nawak',
  '🥈 Vice-Champion du Délire',
  '🥉 Médaille de Bronze du WTF',
];

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
    <div className="bg-gradient-to-br from-red-950/30 via-[#1e1e2e] to-[#1e1e2e] rounded-2xl p-4 sm:p-6 border border-red-500/30">
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <span>🫣</span>
        Mur de la Honte
        <span className="text-xs text-red-400 font-normal ml-2">cette semaine</span>
      </h3>

      <div className="space-y-3">
        {shameList.map((entry, index) => (
          <div
            key={`${entry.user_id}-${entry.match_id}`}
            className="relative bg-black/30 rounded-xl p-3 sm:p-4 border border-red-500/20 overflow-hidden"
          >
            {/* Wanted poster style diagonal banner */}
            {index === 0 && (
              <div className="absolute -right-8 top-3 bg-red-600 text-white text-xs font-bold px-8 py-1 rotate-45">
                PIRE
              </div>
            )}

            <div className="flex items-start gap-3">
              {/* Rank & Avatar */}
              <div className="flex flex-col items-center gap-1">
                <span className="text-lg">{SHAME_TITLES[index]?.split(' ')[0]}</span>
                <div className="relative w-12 h-12 rounded-full overflow-hidden ring-2 ring-red-500/50 grayscale hover:grayscale-0 transition-all">
                  <Image
                    src={`/members/${entry.member_slug}.png`}
                    alt={entry.member_name}
                    fill
                    className="object-cover object-top"
                  />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-white">{entry.member_name.split(' ')[0]}</span>
                  <span className="text-xs text-red-400">{SHAME_TITLES[index]?.split(' ').slice(1).join(' ')}</span>
                </div>

                <p className="text-xs text-gray-400 mb-2 truncate">{entry.match_name}</p>

                {/* Prediction vs Reality */}
                <div className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">Prono:</span>
                    <span className="text-red-400 font-bold">{entry.predicted_home} - {entry.predicted_away}</span>
                  </div>
                  <span className="text-gray-600">→</span>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">Réel:</span>
                    <span className="text-green-400 font-bold">{entry.actual_home} - {entry.actual_away}</span>
                  </div>
                </div>

                {/* Shame quote */}
                <p className="text-xs text-gray-500 italic mt-2">
                  "{SHAME_QUOTES[index % SHAME_QUOTES.length]}"
                </p>
              </div>

              {/* Shame score */}
              <div className="text-center">
                <div className="text-2xl font-black text-red-500">-{entry.shame_score}</div>
                <div className="text-xs text-gray-500">buts</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
