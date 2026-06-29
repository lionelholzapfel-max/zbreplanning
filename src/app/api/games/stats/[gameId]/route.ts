import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';

type PeriodFilter = '7d' | 'month' | 'all';

interface RouteContext {
  params: Promise<{ gameId: string }>;
}

interface PlayerStats {
  userId: string;
  userName: string;
  memberSlug: string;
  stars: number;
  gamesPlayed: number;
  ratio: number;
}

interface GameStats {
  game: { id: string; name: string; default_type: string };
  king: PlayerStats | null;
  leaderboard: PlayerStats[];
  totalSessions: number;
  individualSessions: number;
  teamSessions: number;
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

// GET /api/games/stats/[gameId] - Stats for a specific game
export async function GET(request: NextRequest, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { gameId } = await context.params;

  const searchParams = request.nextUrl.searchParams;
  const period = (searchParams.get('period') as PeriodFilter) || 'all';
  const validPeriods: PeriodFilter[] = ['7d', 'month', 'all'];
  const periodFilter: PeriodFilter = validPeriods.includes(period) ? period : 'all';

  const periodStartDate = getPeriodStartDate(periodFilter);

  const supabase = getSupabaseAdmin();

  // Fetch game
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('id, name, default_type')
    .eq('id', gameId)
    .single();

  if (gameError || !game) {
    return NextResponse.json({ error: 'Jeu non trouvé' }, { status: 404 });
  }

  // Fetch all sessions for this game (with optional date filter)
  let sessionsQuery = supabase
    .from('game_sessions')
    .select('id, session_type, winner_id, played_at')
    .eq('game_id', gameId);

  if (periodStartDate) {
    sessionsQuery = sessionsQuery.gte('played_at', periodStartDate.toISOString().split('T')[0]);
  }

  const { data: sessions, error: sessionsError } = await sessionsQuery;

  if (sessionsError) {
    throw new Error(`Erreur Supabase: ${sessionsError.message}`);
  }

  // Fetch participants
  const sessionIds = sessions?.map((s) => s.id) || [];

  // Supabase returns relations as arrays
  let participants: { user_id: string; session_id: string; user: { id: string; member_name: string; member_slug: string }[] }[] = [];

  if (sessionIds.length > 0) {
    const { data: participantsData, error: participantsError } = await supabase
      .from('game_participants')
      .select('user_id, session_id, user:users(id, member_name, member_slug)')
      .in('session_id', sessionIds);

    if (participantsError) {
      throw new Error(`Erreur Supabase: ${participantsError.message}`);
    }
    participants = (participantsData || []) as typeof participants;
  }

  // Build session map
  const sessionMap = new Map(sessions?.map((s) => [s.id, s]) || []);

  // Calculate stats per player (only individual sessions)
  const playerStats: { [userId: string]: { userName: string; memberSlug: string; stars: number; gamesPlayed: number } } = {};

  for (const participant of participants) {
    const session = sessionMap.get(participant.session_id);
    const userInfo = participant.user?.[0];

    if (!session || session.session_type !== 'individual' || !userInfo) continue;

    const visitorId = participant.user_id;

    if (!playerStats[visitorId]) {
      playerStats[visitorId] = {
        userName: userInfo.member_name,
        memberSlug: userInfo.member_slug,
        stars: 0,
        gamesPlayed: 0,
      };
    }

    playerStats[visitorId].gamesPlayed += 1;
    if (session.winner_id === visitorId) {
      playerStats[visitorId].stars += 1;
    }
  }

  // Build leaderboard
  const leaderboard: PlayerStats[] = Object.entries(playerStats)
    .map(([visitorId, data]) => ({
      userId: visitorId,
      userName: data.userName,
      memberSlug: data.memberSlug,
      stars: data.stars,
      gamesPlayed: data.gamesPlayed,
      ratio: data.gamesPlayed > 0 ? Math.round((data.stars / data.gamesPlayed) * 1000) / 1000 : 0,
    }))
    .sort((a, b) => b.stars - a.stars || b.ratio - a.ratio);

  // King is the first in leaderboard (if any)
  const king = leaderboard.length > 0 && leaderboard[0].stars > 0 ? leaderboard[0] : null;

  // Count sessions by type
  const totalSessions = sessions?.length || 0;
  const individualSessions = sessions?.filter((s) => s.session_type === 'individual').length || 0;
  const teamSessions = sessions?.filter((s) => s.session_type === 'team').length || 0;

  const stats: GameStats = {
    game,
    king,
    leaderboard,
    totalSessions,
    individualSessions,
    teamSessions,
    periodFilter,
  };

  return NextResponse.json(stats);
}
