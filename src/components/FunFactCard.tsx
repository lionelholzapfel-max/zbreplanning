'use client';

import { useState, useEffect } from 'react';
import { TEAM_FACTS } from '@/data/team-facts';
import { TeamFactsSheet } from './TeamFactsSheet';
import matches from '@/data/matches.json';
import { Card, Badge } from '@/components/ui';

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
      <Card className="p-6 animate-pulse">
        <div className="h-4 w-24 bg-white/5 rounded mb-4" />
        <div className="h-16 bg-white/5 rounded" />
      </Card>
    );
  }

  const { team, fact } = randomFact;
  const teamsToday = getTeamsPlayingToday();
  const isPlayingToday = teamsToday.includes(team);

  return (
    <>
      <Card
        onClick={() => setIsSheetOpen(true)}
        className="p-6 cursor-pointer transition-colors duration-150 ease-out hover:bg-[var(--surface-raised)]"
      >
        <div className="flex items-center justify-between mb-3">
          <p className="eyebrow">Fun fact</p>
          {isPlayingToday && <Badge variant="accent">Joue aujourd&apos;hui</Badge>}
        </div>

        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{getFlag(team)}</span>
          <span className="font-medium text-[var(--text-primary)]">{team}</span>
        </div>

        <p className="text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-3">
          {fact}
        </p>

        <div className="mt-4 inline-flex items-center gap-1 text-sm text-[var(--accent)]">
          Voir les 3 facts →
        </div>
      </Card>

      {/* Full sheet when tapped */}
      <TeamFactsSheet
        teamName={team}
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
      />
    </>
  );
}
