import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';

// GET /api/favorites
// Get all favorite teams for current user
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non connecté' },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('user_favorite_teams')
      .select('team_code')
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json(
        { error: 'Erreur base de données' },
        { status: 500 }
      );
    }

    const teams = (data || []).map(d => d.team_code);

    return NextResponse.json({ favorites: teams });
  } catch (error) {
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// POST /api/favorites
// Toggle a favorite team (add if not exists, remove if exists)
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non connecté' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { team_code } = body;

    if (!team_code || typeof team_code !== 'string') {
      return NextResponse.json(
        { error: 'team_code requis' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Check if already favorited
    const { data: existing } = await supabase
      .from('user_favorite_teams')
      .select('id')
      .eq('user_id', user.id)
      .eq('team_code', team_code)
      .single();

    if (existing) {
      // Remove favorite
      const { error: deleteError } = await supabase
        .from('user_favorite_teams')
        .delete()
        .eq('id', existing.id);

      if (deleteError) {
        return NextResponse.json(
          { error: 'Erreur lors de la suppression' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        action: 'removed',
        team_code,
      });
    } else {
      // Add favorite
      const { error: insertError } = await supabase
        .from('user_favorite_teams')
        .insert({
          user_id: user.id,
          team_code,
        });

      if (insertError) {
        return NextResponse.json(
          { error: 'Erreur lors de l\'ajout' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        action: 'added',
        team_code,
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
