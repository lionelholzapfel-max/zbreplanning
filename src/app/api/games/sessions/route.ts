import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';

// GET /api/games/sessions - List sessions with filters
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const gameId = searchParams.get('game_id');
  const userId = searchParams.get('user_id');
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('game_sessions')
    .select(`
      *,
      game:games(id, name),
      winner:users!game_sessions_winner_id_fkey(id, member_name, member_slug),
      created_by_user:users!game_sessions_created_by_fkey(id, member_name),
      participants:game_participants(
        user:users(id, member_name, member_slug)
      )
    `)
    .order('played_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (gameId) {
    query = query.eq('game_id', gameId);
  }

  if (userId) {
    // Filter sessions where user is a participant
    const { data: participantSessions } = await supabase
      .from('game_participants')
      .select('session_id')
      .eq('user_id', userId);

    if (participantSessions && participantSessions.length > 0) {
      const sessionIds = participantSessions.map((p) => p.session_id);
      query = query.in('id', sessionIds);
    } else {
      return NextResponse.json([]);
    }
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erreur Supabase: ${error.message}`);
  }

  return NextResponse.json(data);
}

// POST /api/games/sessions - Create a new session
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const body = await request.json();
  const { game_id, played_at, location, session_type, winner_id, participant_ids } = body;

  // Validation
  if (!game_id) {
    return NextResponse.json({ error: 'game_id requis' }, { status: 400 });
  }

  if (!session_type || !['individual', 'team'].includes(session_type)) {
    return NextResponse.json(
      { error: 'session_type invalide (individual ou team)' },
      { status: 400 }
    );
  }

  if (!participant_ids || !Array.isArray(participant_ids) || participant_ids.length < 2) {
    return NextResponse.json(
      { error: 'Au moins 2 participants requis' },
      { status: 400 }
    );
  }

  // Winner must be a participant (if not null)
  if (winner_id && !participant_ids.includes(winner_id)) {
    return NextResponse.json(
      { error: 'Le gagnant doit être un participant' },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  // Verify game exists
  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('id')
    .eq('id', game_id)
    .single();

  if (gameError || !game) {
    return NextResponse.json({ error: 'Jeu non trouvé' }, { status: 404 });
  }

  // Create session
  const { data: session, error: sessionError } = await supabase
    .from('game_sessions')
    .insert({
      game_id,
      played_at: played_at || new Date().toISOString().split('T')[0],
      location: location || null,
      session_type,
      winner_id: winner_id || null,
      created_by: user.id,
      updated_by: user.id,
    })
    .select()
    .single();

  if (sessionError) {
    throw new Error(`Erreur Supabase: ${sessionError.message}`);
  }

  // Add participants
  const participantInserts = participant_ids.map((pid: string) => ({
    session_id: session.id,
    user_id: pid,
  }));

  const { error: participantsError } = await supabase
    .from('game_participants')
    .insert(participantInserts);

  if (participantsError) {
    // Rollback: delete the session
    await supabase.from('game_sessions').delete().eq('id', session.id);
    throw new Error(`Erreur Supabase: ${participantsError.message}`);
  }

  // Fetch complete session with relations
  const { data: completeSession, error: fetchError } = await supabase
    .from('game_sessions')
    .select(`
      *,
      game:games(id, name),
      winner:users!game_sessions_winner_id_fkey(id, member_name, member_slug),
      participants:game_participants(
        user:users(id, member_name, member_slug)
      )
    `)
    .eq('id', session.id)
    .single();

  if (fetchError) {
    throw new Error(`Erreur Supabase: ${fetchError.message}`);
  }

  return NextResponse.json(completeSession, { status: 201 });
}
