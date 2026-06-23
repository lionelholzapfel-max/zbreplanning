import { NextResponse } from 'next/server';
import { getSessionUser, getSupabaseClient } from '@/lib/auth/session';

export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Non connecté' },
        { status: 401 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// Check if a member needs to set up PIN
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { member_id } = body;

    if (!member_id) {
      return NextResponse.json(
        { error: 'member_id requis' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    const { data: user, error } = await supabase
      .from('users')
      .select('id, pin_hash')
      .eq('id', member_id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json(
        { error: 'Erreur base de données' },
        { status: 500 }
      );
    }

    // User doesn't exist or has no PIN
    const needsSetup = !user || !user.pin_hash;

    return NextResponse.json({ needsSetup });
  } catch (error) {
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
