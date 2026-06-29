import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';

interface H2HResult {
  user1: { id: string; name: string; wins: number };
  user2: { id: string; name: string; wins: number };
  ties: number;
  totalGames: number;
  gameFilter: { id: string; name: string } | null;
}

// GET /api/games/h2h - Head-to-head between two players
// Query params: user1, user2, game_id (optional)
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const user1Id = searchParams.get('user1');
  const user2Id = searchParams.get('user2');
  const gameId = searchParams.get('game_id');

  if (!user1Id || !user2Id) {
    return NextResponse.json(
      { error: 'Paramètres user1 et user2 requis' },
      { status: 400 }
    );
  }

  if (user1Id === user2Id) {
    return NextResponse.json(
      { error: 'Les deux joueurs doivent être différents' },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  // Fetch user names
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, member_name')
    .in('id', [user1Id, user2Id]);

  if (usersError) {
    throw new Error(`Erreur Supabase: ${usersError.message}`);
  }

  if (!users || users.length !== 2) {
    return NextResponse.json({ error: 'Un ou plusieurs utilisateurs non trouvés' }, { status: 404 });
  }

  const userMap = new Map(users.map((u) => [u.id, u.member_name]));

  // Fetch game name if filtering by game
  let gameFilter: { id: string; name: string } | null = null;
  if (gameId) {
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('id, name')
      .eq('id', gameId)
      .single();

    if (gameError || !game) {
      return NextResponse.json({ error: 'Jeu non trouvé' }, { status: 404 });
    }
    gameFilter = game;
  }

  // Find all individual sessions where BOTH users participated
  // Step 1: Get sessions where user1 participated
  const { data: user1Sessions, error: user1Error } = await supabase
    .from('game_participants')
    .select('session_id')
    .eq('user_id', user1Id);

  if (user1Error) {
    throw new Error(`Erreur Supabase: ${user1Error.message}`);
  }

  // Step 2: Get sessions where user2 participated
  const { data: user2Sessions, error: user2Error } = await supabase
    .from('game_participants')
    .select('session_id')
    .eq('user_id', user2Id);

  if (user2Error) {
    throw new Error(`Erreur Supabase: ${user2Error.message}`);
  }

  // Step 3: Find intersection (sessions where both participated)
  const user1SessionIds = new Set(user1Sessions?.map((s) => s.session_id) || []);
  const commonSessionIds = (user2Sessions?.map((s) => s.session_id) || []).filter((id) =>
    user1SessionIds.has(id)
  );

  if (commonSessionIds.length === 0) {
    return NextResponse.json({
      user1: { id: user1Id, name: userMap.get(user1Id) || 'Unknown', wins: 0 },
      user2: { id: user2Id, name: userMap.get(user2Id) || 'Unknown', wins: 0 },
      ties: 0,
      totalGames: 0,
      gameFilter,
    } as H2HResult);
  }

  // Step 4: Fetch these sessions with their details
  let query = supabase
    .from('game_sessions')
    .select('id, game_id, session_type, winner_id')
    .in('id', commonSessionIds)
    .eq('session_type', 'individual');

  if (gameId) {
    query = query.eq('game_id', gameId);
  }

  const { data: sessions, error: sessionsError } = await query;

  if (sessionsError) {
    throw new Error(`Erreur Supabase: ${sessionsError.message}`);
  }

  // Step 5: Count wins
  // RÈGLE H2H: Dans une partie individuelle de groupe, le gagnant est réputé
  // avoir battu CHAQUE autre participant. Donc si Alpha gagne un Uno où Beta
  // jouait, Alpha a +1 en H2H face à Beta.
  let user1Wins = 0;
  let user2Wins = 0;
  let ties = 0;

  for (const session of sessions || []) {
    if (session.winner_id === user1Id) {
      user1Wins += 1;
    } else if (session.winner_id === user2Id) {
      user2Wins += 1;
    } else if (session.winner_id === null) {
      ties += 1;
    }
    // If someone else won (neither user1 nor user2), it doesn't count in their H2H
  }

  const result: H2HResult = {
    user1: { id: user1Id, name: userMap.get(user1Id) || 'Unknown', wins: user1Wins },
    user2: { id: user2Id, name: userMap.get(user2Id) || 'Unknown', wins: user2Wins },
    ties,
    totalGames: (sessions || []).length,
    gameFilter,
  };

  return NextResponse.json(result);
}
