import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import { calculateEloDelta, EloGameSession } from '@/lib/elo';

interface ActivityItem {
  sessionId: string;
  gameId: string;
  gameName: string;
  playedAt: string;
  sessionType: 'individual' | 'team';
  winnerId: string | null;
  winnerName: string | null;
  participants: { userId: string; userName: string }[];
  eloDelta: number | null; // null si team ou pas de gagnant
}

interface ActivityResponse {
  activities: ActivityItem[];
}

// GET /api/games/activity - Flux d'activité chronologique
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

  const supabase = getSupabaseAdmin();

  // Fetch recent sessions with all relations
  const { data: sessions, error: sessionsError } = await supabase
    .from('game_sessions')
    .select(`
      id,
      game_id,
      played_at,
      session_type,
      winner_id,
      created_at,
      game:games(id, name),
      winner:users!game_sessions_winner_id_fkey(id, member_name),
      participants:game_participants(
        user_id,
        user:users(id, member_name)
      )
    `)
    .order('played_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (sessionsError) {
    throw new Error(`Erreur Supabase: ${sessionsError.message}`);
  }

  // Pour calculer les deltas ELO, on doit rejouer l'historique
  // On récupère TOUTES les sessions individuelles pour le calcul ELO
  const { data: allIndividualSessions, error: allSessionsError } = await supabase
    .from('game_sessions')
    .select(`
      id,
      winner_id,
      played_at,
      session_type,
      participants:game_participants(user_id)
    `)
    .eq('session_type', 'individual')
    .not('winner_id', 'is', null)
    .order('played_at', { ascending: true })
    .order('created_at', { ascending: true });

  if (allSessionsError) {
    throw new Error(`Erreur Supabase: ${allSessionsError.message}`);
  }

  // Préparer les sessions pour le replay ELO
  const eloSessions: EloGameSession[] = (allIndividualSessions || []).map((s) => ({
    sessionId: s.id,
    winnerId: s.winner_id!,
    participantIds: (s.participants as { user_id: string }[]).map((p) => p.user_id),
    playedAt: new Date(s.played_at),
  }));

  // Calculer les ratings à chaque étape pour obtenir les deltas
  // On va calculer le rating AVANT chaque partie pour pouvoir calculer le delta
  const ratingsBefore = new Map<string, Map<string, number>>(); // sessionId -> Map<userId, ratingBefore>
  const currentRatings = new Map<string, number>();

  for (const session of eloSessions) {
    // Initialiser les joueurs qu'on n'a jamais vus
    for (const pid of session.participantIds) {
      if (!currentRatings.has(pid)) {
        currentRatings.set(pid, 1200);
      }
    }

    // Sauvegarder les ratings avant cette partie
    const before = new Map<string, number>();
    for (const pid of session.participantIds) {
      before.set(pid, currentRatings.get(pid)!);
    }
    ratingsBefore.set(session.sessionId, before);

    // Calculer les nouveaux ratings
    const loserIds = session.participantIds.filter((pid) => pid !== session.winnerId);
    if (loserIds.length === 0) continue;

    const winnerRating = currentRatings.get(session.winnerId)!;
    const loserRatings = loserIds.map((lid) => currentRatings.get(lid)!);

    if (loserIds.length === 1) {
      // 1v1
      const expectedWinner = 1 / (1 + Math.pow(10, (loserRatings[0] - winnerRating) / 400));
      const winnerNew = Math.round(winnerRating + 32 * (1 - expectedWinner));
      const loserNew = Math.round(loserRatings[0] + 32 * (0 - (1 - expectedWinner)));
      currentRatings.set(session.winnerId, winnerNew);
      currentRatings.set(loserIds[0], loserNew);
    } else {
      // Groupe
      const kEffective = 32 / loserIds.length;
      let winnerDelta = 0;
      for (let i = 0; i < loserIds.length; i++) {
        const expected = 1 / (1 + Math.pow(10, (loserRatings[i] - winnerRating) / 400));
        winnerDelta += kEffective * (1 - expected);
        const loserDelta = kEffective * (0 - (1 - expected));
        currentRatings.set(loserIds[i], Math.round(loserRatings[i] + loserDelta));
      }
      currentRatings.set(session.winnerId, Math.round(winnerRating + winnerDelta));
    }
  }

  // Construire la réponse avec les deltas ELO
  const activities: ActivityItem[] = (sessions || []).map((session) => {
    // Supabase returns relations as arrays, get first element
    const gameArr = session.game as unknown as { id: string; name: string }[] | null;
    const game = gameArr?.[0] ?? null;
    const winnerArr = session.winner as unknown as { id: string; member_name: string }[] | null;
    const winner = winnerArr?.[0] ?? null;
    const participants = (session.participants as unknown as { user_id: string; user: { id: string; member_name: string }[] | null }[])
      .map((p) => ({
        userId: p.user_id,
        userName: p.user?.[0]?.member_name || 'Unknown',
      }));

    // Calculer le delta ELO si c'est une partie individuelle avec un gagnant
    let eloDelta: number | null = null;
    if (session.session_type === 'individual' && session.winner_id) {
      const before = ratingsBefore.get(session.id);
      if (before) {
        const winnerRatingBefore = before.get(session.winner_id) || 1200;
        const loserIds = participants
          .filter((p) => p.userId !== session.winner_id)
          .map((p) => p.userId);
        const loserRatingsBefore = loserIds.map((lid) => before.get(lid) || 1200);
        eloDelta = calculateEloDelta(winnerRatingBefore, loserRatingsBefore);
      }
    }

    return {
      sessionId: session.id,
      gameId: session.game_id,
      gameName: game?.name || 'Unknown',
      playedAt: session.played_at,
      sessionType: session.session_type as 'individual' | 'team',
      winnerId: session.winner_id,
      winnerName: winner?.member_name || null,
      participants,
      eloDelta,
    };
  });

  const response: ActivityResponse = {
    activities,
  };

  return NextResponse.json(response);
}
