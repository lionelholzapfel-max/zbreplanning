/**
 * Verification test: ensures every team in matches.json has facts
 * and every team in team-facts.ts exists in matches.json
 *
 * Run with: npx vitest src/data/team-facts.test.ts
 */

import { describe, it, expect } from 'vitest';
import { TEAM_FACTS, getTeamsWithFacts } from './team-facts';
import matchesData from './matches.json';

// Extract unique team names from matches.json (excluding placeholder teams)
function getTeamsFromMatches(): string[] {
  const teams = new Set<string>();

  for (const match of matchesData) {
    const parts = match.match.split(' - ');
    if (parts.length === 2) {
      const team1 = parts[0].trim();
      const team2 = parts[1].trim();

      // Skip placeholder teams (knockout stage)
      const isPlaceholder = (name: string) =>
        name.includes('Vainqueur') ||
        name.includes('Perdant') ||
        name.includes('1er ') ||
        name.includes('2e ') ||
        name.includes('3e ');

      if (!isPlaceholder(team1)) teams.add(team1);
      if (!isPlaceholder(team2)) teams.add(team2);
    }
  }

  return Array.from(teams).sort();
}

describe('Team Facts Verification', () => {
  const teamsFromMatches = getTeamsFromMatches();
  const teamsWithFacts = getTeamsWithFacts().sort();

  it('should have exactly 48 teams in matches.json', () => {
    expect(teamsFromMatches.length).toBe(48);
  });

  it('should have exactly 48 teams with facts', () => {
    expect(teamsWithFacts.length).toBe(48);
  });

  it('every team in matches.json should have facts', () => {
    const missingFacts: string[] = [];

    for (const team of teamsFromMatches) {
      if (!TEAM_FACTS[team]) {
        missingFacts.push(team);
      }
    }

    if (missingFacts.length > 0) {
      console.log('❌ Teams missing facts:', missingFacts);
    }

    expect(missingFacts).toEqual([]);
  });

  it('every team with facts should exist in matches.json', () => {
    const orphanFacts: string[] = [];

    for (const team of teamsWithFacts) {
      if (!teamsFromMatches.includes(team)) {
        orphanFacts.push(team);
      }
    }

    if (orphanFacts.length > 0) {
      console.log('❌ Orphan facts (team not in matches):', orphanFacts);
    }

    expect(orphanFacts).toEqual([]);
  });

  it('every team fact should have all three fields', () => {
    const incomplete: string[] = [];

    for (const [team, facts] of Object.entries(TEAM_FACTS)) {
      if (!facts.funny || !facts.smart || !facts.football) {
        incomplete.push(team);
      }
    }

    expect(incomplete).toEqual([]);
  });

  it('should display verification summary', () => {
    const matchCount = teamsFromMatches.length;
    const factsCount = teamsWithFacts.length;

    console.log(`\n✅ Verification: ${matchCount}/48 teams in matches.json`);
    console.log(`✅ Verification: ${factsCount}/48 teams with facts`);

    // Check perfect match
    const allMatch = teamsFromMatches.every(t => TEAM_FACTS[t]) &&
                     teamsWithFacts.every(t => teamsFromMatches.includes(t));

    if (allMatch) {
      console.log(`✅ Perfect match: 48/48 ✅`);
    }

    expect(allMatch).toBe(true);
  });
});
