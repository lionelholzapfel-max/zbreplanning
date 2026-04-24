import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Demo mode: skip auth check
  // When Supabase is configured, uncomment the import and use updateSession

  // import { updateSession } from '@/lib/supabase/middleware'
  // return await updateSession(request)

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
