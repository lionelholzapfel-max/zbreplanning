import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import { replayAllGames, EloGameSession, BASE_ELO } from '@/lib/elo';

type PeriodFilter = '7d' | 'month' | 'all';

interface StarsByGame {
  [gameId: string]: {
    gameName: string;
    stars: { [userId: string]: number };
    king: { userId: string; userName: string; stars: number } | null;
  };
}

interface UserRatio {
  userId: string;
  userName: string;
  memberSlug: string;
  gamesPlayed: number;
  wins: number;
  ratio: number;
}

interface EloLeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  memberSlug: string;
  elo: number;
  stars: number;
  ratio: number;
  gamesPlayed: number;
}

interface GlobalStats {
  totalStars: { [userId: string]: { userName: string; stars: number } };
  starsByGame: StarsByGame;
  kings: { gameId: string; gameName: string; userId: string; userName: string; stars: number }[];
  ratios: UserRatio[];
  topWinner: { userId: string; userName: string; totalWins: number } | null;
  eloLeaderboard: EloLeaderboardEntry[];
  periodFilter: PeriodFilter;
}

/**
 * Calcule la date de début pour un filtre temporel
 */
function getPeriodStartDate(period: PeriodFilter): Date | null {
  if (period === 'all') return null;

  const now = new Date();

  if (period === '7d') {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  return null;
}

// GET /api/games/stats - Global leaderboard stats
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const period = (searchParams.get('period') as PeriodFilter) || 'all';
  const validPeriods: PeriodFilter[] = ['7d', 'month', 'all'];
  const periodFilter: PeriodFilter = validPeriods.includes(period) ? period : 'all';

  const periodStartDate = getPeriodStartDate(periodFilter);

  const supabase = getSupabaseAdmin();

  // Fetch all games
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id, name')
    .order('name');

  if (gamesError) {
    throw new Error(`Erreur Supabase: ${gamesError.message}`);
  }

  // Fetch all individual sessions with winners (with optional date filter)
  let sessionsQuery = supabase
    .from('game_sessions')
    .select(`
      id,
      game_id,
      session_type,
      winner_id,
      played_at,
      winner:users!game_sessions_winner_id_fkey(id, member_name, member_slug)
    `)
    .eq('session_type', 'individual')
    .not('winner_id', 'is', null);

  if (periodStartDate) {
    sessionsQuery = sessionsQuery.gte('played_at', periodStartDate.toISOString().split('T')[0]);
  }

  const { data: sessions, error: sessionsError } = await sessionsQuery;

  if (sessionsError) {
    throw new Error(`Erreur Supabase: ${sessionsError.message}`);
  }

  // Fetch all participants for ratio calculation (with optional date filter)
  const participantsQuery = supabase
    .from('game_participants')
    .select(`
      user_id,
      session:game_sessions!inner(id, session_type, winner_id, played_at),
      user:users(id, member_name, member_slug)
    `);

  const { data: allParticipants, error: participantsError } = await participantsQuery;

  if (participantsError) {
    throw new Error(`Erreur Supabase: ${participantsError.message}`);
  }

  // Filter participants by period (Supabase returns relations as arrays)
  const filteredParticipants = (allParticipants || []).filter((p) => {
    // supabase-js returns to-one embeds as an object (not an array)
    const session = p.session as unknown as { played_at: string } | null;
    if (!session) return false;
    if (!periodStartDate) return true;
    return new Date(session.played_at) >= periodStartDate;
  });

  // Fetch users for names
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, member_name, member_slug');

  if (usersError) {
    throw new Error(`Erreur Supabase: ${usersError.message}`);
  }

  const userMap = new Map(users?.map((u) => [u.id, u]) || []);
  const gameMap = new Map(games?.map((g) => [g.id, g.name]) || []);

  // Calculate stars by game
  const starsByGame: StarsByGame = {};

  for (const game of games || []) {
    starsByGame[game.id] = {
      gameName: game.name,
      stars: {},
      king: null,
    };
  }

  // Count stars (wins in individual games)
  const totalStars: { [userId: string]: { userName: string; stars: number } } = {};

  for (const session of sessions || []) {
    const winnerId = session.winner_id;
    const gameId = session.game_id;
    // supabase-js returns to-one embeds as an object (not an array)
    const winner = session.winner as unknown as { id: string; member_name: string } | null;

    if (!winnerId || !winner) continue;

    // Per-game stars
    if (!starsByGame[gameId]) {
      starsByGame[gameId] = {
        gameName: gameMap.get(gameId) || 'Unknown',
        stars: {},
        king: null,
      };
    }
    starsByGame[gameId].stars[winnerId] = (starsByGame[gameId].stars[winnerId] || 0) + 1;

    // Total stars
    if (!totalStars[winnerId]) {
      totalStars[winnerId] = { userName: winner.member_name, stars: 0 };
    }
    totalStars[winnerId].stars += 1;
  }

  // Calculate kings (most stars per game)
  const kings: { gameId: string; gameName: string; userId: string; userName: string; stars: number }[] = [];

  for (const [gameId, gameData] of Object.entries(starsByGame)) {
    let maxStars = 0;
    let kingId: string | null = null;

    for (const [userId, stars] of Object.entries(gameData.stars)) {
      if (stars > maxStars) {
        maxStars = stars;
        kingId = userId;
      }
    }

    if (kingId && maxStars > 0) {
      const kingUser = userMap.get(kingId);
      gameData.king = {
        userId: kingId,
        userName: kingUser?.member_name || 'Unknown',
        stars: maxStars,
      };
      kings.push({
        gameId,
        gameName: gameData.gameName,
        userId: kingId,
        userName: kingUser?.member_name || 'Unknown',
        stars: maxStars,
      });
    }
  }

  // Calculate ratios (only individual games)
  const ratioData: { [userId: string]: { gamesPlayed: number; wins: number; userName: string; memberSlug: string } } = {};

  for (const participant of filteredParticipants) {
    // supabase-js returns to-one embeds as objects (not arrays)
    const session = participant.session as unknown as { id: string; session_type: string; winner_id: string | null } | null;
    const userInfo = participant.user as unknown as { id: string; member_name: string; member_slug: string } | null;

    if (!session || session.session_type !== 'individual' || !userInfo) continue;

    const visitorId = participant.user_id;

    if (!ratioData[visitorId]) {
      ratioData[visitorId] = {
        gamesPlayed: 0,
        wins: 0,
        userName: userInfo.member_name,
        memberSlug: userInfo.member_slug,
      };
    }

    ratioData[visitorId].gamesPlayed += 1;
    if (session.winner_id === visitorId) {
      ratioData[visitorId].wins += 1;
    }
  }

  const ratios: UserRatio[] = Object.entries(ratioData)
    .map(([visitorId, data]) => ({
      userId: visitorId,
      userName: data.userName,
      memberSlug: data.memberSlug,
      gamesPlayed: data.gamesPlayed,
      wins: data.wins,
      ratio: data.gamesPlayed > 0 ? Math.round((data.wins / data.gamesPlayed) * 1000) / 1000 : 0,
    }))
    .sort((a, b) => b.ratio - a.ratio || b.wins - a.wins);

  // Top winner (most total wins)
  let topWinner: { userId: string; userName: string; totalWins: number } | null = null;
  let maxWins = 0;

  for (const [visitorId, data] of Object.entries(totalStars)) {
    if (data.stars > maxWins) {
      maxWins = data.stars;
      topWinner = { userId: visitorId, userName: data.userName, totalWins: data.stars };
    }
  }

  // Calculate ELO leaderboard (based on filtered period)
  // Fetch all individual sessions with participants for ELO calculation
  let eloSessionsQuery = supabase
    .from('game_sessions')
    .select(`
      id,
      winner_id,
      played_at,
      created_at,
      participants:game_participants(user_id)
    `)
    .eq('session_type', 'individual')
    .not('winner_id', 'is', null)
    .order('played_at', { ascending: true })
    .order('created_at', { ascending: true });

  if (periodStartDate) {
    eloSessionsQuery = eloSessionsQuery.gte('played_at', periodStartDate.toISOString().split('T')[0]);
  }

  const { data: eloSessionsData, error: eloSessionsError } = await eloSessionsQuery;

  if (eloSessionsError) {
    throw new Error(`Erreur Supabase: ${eloSessionsError.message}`);
  }

  // Prepare sessions for ELO replay
  const eloSessions: EloGameSession[] = (eloSessionsData || []).map((s) => ({
    sessionId: s.id,
    winnerId: s.winner_id!,
    participantIds: (s.participants as { user_id: string }[]).map((p) => p.user_id),
    playedAt: new Date(s.played_at),
  }));

  // Replay all games to get current ELO ratings
  const eloRatings = replayAllGames(eloSessions);

  // Build ELO leaderboard
  const eloLeaderboard: EloLeaderboardEntry[] = [];

  // Include all players who have participated in the period
  const allPlayerIds = new Set<string>();
  for (const session of eloSessions) {
    for (const pid of session.participantIds) {
      allPlayerIds.add(pid);
    }
  }

  for (const visitorId of allPlayerIds) {
    const playerUser = userMap.get(visitorId);
    const playerRatio = ratioData[visitorId];
    const playerStars = totalStars[visitorId];

    eloLeaderboard.push({
      rank: 0, // Will be set after sorting
      userId: visitorId,
      userName: playerUser?.member_name || 'Unknown',
      memberSlug: playerUser?.member_slug || '',
      elo: eloRatings.get(visitorId) || BASE_ELO,
      stars: playerStars?.stars || 0,
      ratio: playerRatio?.gamesPlayed > 0 ? Math.round((playerRatio.wins / playerRatio.gamesPlayed) * 1000) / 1000 : 0,
      gamesPlayed: playerRatio?.gamesPlayed || 0,
    });
  }

  // Sort by ELO descending
  eloLeaderboard.sort((a, b) => b.elo - a.elo || b.stars - a.stars);

  // Assign ranks
  for (let i = 0; i < eloLeaderboard.length; i++) {
    eloLeaderboard[i].rank = i + 1;
  }

  const stats: GlobalStats = {
    totalStars,
    starsByGame,
    kings,
    ratios,
    topWinner,
    eloLeaderboard,
    periodFilter,
  };

  return NextResponse.json(stats);
}
