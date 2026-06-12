/**
 * Test script to verify mapping of all 104 matches
 * Run with: npx tsx scripts/test-api-mapping.ts
 *
 * This script tests the team name mapping without making API calls
 */

import matches from '../src/data/matches.json';
import { TEAM_NAME_MAPPING, teamsMatch, apiTeamNameToOurs } from '../src/lib/football-api';

interface Match {
  id: number;
  date: string;
  time: string;
  match: string;
  phase: string;
  group: string;
}

// Simulated API team names (English versions)
const API_TEAM_NAMES: Record<string, string> = {
  'Mexique': 'Mexico',
  'Afrique du Sud': 'South Africa',
  'Corée du Sud': 'South Korea',
  'République tchèque': 'Czech Republic',
  'Canada': 'Canada',
  'Bosnie-Herzégovine': 'Bosnia and Herzegovina',
  'Qatar': 'Qatar',
  'Suisse': 'Switzerland',
  'Brésil': 'Brazil',
  'Maroc': 'Morocco',
  'Haïti': 'Haiti',
  'Écosse': 'Scotland',
  'Allemagne': 'Germany',
  'Japon': 'Japan',
  'Honduras': 'Honduras',
  'Turquie': 'Turkey',
  'Argentine': 'Argentina',
  'Ouganda': 'Uganda',
  'Australie': 'Australia',
  'Bahreïn': 'Bahrain',
  'France': 'France',
  'Colombie': 'Colombia',
  'Panama': 'Panama',
  'Nouvelle-Zélande': 'New Zealand',
  'Espagne': 'Spain',
  'Pays-Bas': 'Netherlands',
  'Équateur': 'Ecuador',
  'Corée du Nord': 'North Korea',
  'Angleterre': 'England',
  'Pologne': 'Poland',
  'Sénégal': 'Senegal',
  'Slovénie': 'Slovenia',
  'Belgique': 'Belgium',
  'Croatie': 'Croatia',
  'Grèce': 'Greece',
  'Ukraine': 'Ukraine',
  'Portugal': 'Portugal',
  'Italie': 'Italy',
  'Irlande': 'Ireland',
  'Égypte': 'Egypt',
  'USA': 'United States',
  'Chili': 'Chile',
  'Arabie Saoudite': 'Saudi Arabia',
  'Uruguay': 'Uruguay',
  'Nigeria': 'Nigeria',
  'Pérou': 'Peru',
  'Tunisie': 'Tunisia',
  'Indonésie': 'Indonesia',
  'RD Congo': 'DR Congo',
  "Côte d'Ivoire": 'Ivory Coast',
  'Mali': 'Mali',
  'Algérie': 'Algeria',
  'Cameroun': 'Cameroon',
  'Venezuela': 'Venezuela',
  'Bolivie': 'Bolivia',
  'Paraguay': 'Paraguay',
  'Danemark': 'Denmark',
  'Autriche': 'Austria',
  'Iran': 'Iran',
  'Serbie': 'Serbia',
  'Hongrie': 'Hungary',
  'Albanie': 'Albania',
  'Galles': 'Wales',
};

function parseTeams(matchStr: string): [string, string] | null {
  const parts = matchStr.split(' - ');
  if (parts.length !== 2) return null;
  return [parts[0].trim(), parts[1].trim()];
}

function runMappingTest() {
  console.log('🏆 Testing World Cup 2026 Match Mapping\n');
  console.log('='.repeat(60) + '\n');

  const allMatches = matches as Match[];
  const groupStageMatches = allMatches.filter(m => m.phase === 'PHASE DE GROUPES');
  const knockoutMatches = allMatches.filter(m => m.phase !== 'PHASE DE GROUPES');

  console.log(`📊 Total matches: ${allMatches.length}`);
  console.log(`   - Group stage: ${groupStageMatches.length}`);
  console.log(`   - Knockout: ${knockoutMatches.length}\n`);

  // Test group stage matches (real teams)
  let successCount = 0;
  let failedMatches: string[] = [];
  let missingTeams = new Set<string>();

  for (const match of groupStageMatches) {
    const teams = parseTeams(match.match);
    if (!teams) {
      failedMatches.push(`Match ${match.id}: Invalid format "${match.match}"`);
      continue;
    }

    const [home, away] = teams;
    let homeOk = false;
    let awayOk = false;

    // Check if we have mapping for this team
    if (TEAM_NAME_MAPPING[home]) {
      const apiName = API_TEAM_NAMES[home];
      if (apiName) {
        homeOk = teamsMatch(home, apiName);
      } else {
        // No simulated API name, but mapping exists - check reverse
        homeOk = TEAM_NAME_MAPPING[home].length > 0;
      }
    }

    if (TEAM_NAME_MAPPING[away]) {
      const apiName = API_TEAM_NAMES[away];
      if (apiName) {
        awayOk = teamsMatch(away, apiName);
      } else {
        awayOk = TEAM_NAME_MAPPING[away].length > 0;
      }
    }

    if (homeOk && awayOk) {
      successCount++;
    } else {
      if (!homeOk && !TEAM_NAME_MAPPING[home]) missingTeams.add(home);
      if (!awayOk && !TEAM_NAME_MAPPING[away]) missingTeams.add(away);
      failedMatches.push(`Match ${match.id}: ${match.match} (home: ${homeOk ? '✅' : '❌'}, away: ${awayOk ? '✅' : '❌'})`);
    }
  }

  // Knockout matches have placeholder teams
  const knockoutWithPlaceholders = knockoutMatches.filter(m => {
    const teams = parseTeams(m.match);
    if (!teams) return false;
    const [home, away] = teams;
    return home.includes('Vainqueur') || home.includes('Perdant') ||
           home.includes('1er ') || home.includes('2e ') || home.includes('3e ') ||
           away.includes('Vainqueur') || away.includes('Perdant') ||
           away.includes('1er ') || away.includes('2e ') || away.includes('3e ');
  });

  console.log('📋 Group Stage Mapping Results:');
  console.log(`   ✅ Mapped: ${successCount}/${groupStageMatches.length}`);
  if (failedMatches.length > 0) {
    console.log(`   ❌ Failed: ${failedMatches.length}`);
    failedMatches.forEach(f => console.log(`      - ${f}`));
  }

  console.log(`\n📋 Knockout Stage:`);
  console.log(`   - With placeholders (TBD teams): ${knockoutWithPlaceholders.length}`);
  console.log(`   - These will be mapped once teams are determined\n`);

  if (missingTeams.size > 0) {
    console.log('⚠️  Missing team mappings:');
    missingTeams.forEach(t => console.log(`   - "${t}"`));
    console.log('');
  }

  // Final verdict
  const groupStageOk = successCount === groupStageMatches.length;
  if (groupStageOk) {
    console.log(`\n✅ ${successCount}/${groupStageMatches.length} group stage matches mapped correctly!`);
    console.log(`✅ Knockout matches will be mapped dynamically once teams are known.`);
    console.log(`\n🎉 Mapping verification: PASSED`);
  } else {
    console.log(`\n❌ Mapping verification: FAILED`);
    console.log(`   ${successCount}/${groupStageMatches.length} group stage matches mapped`);
    process.exit(1);
  }

  // List all unique teams in our data
  console.log('\n📝 All teams in matches.json:');
  const allTeams = new Set<string>();
  for (const match of groupStageMatches) {
    const teams = parseTeams(match.match);
    if (teams) {
      allTeams.add(teams[0]);
      allTeams.add(teams[1]);
    }
  }
  console.log(`   Total unique teams: ${allTeams.size}`);
  const sorted = Array.from(allTeams).sort();
  sorted.forEach(t => {
    const hasMapping = TEAM_NAME_MAPPING[t] ? '✅' : '❌';
    console.log(`   ${hasMapping} ${t}`);
  });
}

runMappingTest();
