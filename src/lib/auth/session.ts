import { cookies } from 'next/headers';
import { jwtVerify, SignJWT } from 'jose';
import { createClient } from '@supabase/supabase-js';

export interface SessionUser {
  id: string;
  member_id: string;
  member_name: string;
  member_slug: string;
  is_admin: boolean;
}

// Fail-closed: never fall back to a hardcoded secret. If JWT_SECRET is missing
// in an environment, we'd rather crash loudly than silently sign forgeable tokens.
const jwtSecretValue = process.env.JWT_SECRET;
if (!jwtSecretValue) {
  throw new Error('JWT_SECRET environment variable is required (no insecure fallback)');
}
const JWT_SECRET = new TextEncoder().encode(jwtSecretValue);

const COOKIE_NAME = 'zbre_session';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

// Get Supabase client with service role (bypasses RLS)
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase admin credentials');
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Get Supabase client with anon key
export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(url, anonKey);
}

// Create a session JWT
export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    id: user.id,
    member_id: user.member_id,
    member_name: user.member_name,
    member_slug: user.member_slug,
    is_admin: user.is_admin,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET);
}

// Verify a session JWT
export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      id: payload.id as string,
      member_id: payload.member_id as string,
      member_name: payload.member_name as string,
      member_slug: payload.member_slug as string,
      is_admin: payload.is_admin as boolean,
    };
  } catch {
    return null;
  }
}

// Get current session user from cookies (for API routes)
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return verifySessionToken(token);
}

// Set session cookie
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

// Clear session cookie
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// Check if user is admin
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  if (!user.is_admin) {
    throw new Error('Admin access required');
  }

  return user;
}
