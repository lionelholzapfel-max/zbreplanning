import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';

/**
 * Create an activity. Service role after the session check — never an anon write.
 * Empty optional fields are normalised to NULL: the `date` column is a real
 * `date` type and rejects '' (that was the 400 on the direct anon insert).
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

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
  const { data, error } = await supabase
    .from('activities')
    .insert({
      title,
      description: body.description || null,
      date: body.date || null,
      time: body.time || null,
      location: body.location || null,
      type: 'event',
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data.id });
}
