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
  // Chanson du Drère : couvre /api/drere-song (POST auto-déclenché par le cron
  // awards/weekly via CRON_SECRET, GET protégé par session dans la route),
  // /generate (admin vérifié dans la route) et /callback (POST serveur→serveur
  // de sunoapi.org, identifié par task_id). Chaque route fait sa propre auth.
  '/api/drere-song',
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
