/**
 * Module ELO pur pour Zbrétoile
 *
 * 100% pur : aucun import Supabase, aucun appel réseau.
 * Prend des données en entrée, rend des nombres.
 */

// Constantes ELO
export const BASE_ELO = 1200;
export const K_FACTOR = 32;

/**
 * Session de jeu pour le calcul ELO
 */
export interface EloGameSession {
  sessionId: string; // pour debug/traçabilité
  winnerId: string;
  participantIds: string[]; // inclut le gagnant
  playedAt: Date;
}

/**
 * Calcule la probabilité que le joueur A gagne contre B
 * Formule : P(A) = 1 / (1 + 10^((ratingB - ratingA) / 400))
 */
export function calculateWinProbability(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calcule les nouveaux ratings après un duel 1v1
 * @returns { winnerNew, loserNew } - ratings arrondis
 */
export function calculate1v1Elo(
  winnerRating: number,
  loserRating: number,
  kFactor: number = K_FACTOR
): { winnerNew: number; loserNew: number } {
  const expectedWinner = calculateWinProbability(winnerRating, loserRating);
  const expectedLoser = 1 - expectedWinner;

  // Gagnant : résultat réel = 1
  const winnerNew = Math.round(winnerRating + kFactor * (1 - expectedWinner));
  // Perdant : résultat réel = 0
  const loserNew = Math.round(loserRating + kFactor * (0 - expectedLoser));

  return { winnerNew, loserNew };
}

/**
 * Calcule les nouveaux ratings après une partie de groupe (1 gagnant vs N-1 perdants)
 *
 * Le gagnant affronte chaque perdant en duel virtuel avec K/(N-1).
 * Ainsi le gain total est borné (~16 si tous égaux, comme un 1v1).
 * Les perdants entre eux ne s'affrontent pas.
 *
 * @param winnerRating - ELO actuel du gagnant
 * @param loserRatings - ELO actuels des perdants (tableau)
 * @param kFactor - K-factor de base (défaut 32)
 * @returns { winnerNew, losersNew } - nouveaux ratings arrondis
 */
export function calculateGroupElo(
  winnerRating: number,
  loserRatings: number[],
  kFactor: number = K_FACTOR
): { winnerNew: number; losersNew: number[] } {
  const numLosers = loserRatings.length;

  if (numLosers === 0) {
    return { winnerNew: winnerRating, losersNew: [] };
  }

  // K effectif par duel = K / (N-1) où N = nombre total de participants
  const kEffective = kFactor / numLosers;

  let winnerDelta = 0;
  const losersNew: number[] = [];

  for (const loserRating of loserRatings) {
    const expectedWinner = calculateWinProbability(winnerRating, loserRating);
    const expectedLoser = 1 - expectedWinner;

    // Delta gagnant pour ce duel
    winnerDelta += kEffective * (1 - expectedWinner);

    // Nouveau rating perdant (un seul duel contre le gagnant)
    const loserDelta = kEffective * (0 - expectedLoser);
    losersNew.push(Math.round(loserRating + loserDelta));
  }

  const winnerNew = Math.round(winnerRating + winnerDelta);

  return { winnerNew, losersNew };
}

/**
 * Rejoue TOUTES les parties individuelles dans l'ordre chronologique
 * pour calculer les ELO actuels de tous les joueurs.
 *
 * @param sessions - Parties triées par date croissante (plus ancienne en premier)
 * @returns Map<userId, eloFinal>
 */
export function replayAllGames(sessions: EloGameSession[]): Map<string, number> {
  const ratings = new Map<string, number>();

  // Trier par date croissante (plus ancienne en premier)
  const sortedSessions = [...sessions].sort(
    (a, b) => a.playedAt.getTime() - b.playedAt.getTime()
  );

  for (const session of sortedSessions) {
    const { winnerId, participantIds } = session;

    // Garde-fou : une session dont le gagnant n'est pas un participant est
    // corrompue — on l'ignore pour ne pas propager un ELO NaN à tout le classement.
    if (!participantIds.includes(winnerId)) {
      continue;
    }

    // Initialiser les joueurs qu'on n'a jamais vus
    for (const pid of participantIds) {
      if (!ratings.has(pid)) {
        ratings.set(pid, BASE_ELO);
      }
    }

    // Identifier les perdants
    const loserIds = participantIds.filter((pid) => pid !== winnerId);

    if (loserIds.length === 0) {
      // Pas de perdants = pas de changement ELO
      continue;
    }

    const winnerRating = ratings.get(winnerId)!;
    const loserRatings = loserIds.map((lid) => ratings.get(lid)!);

    if (loserIds.length === 1) {
      // Partie 1v1
      const { winnerNew, loserNew } = calculate1v1Elo(winnerRating, loserRatings[0]);
      ratings.set(winnerId, winnerNew);
      ratings.set(loserIds[0], loserNew);
    } else {
      // Partie de groupe
      const { winnerNew, losersNew } = calculateGroupElo(winnerRating, loserRatings);
      ratings.set(winnerId, winnerNew);
      for (let i = 0; i < loserIds.length; i++) {
        ratings.set(loserIds[i], losersNew[i]);
      }
    }
  }

  return ratings;
}

/**
 * Calcule le delta ELO pour une partie donnée
 * Utile pour le flux d'activité
 *
 * @param winnerRatingBefore - ELO du gagnant avant la partie
 * @param loserRatingsBefore - ELO des perdants avant la partie
 * @returns Delta ELO du gagnant (positif)
 */
export function calculateEloDelta(
  winnerRatingBefore: number,
  loserRatingsBefore: number[]
): number {
  if (loserRatingsBefore.length === 0) {
    return 0;
  }

  if (loserRatingsBefore.length === 1) {
    const { winnerNew } = calculate1v1Elo(winnerRatingBefore, loserRatingsBefore[0]);
    return winnerNew - winnerRatingBefore;
  }

  const { winnerNew } = calculateGroupElo(winnerRatingBefore, loserRatingsBefore);
  return winnerNew - winnerRatingBefore;
}
