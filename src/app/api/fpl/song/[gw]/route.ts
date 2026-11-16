import { NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import { FPL_SEASON } from '@/lib/fpl/config';
import { SONG_BUCKET } from '@/lib/fpl/song-store';

const NO_STORE = { 'Cache-Control': 'no-store' };
const LINK_TTL_SECONDS = 600;

/**
 * Members only: redirects to a short-lived signed link to the stored Drère song.
 * Storage serves the file itself (byte ranges for Safari, no 4.5 MB function
 * response limit), and the link expires 10 minutes after it was handed out.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ gw: string }> }) {
  if (!(await getSessionUser())) return new NextResponse('Unauthorized', { status: 401, headers: NO_STORE });

  const gw = Number((await ctx.params).gw);
  if (!Number.isInteger(gw) || gw < 1 || gw > 38) return new NextResponse('Not found', { status: 404, headers: NO_STORE });

  const supabase = getSupabaseAdmin();
  const { data: row } = await supabase
    .from('fpl_gw_reviews')
    .select('song_storage_path')
    .eq('season', FPL_SEASON)
    .eq('gw', gw)
    .maybeSingle();
  if (!row?.song_storage_path) return new NextResponse('Not found', { status: 404, headers: NO_STORE });

  const { data, error } = await supabase.storage.from(SONG_BUCKET).createSignedUrl(row.song_storage_path, LINK_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.error(`[fpl] song GW${gw} link failed:`, error?.message);
    return new NextResponse('Not found', { status: 404, headers: NO_STORE });
  }
  return NextResponse.redirect(data.signedUrl, { status: 302, headers: NO_STORE });
}
