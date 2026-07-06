import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/setup-pin',
  '/api/auth/me',
  '/api/auth/logout',
  // Cron endpoints: reachable without a session cookie, but each route
  // enforces CRON_SECRET / the x-vercel-cron header itself.
  '/api/results/sync',
  '/api/knockout/sync',
  '/api/awards/weekly',
  '/api/knockout/teams', // Public read: resolved knockout teams
  // Callback sunoapi.org : POST serveur→serveur sans cookie de session.
  // La route ne fait qu'écrire le résultat d'une tâche identifiée par task_id.
  '/api/drere-song/callback',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Allow static files
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/members') ||
    pathname.startsWith('/team') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionToken = request.cookies.get('zbre_session')?.value;

  if (!sessionToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verify JWT
  try {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET not configured');
    }
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    await jwtVerify(sessionToken, secret);
    return NextResponse.next();
  } catch {
    // Invalid or expired token
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('zbre_session');
    return response;
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
