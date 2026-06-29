import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';

// GET /api/games - List all games
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .order('name');

  if (error) {
    throw new Error(`Erreur Supabase: ${error.message}`);
  }

  return NextResponse.json(data);
}

// POST /api/games - Create a new game
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const body = await request.json();
  const { name, default_type } = body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return NextResponse.json({ error: 'Nom du jeu requis' }, { status: 400 });
  }

  if (default_type && !['individual', 'team'].includes(default_type)) {
    return NextResponse.json(
      { error: 'Type invalide (individual ou team)' },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('games')
    .insert({
      name: name.trim(),
      default_type: default_type || 'individual',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Ce jeu existe déjà' },
        { status: 409 }
      );
    }
    throw new Error(`Erreur Supabase: ${error.message}`);
  }

  return NextResponse.json(data, { status: 201 });
}
