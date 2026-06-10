import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSupabaseClient, createSessionToken, setSessionCookie } from '@/lib/auth/session';
import { MEMBERS } from '@/data/members';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { member_id, pin } = body;

    // Validate input
    if (!member_id || !pin) {
      return NextResponse.json(
        { error: 'member_id et pin requis' },
        { status: 400 }
      );
    }

    // Rate limiting - 5 attempts per 15 minutes per member
    const rateLimitKey = `login:${member_id}`;
    const rateLimit = checkRateLimit(rateLimitKey, {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
      blockDurationMs: 15 * 60 * 1000, // 15 minutes
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Trop de tentatives, réessaie dans ${rateLimit.retryAfterMinutes} min` },
        { status: 429 }
      );
    }

    // Validate PIN format (4 digits)
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: 'Le PIN doit contenir 4 chiffres' },
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

    const supabase = getSupabaseClient();

    // Get user from database
    const { data: user, error: selectError } = await supabase
      .from('users')
      .select('id, member_id, member_name, member_slug, pin_hash, is_admin')
      .eq('id', member_id)
      .single();

    if (selectError) {
      if (selectError.code === 'PGRST116') {
        // User doesn't exist - needs to set up PIN first
        return NextResponse.json(
          { error: 'Compte non trouvé. Configure d\'abord ton PIN.', needsSetup: true },
          { status: 404 }
        );
      }
      console.error('[Auth] Error getting user:', selectError);
      return NextResponse.json(
        { error: 'Erreur base de données' },
        { status: 500 }
      );
    }

    // Check if PIN is set
    if (!user.pin_hash) {
      return NextResponse.json(
        { error: 'PIN non configuré. Configure d\'abord ton PIN.', needsSetup: true },
        { status: 400 }
      );
    }

    // Verify PIN
    const isValid = await bcrypt.compare(pin, user.pin_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'PIN incorrect' },
        { status: 401 }
      );
    }

    // Create session
    const sessionUser = {
      id: user.id,
      member_id: user.member_id,
      member_name: user.member_name,
      member_slug: user.member_slug,
      is_admin: user.is_admin,
    };

    const token = await createSessionToken(sessionUser);
    await setSessionCookie(token);

    // Reset rate limit on successful login
    resetRateLimit(rateLimitKey);

    return NextResponse.json({
      success: true,
      user: sessionUser,
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
