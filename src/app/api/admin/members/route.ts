import { NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';

// GET /api/admin/members
// Admin-only route to get all member statuses
export async function GET() {
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

    const supabase = getSupabaseAdmin();

    // Get all users with their PIN status
    const { data: users, error } = await supabase
      .from('users')
      .select('id, member_name, pin_hash, is_admin')
      .order('member_name');

    if (error) {
      console.error('[Admin] Error getting users:', error);
      return NextResponse.json(
        { error: 'Erreur base de données' },
        { status: 500 }
      );
    }

    // Map to status (don't expose pin_hash)
    const userStatuses = (users || []).map(u => ({
      id: u.id,
      has_pin: !!u.pin_hash,
      is_admin: u.is_admin,
    }));

    return NextResponse.json({
      users: userStatuses,
    });
  } catch (error) {
    console.error('[Admin] Members error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
