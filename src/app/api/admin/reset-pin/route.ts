import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import { MEMBERS } from '@/data/members';

// POST /api/admin/reset-pin
// Admin-only route to reset a member's PIN
export async function POST(request: NextRequest) {
  try {
    // Check admin access
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Non connecté' },
        { status: 401 }
      );
    }

    if (!user.is_admin) {
      return NextResponse.json(
        { error: 'Accès admin requis' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { member_id } = body;

    // Validate input
    if (!member_id) {
      return NextResponse.json(
        { error: 'member_id requis' },
        { status: 400 }
      );
    }

    // Find member
    const member = MEMBERS.find(m => m.id === member_id);
    if (!member) {
      return NextResponse.json(
        { error: 'Membre non trouvé' },
        { status: 404 }
      );
    }

    // Prevent admin from resetting their own PIN via this route
    if (member_id === user.id) {
      return NextResponse.json(
        { error: 'Tu ne peux pas reset ton propre PIN via cette route' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Check if user exists
    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('id, pin_hash')
      .eq('id', member_id)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('[Admin] Error checking user:', selectError);
      return NextResponse.json(
        { error: 'Erreur base de données' },
        { status: 500 }
      );
    }

    if (!existingUser) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé en base' },
        { status: 404 }
      );
    }

    if (!existingUser.pin_hash) {
      return NextResponse.json(
        { error: 'Cet utilisateur n\'a pas de PIN configuré' },
        { status: 400 }
      );
    }

    // Reset PIN to null
    const { error: updateError } = await supabase
      .from('users')
      .update({ pin_hash: null })
      .eq('id', member_id);

    if (updateError) {
      console.error('[Admin] Error resetting PIN:', updateError);
      return NextResponse.json(
        { error: 'Erreur lors du reset du PIN' },
        { status: 500 }
      );
    }

    console.log(`[Admin] PIN reset for member ${member_id} by admin ${user.id}`);

    return NextResponse.json({
      success: true,
      message: `PIN de ${member.name} réinitialisé`,
    });
  } catch (error) {
    console.error('[Admin] Reset PIN error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
