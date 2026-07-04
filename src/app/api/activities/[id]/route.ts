import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';

/**
 * Update an activity. Authorized for the CREATOR or anyone who has RESPONDED
 * (has an activity_participations row). Runs with the service role after the
 * check — never a direct anon write (activities RLS is permissive).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id } = await params;

  let body: { title?: string; description?: string; date?: string; time?: string; location?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 });
  }

  const title = (body.title ?? '').trim();
  if (!title) {
    return NextResponse.json({ error: 'Titre requis' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Load the activity to check ownership.
  const { data: activity, error: fetchError } = await supabase
    .from('activities')
    .select('created_by')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!activity) {
    return NextResponse.json({ error: 'Activité introuvable' }, { status: 404 });
  }

  const isCreator = activity.created_by === user.id;
  let isResponder = false;
  if (!isCreator) {
    const { data: participation } = await supabase
      .from('activity_participations')
      .select('id')
      .eq('activity_id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    isResponder = !!participation;
  }

  if (!isCreator && !isResponder) {
    return NextResponse.json(
      { error: 'Seul le créateur ou un participant peut modifier cette activité' },
      { status: 403 }
    );
  }

  const { error: updateError } = await supabase
    .from('activities')
    .update({
      title,
      // `date` is a real date column — '' is rejected (400). Empty → NULL.
      description: body.description || null,
      date: body.date || null,
      time: body.time || null,
      location: body.location || null,
    })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/**
 * Delete an activity. CREATOR only (403 otherwise) — checked server-side against
 * the JWT. Cascades: removes the responses (activity_participations) and the
 * related notifications, then the activity. Service role, never an anon write.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: activity, error: fetchError } = await supabase
    .from('activities')
    .select('created_by')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!activity) {
    return NextResponse.json({ error: 'Activité introuvable' }, { status: 404 });
  }
  if (activity.created_by !== user.id) {
    return NextResponse.json(
      { error: 'Seul le créateur peut supprimer cette activité' },
      { status: 403 }
    );
  }

  // Cascade: responses + related notifications first, then the activity.
  await supabase.from('activity_participations').delete().eq('activity_id', id);
  await supabase.from('notifications').delete().eq('related_id', id);

  const { error: deleteError } = await supabase.from('activities').delete().eq('id', id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
