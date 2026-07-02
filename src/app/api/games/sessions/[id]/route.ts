import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT /api/games/sessions/[id] - Update a session
export async function PUT(request: NextRequest, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const { game_id, played_at, location, session_type, winner_id, participant_ids } = body;

  const supabase = getSupabaseAdmin();

  // Verify session exists and load current winner + participants
  const { data: existingSession, error: fetchError } = await supabase
    .from('game_sessions')
    .select('id, winner_id, participants:game_participants(user_id)')
    .eq('id', id)
    .single();

  if (fetchError || !existingSession) {
    return NextResponse.json({ error: 'Session non trouvée' }, { status: 404 });
  }

  // Validate session_type up front
  if (session_type !== undefined && !['individual', 'team'].includes(session_type)) {
    return NextResponse.json(
      { error: 'session_type invalide (individual ou team)' },
      { status: 400 }
    );
  }

  // Resolve the FINAL participant set and winner, then validate BEFORE writing
  // anything — otherwise a bad body could leave a partial update, and a winner
  // outside the participants would poison the ELO replay (NaN across the board).
  let newParticipantIds: string[] | null = null;
  if (participant_ids !== undefined) {
    if (!Array.isArray(participant_ids) || participant_ids.length < 2) {
      return NextResponse.json(
        { error: 'Au moins 2 participants requis' },
        { status: 400 }
      );
    }
    newParticipantIds = participant_ids;
  }

  const finalParticipantIds =
    newParticipantIds ??
    (existingSession.participants as { user_id: string }[]).map((p) => p.user_id);
  const finalWinnerId =
    winner_id !== undefined ? (winner_id || null) : existingSession.winner_id;

  if (finalWinnerId && !finalParticipantIds.includes(finalWinnerId)) {
    return NextResponse.json(
      { error: 'Le gagnant doit être un participant' },
      { status: 400 }
    );
  }

  // Build update object
  const updateData: Record<string, unknown> = {
    updated_by: user.id,
  };

  if (game_id !== undefined) {
    updateData.game_id = game_id;
  }

  if (played_at !== undefined) {
    updateData.played_at = played_at;
  }

  if (location !== undefined) {
    updateData.location = location || null;
  }

  if (session_type !== undefined) {
    updateData.session_type = session_type;
  }

  if (winner_id !== undefined) {
    updateData.winner_id = winner_id || null;
  }

  // Update session (validation already passed above)
  const { error: updateError } = await supabase
    .from('game_sessions')
    .update(updateData)
    .eq('id', id);

  if (updateError) {
    throw new Error(`Erreur Supabase: ${updateError.message}`);
  }

  // Replace participants if a new set was provided (already validated)
  if (newParticipantIds) {
    await supabase.from('game_participants').delete().eq('session_id', id);

    const participantInserts = newParticipantIds.map((pid: string) => ({
      session_id: id,
      user_id: pid,
    }));

    const { error: participantsError } = await supabase
      .from('game_participants')
      .insert(participantInserts);

    if (participantsError) {
      throw new Error(`Erreur Supabase: ${participantsError.message}`);
    }
  }

  // Fetch updated session
  const { data: updatedSession, error: refetchError } = await supabase
    .from('game_sessions')
    .select(`
      *,
      game:games(id, name),
      winner:users!game_sessions_winner_id_fkey(id, member_name, member_slug),
      participants:game_participants(
        user:users(id, member_name, member_slug)
      )
    `)
    .eq('id', id)
    .single();

  if (refetchError) {
    throw new Error(`Erreur Supabase: ${refetchError.message}`);
  }

  return NextResponse.json(updatedSession);
}

// DELETE /api/games/sessions/[id] - Delete a session
export async function DELETE(request: NextRequest, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = getSupabaseAdmin();

  // Verify session exists
  const { data: existingSession, error: fetchError } = await supabase
    .from('game_sessions')
    .select('id')
    .eq('id', id)
    .single();

  if (fetchError || !existingSession) {
    return NextResponse.json({ error: 'Session non trouvée' }, { status: 404 });
  }

  // Delete session (CASCADE will delete participants)
  const { error: deleteError } = await supabase
    .from('game_sessions')
    .delete()
    .eq('id', id);

  if (deleteError) {
    throw new Error(`Erreur Supabase: ${deleteError.message}`);
  }

  return NextResponse.json({ success: true });
}
