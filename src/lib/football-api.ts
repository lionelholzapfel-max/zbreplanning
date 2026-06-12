/**
 * Football-Data.org API Integration
 * Free tier: 10 requests/minute, World Cup included
 * https://www.football-data.org/documentation/api
 */

// World Cup 2026 competition code
const WORLD_CUP_CODE = 'WC';
const API_BASE = 'https://api.football-data.org/v4';

// Team name mapping: Our French names → API English names
export const TEAM_NAME_MAPPING: Record<string, string[]> = {
  // Host countries
  'USA': ['United States', 'USA', 'United States of America'],
  'Mexique': ['Mexico'],
  'Canada': ['Canada'],

  // Europe
  'France': ['France'],
  'Angleterre': ['England'],
  'Espagne': ['Spain'],
  'Allemagne': ['Germany'],
  'Portugal': ['Portugal'],
  'Belgique': ['Belgium'],
  'Pays-Bas': ['Netherlands', 'Holland'],
  'Italie': ['Italy'],
  'Croatie': ['Croatia'],
  'Suisse': ['Switzerland'],
  'Danemark': ['Denmark'],
  'Autriche': ['Austria'],
  'Ukraine': ['Ukraine'],
  'Serbie': ['Serbia'],
  'Pologne': ['Poland'],
  'Turquie': ['Turkey', 'Türkiye'],
  'Écosse': ['Scotland'],
  'Slovénie': ['Slovenia'],
  'Hongrie': ['Hungary'],
  'République tchèque': ['Czech Republic', 'Czechia'],
  'Galles': ['Wales'],
  'Albanie': ['Albania'],

  // South America
  'Argentine': ['Argentina'],
  'Brésil': ['Brazil'],
  'Uruguay': ['Uruguay'],
  'Colombie': ['Colombia'],
  'Équateur': ['Ecuador'],
  'Paraguay': ['Paraguay'],
  'Chili': ['Chile'],
  'Venezuela': ['Venezuela'],
  'Pérou': ['Peru'],
  'Bolivie': ['Bolivia'],

  // Africa
  'Maroc': ['Morocco'],
  'Sénégal': ['Senegal'],
  'Nigeria': ['Nigeria'],
  'Égypte': ['Egypt'],
  'Cameroun': ['Cameroon'],
  'Algérie': ['Algeria'],
  "Côte d'Ivoire": ['Ivory Coast', "Côte d'Ivoire", 'Cote d Ivoire'],
  'Afrique du Sud': ['South Africa'],
  'Mali': ['Mali'],
  'RD Congo': ['DR Congo', 'Congo DR', 'Democratic Republic of Congo'],

  // Asia
  'Japon': ['Japan'],
  'Corée du Sud': ['South Korea', 'Korea Republic'],
  'Australie': ['Australia'],
  'Iran': ['Iran'],
  'Arabie Saoudite': ['Saudi Arabia'],
  'Qatar': ['Qatar'],
  'Indonésie': ['Indonesia'],

  // CONCACAF
  'Panama': ['Panama'],
  'Costa Rica': ['Costa Rica'],
  'Jamaïque': ['Jamaica'],
  'Honduras': ['Honduras'],
  'Haïti': ['Haiti'],
  'Curaçao': ['Curaçao', 'Curacao'],

  // Oceania
  'Nouvelle-Zélande': ['New Zealand'],

  // Additional Europe
  'Bosnie-Herzégovine': ['Bosnia and Herzegovina', 'Bosnia-Herzegovina', 'Bosnia'],
  'Suède': ['Sweden'],
  'Norvège': ['Norway'],
  'Grèce': ['Greece'],
  'Irlande': ['Ireland', 'Republic of Ireland'],

  // Additional Africa
  'Tunisie': ['Tunisia'],
  'Ghana': ['Ghana'],
  'Cap-Vert': ['Cape Verde', 'Cabo Verde'],

  // Additional Asia
  'Irak': ['Iraq'],
  'Jordanie': ['Jordan'],
  'Ouzbékistan': ['Uzbekistan'],
  'Bahreïn': ['Bahrain'],
  'Ouganda': ['Uganda'],
  'Corée du Nord': ['North Korea', 'Korea DPR'],
};

// Reverse mapping for API → Our names
const API_TO_OUR_NAMES: Record<string, string> = {};
for (const [ourName, apiNames] of Object.entries(TEAM_NAME_MAPPING)) {
  for (const apiName of apiNames) {
    API_TO_OUR_NAMES[apiName.toLowerCase()] = ourName;
  }
}

/**
 * Convert API team name to our French name
 */
export function apiTeamNameToOurs(apiName: string): string | null {
  const lower = apiName.toLowerCase();
  return API_TO_OUR_NAMES[lower] || null;
}

/**
 * Check if two team names match (handles variants)
 */
export function teamsMatch(ourTeam: string, apiTeam: string): boolean {
  const variants = TEAM_NAME_MAPPING[ourTeam];
  if (!variants) return false;
  return variants.some(v => v.toLowerCase() === apiTeam.toLowerCase());
}

export interface ApiMatch {
  id: number;
  utcDate: string;
  status: 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'SUSPENDED' | 'POSTPONED' | 'CANCELLED' | 'AWARDED';
  matchday: number;
  stage: string;
  group: string | null;
  homeTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
  };
  score: {
    winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
    duration: 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT';
    fullTime: {
      home: number | null;
      away: number | null;
    };
    halfTime: {
      home: number | null;
      away: number | null;
    };
    extraTime?: {
      home: number | null;
      away: number | null;
    };
    penalties?: {
      home: number | null;
      away: number | null;
    };
  };
}

export interface ApiResponse {
  matches: ApiMatch[];
  resultSet: {
    count: number;
    competitions: string;
    first: string;
    last: string;
    played: number;
  };
}

/**
 * Fetch World Cup matches from football-data.org
 */
export async function fetchWorldCupMatches(options?: {
  status?: 'SCHEDULED' | 'FINISHED' | 'IN_PLAY';
  dateFrom?: string;
  dateTo?: string;
}): Promise<ApiMatch[]> {
  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) {
    throw new Error('FOOTBALL_API_KEY not configured');
  }

  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  if (options?.dateFrom) params.set('dateFrom', options.dateFrom);
  if (options?.dateTo) params.set('dateTo', options.dateTo);

  const url = `${API_BASE}/competitions/${WORLD_CUP_CODE}/matches${params.toString() ? '?' + params.toString() : ''}`;

  const response = await fetch(url, {
    headers: {
      'X-Auth-Token': apiKey,
    },
    next: { revalidate: 0 }, // No caching
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Football API error ${response.status}: ${errorText}`);
  }

  const data: ApiResponse = await response.json();
  return data.matches;
}

/**
 * Fetch a single match by ID
 */
export async function fetchMatch(matchId: number): Promise<ApiMatch> {
  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) {
    throw new Error('FOOTBALL_API_KEY not configured');
  }

  const response = await fetch(`${API_BASE}/matches/${matchId}`, {
    headers: {
      'X-Auth-Token': apiKey,
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`Football API error ${response.status}`);
  }

  return response.json();
}

/**
 * Map an API match to our match by date and teams
 */
export function findOurMatchId(
  apiMatch: ApiMatch,
  ourMatches: Array<{ id: number; date: string; time: string; match: string }>
): number | null {
  // Parse API date (UTC)
  const apiDate = new Date(apiMatch.utcDate);
  const apiDateStr = apiDate.toISOString().split('T')[0]; // YYYY-MM-DD

  // Parse teams from our match string
  for (const ourMatch of ourMatches) {
    // Check date matches (with 1 day tolerance for timezone issues)
    const ourDate = new Date(ourMatch.date + 'T00:00:00Z');
    const diffDays = Math.abs(apiDate.getTime() - ourDate.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 1) continue;

    // Parse our teams
    const parts = ourMatch.match.split(' - ');
    if (parts.length !== 2) continue;
    const [ourHome, ourAway] = parts.map(t => t.trim());

    // Check if teams match
    const homeMatch = teamsMatch(ourHome, apiMatch.homeTeam.name) ||
                      teamsMatch(ourHome, apiMatch.homeTeam.shortName);
    const awayMatch = teamsMatch(ourAway, apiMatch.awayTeam.name) ||
                      teamsMatch(ourAway, apiMatch.awayTeam.shortName);

    if (homeMatch && awayMatch) {
      return ourMatch.id;
    }
  }

  return null;
}

/**
 * Score result for a match
 */
export interface MatchScore {
  home90: number;        // Score at 90 minutes
  away90: number;        // Score at 90 minutes
  homeFinal: number;     // Final score (including extra time)
  awayFinal: number;     // Final score (including extra time)
  qualifier?: 'home' | 'away';  // Who qualified (knockout only)
  hadExtraTime: boolean;
  hadPenalties: boolean;
}

/**
 * Get match score from API match (handles extra time and penalties)
 * Returns 90-minute score for predictions + qualifier for knockout
 */
export function getFinalScore(apiMatch: ApiMatch): MatchScore | null {
  if (apiMatch.status !== 'FINISHED') return null;

  const ft = apiMatch.score.fullTime;
  if (ft.home === null || ft.away === null) return null;

  const duration = apiMatch.score.duration;
  const hadExtraTime = duration === 'EXTRA_TIME' || duration === 'PENALTY_SHOOTOUT';
  const hadPenalties = duration === 'PENALTY_SHOOTOUT';

  // Calculate 90-minute score
  let home90 = ft.home;
  let away90 = ft.away;

  if (hadExtraTime && apiMatch.score.extraTime) {
    const et = apiMatch.score.extraTime;
    if (et.home !== null && et.away !== null) {
      // Subtract extra time goals to get 90-minute score
      home90 = ft.home - et.home;
      away90 = ft.away - et.away;
    }
  }

  // Determine qualifier for knockout matches
  let qualifier: 'home' | 'away' | undefined;

  if (apiMatch.score.winner === 'HOME_TEAM') {
    qualifier = 'home';
  } else if (apiMatch.score.winner === 'AWAY_TEAM') {
    qualifier = 'away';
  } else if (hadPenalties && apiMatch.score.penalties) {
    // In penalty shootout, winner from penalties
    const pens = apiMatch.score.penalties;
    if (pens.home !== null && pens.away !== null) {
      qualifier = pens.home > pens.away ? 'home' : 'away';
    }
  }
  // Note: If score.winner is 'DRAW' and no penalties, it's a group stage match

  return {
    home90,
    away90,
    homeFinal: ft.home,
    awayFinal: ft.away,
    qualifier,
    hadExtraTime,
    hadPenalties,
  };
}

/**
 * Check if API is reachable and key is valid
 */
export async function testApiConnection(): Promise<{
  success: boolean;
  message: string;
  matchCount?: number;
}> {
  try {
    const matches = await fetchWorldCupMatches();
    return {
      success: true,
      message: `Connected! Found ${matches.length} World Cup 2026 matches`,
      matchCount: matches.length,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
