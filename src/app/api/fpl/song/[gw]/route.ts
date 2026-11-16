import { NextResponse, type NextRequest } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import { FPL_SEASON } from '@/lib/fpl/config';
import { SONG_BUCKET } from '@/lib/fpl/song-store';

const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Streams the stored Drère song of a GW to a logged-in member. Supports byte
 * ranges: Safari (iPhone) refuses to play audio from a server without them.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ gw: string }> }) {
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

  const { data, error } = await supabase.storage.from(SONG_BUCKET).download(row.song_storage_path);
  if (error || !data) {
    console.error(`[fpl] song GW${gw} unavailable:`, error?.message);
    return new NextResponse('Not found', { status: 404, headers: NO_STORE });
  }
  const bytes = new Uint8Array(await data.arrayBuffer());
  const size = bytes.byteLength;
  const base = {
    'Content-Type': 'audio/mpeg',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=86400',
  };

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
  if (range && (range[1] || range[2])) {
    // "bytes=a-b", "bytes=a-" or the suffix form "bytes=-n" (last n bytes)
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new NextResponse(null, { status: 416, headers: { ...NO_STORE, 'Content-Range': `bytes */${size}` } });
    }
    return new NextResponse(bytes.slice(start, end + 1), {
      status: 206,
      headers: { ...base, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
    });
  }
  return new NextResponse(bytes, { headers: { ...base, 'Content-Length': String(size) } });
}
