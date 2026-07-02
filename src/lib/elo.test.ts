/**
 * Tests unitaires du module ELO
 *
 * Ces tests vérifient les calculs mathématiques purs,
 * sans aucune dépendance à la base de données.
 */
import { describe, it, expect } from 'vitest';
import {
  BASE_ELO,
  K_FACTOR,
  calculateWinProbability,
  calculate1v1Elo,
  calculateGroupElo,
  replayAllGames,
  calculateEloDelta,
  EloGameSession,
} from './elo';

describe('Module ELO', () => {
  describe('Constantes', () => {
    it('BASE_ELO = 1200', () => {
      expect(BASE_ELO).toBe(1200);
    });

    it('K_FACTOR = 32', () => {
      expect(K_FACTOR).toBe(32);
    });
  });

  describe('calculateWinProbability', () => {
    it('retourne 0.5 pour deux joueurs de même rating', () => {
      const prob = calculateWinProbability(1200, 1200);
      expect(prob).toBeCloseTo(0.5, 5);
    });

    it('retourne >0.5 pour le joueur avec rating supérieur', () => {
      const prob = calculateWinProbability(1400, 1200);
      expect(prob).toBeGreaterThan(0.5);
      // Avec 200 points d'écart : P = 1/(1+10^(-0.5)) ≈ 0.759
      expect(prob).toBeCloseTo(0.759, 2);
    });

    it('retourne <0.5 pour le joueur avec rating inférieur', () => {
      const prob = calculateWinProbability(1200, 1400);
      expect(prob).toBeLessThan(0.5);
      expect(prob).toBeCloseTo(0.241, 2);
    });

    it('probabilités complémentaires', () => {
      const probA = calculateWinProbability(1300, 1200);
      const probB = calculateWinProbability(1200, 1300);
      expect(probA + probB).toBeCloseTo(1, 5);
    });
  });

  describe('calculate1v1Elo', () => {
    it('T1: Lionel(1200) bat Ramzi(1200) → Lionel=1216, Ramzi=1184', () => {
      const { winnerNew, loserNew } = calculate1v1Elo(1200, 1200);
      expect(winnerNew).toBe(1216);
      expect(loserNew).toBe(1184);
    });

    it('T2: Ramzi(1184) bat Lionel(1216) → upset, Ramzi gagne >16', () => {
      // P(Ramzi gagne) = 1/(1+10^((1216-1184)/400)) = 1/(1+10^0.08) ≈ 0.4541
      // Ramzi: 1184 + 32*(1-0.4541) = 1184 + 17.47 ≈ 1201
      // Lionel: 1216 + 32*(0-0.5459) = 1216 - 17.47 ≈ 1199
      const { winnerNew, loserNew } = calculate1v1Elo(1184, 1216);
      expect(winnerNew).toBe(1201); // Ramzi
      expect(loserNew).toBe(1199); // Lionel
      // Vérifie que le gain est >16 (upset)
      expect(winnerNew - 1184).toBeGreaterThan(16);
    });

    it('le gain de l\'outsider est supérieur à 16', () => {
      // 1100 bat 1300 (outsider gagne)
      const { winnerNew, loserNew } = calculate1v1Elo(1100, 1300);
      const winnerGain = winnerNew - 1100;
      expect(winnerGain).toBeGreaterThan(16);
      // Et le favori perd autant
      const loserLoss = 1300 - loserNew;
      expect(loserLoss).toBeGreaterThan(16);
    });

    it('K-factor personnalisé', () => {
      const { winnerNew, loserNew } = calculate1v1Elo(1200, 1200, 16);
      expect(winnerNew).toBe(1208);
      expect(loserNew).toBe(1192);
    });
  });

  describe('calculateGroupElo', () => {
    it('T3: Uno 5 joueurs tous à 1200 → gagnant=1216, perdants=1196', () => {
      // 1 gagnant + 4 perdants, tous à 1200
      // K_eff = 32/4 = 8 par duel
      // Chaque duel: P=0.5, gain = 8*0.5 = 4
      // Gagnant: 4 duels * 4 = +16 → 1216
      // Chaque perdant: 1 duel * -4 = -4 → 1196
      const winnerRating = 1200;
      const loserRatings = [1200, 1200, 1200, 1200];

      const { winnerNew, losersNew } = calculateGroupElo(winnerRating, loserRatings);

      expect(winnerNew).toBe(1216);
      expect(losersNew).toHaveLength(4);
      for (const loserNew of losersNew) {
        expect(loserNew).toBe(1196);
      }
    });

    it('groupe vide retourne rating inchangé', () => {
      const { winnerNew, losersNew } = calculateGroupElo(1200, []);
      expect(winnerNew).toBe(1200);
      expect(losersNew).toHaveLength(0);
    });

    it('groupe de 2 (1 perdant) = équivalent 1v1 avec K/1', () => {
      // Avec 1 perdant, K_eff = K/1 = K
      // Donc c'est équivalent à un 1v1 standard
      const { winnerNew: groupWinner, losersNew } = calculateGroupElo(1200, [1200]);
      const { winnerNew: duelWinner, loserNew: duelLoser } = calculate1v1Elo(1200, 1200);

      expect(groupWinner).toBe(duelWinner);
      expect(losersNew[0]).toBe(duelLoser);
    });

    it('gain total du gagnant borné même avec beaucoup de perdants', () => {
      // 10 perdants tous à 1200
      const loserRatings = Array(10).fill(1200);
      const { winnerNew } = calculateGroupElo(1200, loserRatings);

      // K_eff = 32/10 = 3.2 par duel
      // 10 duels * 3.2 * 0.5 = 16 total (borné comme un 1v1)
      expect(winnerNew).toBe(1216);
    });

    it('outsider gagne plus en groupe aussi', () => {
      // Gagnant faible (1100) bat 3 perdants forts (1300)
      const { winnerNew, losersNew } = calculateGroupElo(1100, [1300, 1300, 1300]);

      // Le gagnant outsider devrait gagner plus que 16
      const winnerGain = winnerNew - 1100;
      expect(winnerGain).toBeGreaterThan(16);

      // Chaque perdant perd (proportionnellement au K_eff)
      for (const loserNew of losersNew) {
        expect(loserNew).toBeLessThan(1300);
      }
    });
  });

  describe('replayAllGames', () => {
    it('joueurs sans partie = BASE_ELO après initialisation', () => {
      const sessions: EloGameSession[] = [
        {
          sessionId: 's1',
          winnerId: 'A',
          participantIds: ['A', 'B'],
          playedAt: new Date('2024-01-01'),
        },
      ];

      const ratings = replayAllGames(sessions);

      expect(ratings.get('A')).toBe(1216);
      expect(ratings.get('B')).toBe(1184);
    });

    it('T4-like: ordre chronologique respecté', () => {
      // P1: A bat B (A:1216, B:1184)
      // P2: B bat A (B gagne en outsider)
      const sessions: EloGameSession[] = [
        {
          sessionId: 's1',
          winnerId: 'A',
          participantIds: ['A', 'B'],
          playedAt: new Date('2024-01-01'),
        },
        {
          sessionId: 's2',
          winnerId: 'B',
          participantIds: ['A', 'B'],
          playedAt: new Date('2024-01-02'),
        },
      ];

      const ratings = replayAllGames(sessions);

      // Après P1: A=1216, B=1184
      // Après P2: B bat A en outsider → B=1201, A=1199
      expect(ratings.get('B')).toBe(1201);
      expect(ratings.get('A')).toBe(1199);
    });

    it('parties en désordre sont triées correctement', () => {
      // Même fixture mais sessions dans le désordre
      const sessions: EloGameSession[] = [
        {
          sessionId: 's2',
          winnerId: 'B',
          participantIds: ['A', 'B'],
          playedAt: new Date('2024-01-02'), // Plus récent
        },
        {
          sessionId: 's1',
          winnerId: 'A',
          participantIds: ['A', 'B'],
          playedAt: new Date('2024-01-01'), // Plus ancien
        },
      ];

      const ratings = replayAllGames(sessions);

      // Doit donner le même résultat que le test précédent
      expect(ratings.get('B')).toBe(1201);
      expect(ratings.get('A')).toBe(1199);
    });

    it('replay séquence de 3 parties', () => {
      const sessions: EloGameSession[] = [
        {
          sessionId: 's1',
          winnerId: 'A',
          participantIds: ['A', 'B'],
          playedAt: new Date('2024-01-01'),
        },
        {
          sessionId: 's2',
          winnerId: 'A',
          participantIds: ['A', 'B'],
          playedAt: new Date('2024-01-02'),
        },
        {
          sessionId: 's3',
          winnerId: 'B',
          participantIds: ['A', 'B'],
          playedAt: new Date('2024-01-03'),
        },
      ];

      const ratings = replayAllGames(sessions);

      // P1: A=1216, B=1184
      // P2: A bat B(1184), A gagne ~18 (favori), B perd ~18
      //     A: 1216 + 18 = 1234, B: 1184 - 18 = 1166
      // P3: B(1166) bat A(1234), B gagne beaucoup (outsider)

      // Vérifions que B a remonté et A a baissé après P3
      expect(ratings.get('A')!).toBeLessThan(1234);
      expect(ratings.get('B')!).toBeGreaterThan(1166);
    });

    it('gère les parties de groupe dans le replay', () => {
      const sessions: EloGameSession[] = [
        {
          sessionId: 's1',
          winnerId: 'A',
          participantIds: ['A', 'B', 'C', 'D'],
          playedAt: new Date('2024-01-01'),
        },
      ];

      const ratings = replayAllGames(sessions);

      // 4 joueurs, K_eff = 32/3 ≈ 10.67
      // A gagne 3 duels * 10.67 * 0.5 = 16
      expect(ratings.get('A')).toBe(1216);
      // Chaque perdant perd 10.67 * 0.5 ≈ 5.33 → 1195
      expect(ratings.get('B')).toBe(1195);
      expect(ratings.get('C')).toBe(1195);
      expect(ratings.get('D')).toBe(1195);
    });

    it('sessions vides retourne Map vide', () => {
      const ratings = replayAllGames([]);
      expect(ratings.size).toBe(0);
    });

    it('gagnant seul participant = pas de changement', () => {
      const sessions: EloGameSession[] = [
        {
          sessionId: 's1',
          winnerId: 'A',
          participantIds: ['A'], // Seul participant
          playedAt: new Date('2024-01-01'),
        },
      ];

      const ratings = replayAllGames(sessions);
      expect(ratings.get('A')).toBe(1200); // Pas de perdant, pas de changement
    });
  });

  describe('calculateEloDelta', () => {
    it('delta 1v1 égaux = 16', () => {
      const delta = calculateEloDelta(1200, [1200]);
      expect(delta).toBe(16);
    });

    it('delta groupe 5 joueurs égaux = 16', () => {
      const delta = calculateEloDelta(1200, [1200, 1200, 1200, 1200]);
      expect(delta).toBe(16);
    });

    it('delta outsider > 16', () => {
      const delta = calculateEloDelta(1100, [1300]);
      expect(delta).toBeGreaterThan(16);
    });

    it('delta favori < 16', () => {
      const delta = calculateEloDelta(1300, [1100]);
      expect(delta).toBeLessThan(16);
    });

    it('delta sans perdants = 0', () => {
      const delta = calculateEloDelta(1200, []);
      expect(delta).toBe(0);
    });
  });
});
