import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';

interface GameForm {
  gameName: string;
  recentResults: ('W' | 'L')[]; // max 5, index 0 = plus récent
  lastPlayedAt: string;
}

interface FormResponse {
  userId: string;
  userName: string;
  formByGame: { [gameId: string]: GameForm };
}

// GET /api/games/players/[userId]/form - Forme récente par jeu
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { userId } = await params;

  const supabase = getSupabaseAdmin();

  // Récupérer les infos du joueur
  const { data: playerData, error: playerError } = await supabase
    .from('users')
    .select('id, member_name')
    .eq('id', userId)
    .single();

  if (playerError) {
    if (playerError.code === 'PGRST116') {
      return NextResponse.json({ error: 'Joueur non trouvé' }, { status: 404 });
    }
    throw new Error(`Erreur Supabase: ${playerError.message}`);
  }

  // Récupérer toutes les participations du joueur à des parties individuelles
  const { data: participations, error: participationsError } = await supabase
    .from('game_participants')
    .select(`
      session:game_sessions!inner(
        id,
        game_id,
        played_at,
        created_at,
        session_type,
        winner_id,
        game:games(id, name)
      )
    `)
    .eq('user_id', userId);

  if (participationsError) {
    throw new Error(`Erreur Supabase: ${participationsError.message}`);
  }

  // Filtrer les parties individuelles et grouper par jeu
  const gameResults: { [gameId: string]: { gameName: string; results: { playedAt: string; createdAt: string; won: boolean }[] } } = {};

  for (const participation of participations || []) {
    // supabase-js returns to-one embeds as objects (not arrays)
    const session = participation.session as unknown as {
      id: string;
      game_id: string;
      played_at: string;
      created_at: string;
      session_type: string;
      winner_id: string | null;
      game: { id: string; name: string } | null;
    } | null;

    if (!session || session.session_type !== 'individual') continue;

    const gameId = session.game_id;
    const gameName = session.game?.name || 'Unknown';
    const won = session.winner_id === userId;

    if (!gameResults[gameId]) {
      gameResults[gameId] = { gameName, results: [] };
    }

    gameResults[gameId].results.push({
      playedAt: session.played_at,
      createdAt: session.created_at,
      won,
    });
  }

  // Pour chaque jeu, trier par date décroissante et prendre les 5 derniers
  const formByGame: { [gameId: string]: GameForm } = {};

  for (const [gameId, data] of Object.entries(gameResults)) {
    // Trier par date décroissante (plus récent en premier)
    const sorted = data.results.sort((a, b) => {
      const dateCompare = new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime();
      if (dateCompare !== 0) return dateCompare;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Prendre les 5 derniers
    const last5 = sorted.slice(0, 5);

    if (last5.length === 0) continue;

    formByGame[gameId] = {
      gameName: data.gameName,
      recentResults: last5.map((r) => (r.won ? 'W' : 'L')),
      lastPlayedAt: last5[0].playedAt,
    };
  }

  const response: FormResponse = {
    userId: playerData.id,
    userName: playerData.member_name,
    formByGame,
  };

  return NextResponse.json(response);
}
