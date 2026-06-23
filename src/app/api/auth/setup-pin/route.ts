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
    const rateLimitKey = `setup-pin:${member_id}`;
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

    // Check if user already has a PIN
    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('id, pin_hash, is_admin')
      .eq('id', member_id)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      return NextResponse.json(
        { error: 'Erreur base de données' },
        { status: 500 }
      );
    }

    // If user exists and has PIN, reject (must use login)
    if (existingUser?.pin_hash) {
      return NextResponse.json(
        { error: 'PIN déjà configuré. Utilise la page de connexion.' },
        { status: 409 }
      );
    }

    // Hash the PIN
    const pinHash = await bcrypt.hash(pin, 10);

    // Create or update user
    if (existingUser) {
      // Update existing user with PIN
      const { error: updateError } = await supabase
        .from('users')
        .update({ pin_hash: pinHash })
        .eq('id', member_id);

      if (updateError) {
        return NextResponse.json(
          { error: 'Erreur lors de la configuration du PIN' },
          { status: 500 }
        );
      }
    } else {
      // Create new user with PIN
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: member_id,
          email: `${member.slug}@zbre.team`,
          member_id: member_id,
          member_name: member.name,
          member_slug: member.slug,
          pin_hash: pinHash,
          is_admin: member_id === '7', // Lionel is admin
        });

      if (insertError) {
        return NextResponse.json(
          { error: 'Erreur lors de la création du compte' },
          { status: 500 }
        );
      }
    }

    // Create session
    const sessionUser = {
      id: member_id,
      member_id: member_id,
      member_name: member.name,
      member_slug: member.slug,
      is_admin: existingUser?.is_admin || member_id === '7',
    };

    const token = await createSessionToken(sessionUser);
    await setSessionCookie(token);

    // Reset rate limit on successful setup
    resetRateLimit(rateLimitKey);

    return NextResponse.json({
      success: true,
      user: sessionUser,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
