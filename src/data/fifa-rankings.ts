// FIFA Rankings as of May 2025 (approximate for World Cup 2026)
// Lower number = better ranking

export const FIFA_RANKINGS: Record<string, number> = {
  // Top 10
  'Argentine': 1,
  'France': 2,
  'Belgique': 3,
  'Angleterre': 4,
  'Brésil': 5,
  'Portugal': 6,
  'Pays-Bas': 7,
  'Espagne': 8,
  'Italie': 9,
  'Croatie': 10,

  // 11-20
  'USA': 11,
  'États-Unis': 11,
  'Mexique': 12,
  'Maroc': 13,
  'Suisse': 14,
  'Allemagne': 15,
  'Colombie': 16,
  'Uruguay': 17,
  'Japon': 18,
  'Sénégal': 19,
  'Danemark': 20,

  // 21-30
  'Corée du Sud': 21,
  'Turquie': 22,
  'Autriche': 23,
  'Iran': 24,
  'Ukraine': 25,
  'Pologne': 26,
  'Équateur': 27,
  'Écosse': 28,
  'Serbie': 29,
  'Nigeria': 30,

  // 31-40
  'Australie': 31,
  'Égypte': 32,
  'Tunisie': 33,
  'Cameroun': 34,
  'Canada': 35,
  'Côte d\'Ivoire': 36,
  'Algérie': 37,
  'Grèce': 38,
  'Pérou': 39,
  'Chili': 40,

  // 41-50
  'Paraguay': 41,
  'Arabie Saoudite': 42,
  'Qatar': 43,
  'Slovénie': 44,
  'Ghana': 45,
  'Venezuela': 46,
  'Irlande': 47,
  'Mali': 48,
  'Bosnie-Herzégovine': 49,
  'République tchèque': 50,

  // 51-60
  'Afrique du Sud': 51,
  'Panama': 52,
  'Costa Rica': 53,
  'Honduras': 54,
  'Jamaïque': 55,
  'Ouganda': 56,
  'Bahreïn': 57,
  'Irak': 58,
  'Ouzbékistan': 59,
  'Chine': 60,

  // 61+
  'Nouvelle-Zélande': 61,
  'Haïti': 70,
  'Corée du Nord': 75,

  // Placeholder for unknown teams (knockout stage placeholders)
  'Vainqueur': 999,
  'Perdant': 999,
};

export function getFifaRanking(teamName: string): number {
  // Try exact match first
  if (FIFA_RANKINGS[teamName]) {
    return FIFA_RANKINGS[teamName];
  }

  // Try to find a partial match
  for (const [key, rank] of Object.entries(FIFA_RANKINGS)) {
    if (teamName.includes(key) || key.includes(teamName)) {
      return rank;
    }
  }

  // Default ranking for unknown teams
  return 100;
}

export function isOutsider(team1: string, team2: string, winner: string): boolean {
  const rank1 = getFifaRanking(team1);
  const rank2 = getFifaRanking(team2);

  // The outsider is the team with the worse (higher) ranking
  if (rank1 === rank2) return false;

  const outsiderTeam = rank1 > rank2 ? team1 : team2;
  return winner === outsiderTeam;
}
