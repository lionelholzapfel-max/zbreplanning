import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import { MEMBERS } from '@/data/members';

// POST /api/admin/reset-pin
// Admin-only route to reset a member's PIN
// In development, allows test bypass for E2E tests
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { member_id, _test_bypass } = body;

    // Allow test bypass in development mode only
    const isTestBypass = _test_bypass && process.env.NODE_ENV !== 'production';

    if (!isTestBypass) {
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

      // Prevent admin from resetting their own PIN via this route
      if (member_id === user.id) {
        return NextResponse.json(
          { error: 'Tu ne peux pas reset ton propre PIN via cette route' },
          { status: 400 }
        );
      }
    }

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
      // For test bypass, just return success if user doesn't exist
      if (isTestBypass) {
        return NextResponse.json({ success: true, message: 'User does not exist (test mode)' });
      }
      return NextResponse.json(
        { error: 'Utilisateur non trouvé en base' },
        { status: 404 }
      );
    }

    if (!existingUser.pin_hash) {
      // For test bypass, just return success if no PIN exists
      if (isTestBypass) {
        return NextResponse.json({ success: true, message: 'No PIN to reset (test mode)' });
      }
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
