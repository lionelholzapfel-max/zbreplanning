import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import { MANAGER_BY_SLUG } from '@/lib/fpl/config';

// The "fat" portraits are private jokes between friends. The git repo is public,
// so they live in a PRIVATE Supabase Storage bucket and are only streamed to a
// logged-in member through this route.
const BUCKET = 'fpl-private';

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const user = await getSessionUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const { slug } = await ctx.params;
  if (!Object.prototype.hasOwnProperty.call(MANAGER_BY_SLUG, slug)) return new NextResponse('Not found', { status: 404 });
  const variant = request.nextUrl.searchParams.get('v') === 'full' ? 'full' : 'face';

  const { data, error } = await getSupabaseAdmin().storage.from(BUCKET).download(`portraits/${slug}-${variant}.webp`);
  if (error || !data) {
    console.error(`[fpl] photo ${slug}-${variant} unavailable:`, error?.message);
    return new NextResponse('Not found', { status: 404 });
  }
  return new NextResponse(await data.arrayBuffer(), {
    headers: {
      'Content-Type': 'image/webp',
      // private: the browser may cache it, shared caches / the CDN must not.
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
