import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth/session';

export async function POST() {
  try {
    await clearSessionCookie();

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('[Auth] Logout error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
