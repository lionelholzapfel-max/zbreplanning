'use client';

import { useState, useEffect, useMemo } from 'react';
import { getTeamFacts, TEAM_FACTS, type TeamFacts } from '@/data/team-facts';
import { TeamFactsSheet } from './TeamFactsSheet';
import matches from '@/data/matches.json';

// Flag mapping
const FLAGS: Record<string, string> = {
  'Maroc': '🇲🇦', 'Portugal': '🇵🇹', 'Espagne': '🇪🇸', 'USA': '🇺🇸',
  'Mexique': '🇲🇽', 'Canada': '🇨🇦', 'Argentine': '🇦🇷', 'Chili': '🇨🇱',
  'Pérou': '🇵🇪', 'Équateur': '🇪🇨', 'Brésil': '🇧🇷', 'Colombie': '🇨🇴',
  'Paraguay': '🇵🇾', 'Uruguay': '🇺🇾', 'Bolivie': '🇧🇴', 'Venezuela': '🇻🇪',
  'France': '🇫🇷', 'Allemagne': '🇩🇪', 'Danemark': '🇩🇰', 'Italie': '🇮🇹',
  'Pays-Bas': '🇳🇱', 'Angleterre': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Belgique': '🇧🇪', 'Suisse': '🇨🇭',
  'Autriche': '🇦🇹', 'Pologne': '🇵🇱', 'Serbie': '🇷🇸', 'Croatie': '🇭🇷',
  'Écosse': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Slovénie': '🇸🇮', 'Turquie': '🇹🇷', 'Albanie': '🇦🇱',
  'Ukraine': '🇺🇦', 'Hongrie': '🇭🇺', 'République tchèque': '🇨🇿', 'Galles': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  'Japon': '🇯🇵', 'Corée du Sud': '🇰🇷', 'Australie': '🇦🇺', 'Arabie Saoudite': '🇸🇦',
  'Iran': '🇮🇷', 'Qatar': '🇶🇦', 'Indonésie': '🇮🇩', 'Cameroun': '🇨🇲',
  'Nigeria': '🇳🇬', 'Sénégal': '🇸🇳', 'Afrique du Sud': '🇿🇦', 'Côte d\'Ivoire': '🇨🇮',
  'Égypte': '🇪🇬', 'Algérie': '🇩🇿', 'Mali': '🇲🇱', 'RD Congo': '🇨🇩',
};

function getFlag(team: string): string {
  return FLAGS[team] || '🏳️';
}

type FactType = 'funny' | 'smart' | 'football';

interface MatchData {
  id: number;
  date: string;
  match: string;
}

function parseTeamsFromMatch(matchStr: string): [string, string] | null {
  const parts = matchStr.split(' - ');
  if (parts.length !== 2) return null;
  return [parts[0].trim(), parts[1].trim()];
}

function getTeamsPlayingToday(): string[] {
  // Get today's date in YYYY-MM-DD format
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const teams: string[] = [];

  for (const match of matches as MatchData[]) {
    if (match.date === todayStr) {
      const parsed = parseTeamsFromMatch(match.match);
      if (parsed) {
        const [team1, team2] = parsed;
        // Only include real teams (not placeholders)
        if (TEAM_FACTS[team1]) teams.push(team1);
        if (TEAM_FACTS[team2]) teams.push(team2);
      }
    }
  }

  return teams;
}

function getRandomTeamAndFact(): { team: string; factType: FactType; fact: string } | null {
  const teamsToday = getTeamsPlayingToday();

  // If there are teams playing today, pick from them; otherwise pick any team
  const teamPool = teamsToday.length > 0 ? teamsToday : Object.keys(TEAM_FACTS);

  if (teamPool.length === 0) return null;

  const randomTeam = teamPool[Math.floor(Math.random() * teamPool.length)];
  const facts = TEAM_FACTS[randomTeam];
  if (!facts) return null;

  const factTypes: FactType[] = ['funny', 'smart', 'football'];
  const randomType = factTypes[Math.floor(Math.random() * factTypes.length)];

  return {
    team: randomTeam,
    factType: randomType,
    fact: facts[randomType],
  };
}

const FACT_TYPE_LABELS: Record<FactType, { emoji: string; label: string }> = {
  funny: { emoji: '😂', label: 'Marrante' },
  smart: { emoji: '🧠', label: 'Intelligente' },
  football: { emoji: '⚽', label: 'Footballistique' },
};

export function FunFactCard() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  // Generate random fact on mount (client-side only)
  const [randomFact, setRandomFact] = useState<{
    team: string;
    factType: FactType;
    fact: string;
  } | null>(null);

  useEffect(() => {
    setRandomFact(getRandomTeamAndFact());
  }, []);

  // Don't render until we have a fact (avoids hydration mismatch)
  if (!randomFact) {
    return (
      <div className="glass rounded-2xl p-6 animate-pulse">
        <div className="h-6 bg-white/10 rounded w-1/3 mb-4"></div>
        <div className="h-16 bg-white/10 rounded"></div>
      </div>
    );
  }

  const { team, factType, fact } = randomFact;
  const { emoji, label } = FACT_TYPE_LABELS[factType];
  const teamsToday = getTeamsPlayingToday();
  const isPlayingToday = teamsToday.includes(team);

  return (
    <>
      <div
        onClick={() => setIsSheetOpen(true)}
        className="glass rounded-2xl p-6 cursor-pointer hover:border-[#fbbf24]/50 transition-all group"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-xl">💡</span>
            <span>Fun fact du jour</span>
          </h3>
          {isPlayingToday && (
            <span className="px-2 py-1 bg-[#22c55e]/20 text-[#22c55e] rounded-lg text-xs font-medium">
              Joue aujourd'hui
            </span>
          )}
        </div>

        {/* Team badge */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">{getFlag(team)}</span>
          <span className="font-bold text-white">{team}</span>
          <span className="text-sm text-white/50 ml-auto">
            {emoji} {label}
          </span>
        </div>

        {/* Fact */}
        <p className="text-white/80 text-sm leading-relaxed line-clamp-3">
          {fact}
        </p>

        {/* CTA */}
        <div className="mt-4 text-sm text-[#6366f1] font-medium group-hover:text-[#818cf8] transition-colors flex items-center gap-1">
          <span>Voir les 3 facts</span>
          <span className="group-hover:translate-x-1 transition-transform">→</span>
        </div>
      </div>

      {/* Full sheet when tapped */}
      <TeamFactsSheet
        teamName={team}
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
      />
    </>
  );
}
