import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/auth/session';
import { persistSong } from '@/lib/fpl/song-store';

// Downloading + storing the mp3 happens inside the callback.
export const maxDuration = 120;

/**
 * sunoapi.org callback for the FPL "Drère de la GW" song. Implicit auth: the
 * task_id is opaque and must match a row we created. Always answer 200 (a
 * failing callback can flip the Suno task into CALLBACK_EXCEPTION).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const taskId: unknown = body?.data?.task_id;
    if (typeof taskId !== 'string' || !taskId) return NextResponse.json({ ok: true });

    const supabase = getSupabaseAdmin();
    const { data: row } = await supabase
      .from('fpl_gw_reviews')
      .select('season, gw, song_status')
      .eq('song_task_id', taskId)
      .maybeSingle();
    if (!row) return NextResponse.json({ ok: true });

    const now = new Date().toISOString();
    if (body?.data?.callbackType === 'error' || body?.code !== 200) {
      await supabase
        .from('fpl_gw_reviews')
        .update({ song_status: 'failed', song_error: JSON.stringify(body).slice(0, 300), updated_at: now })
        .eq('season', row.season)
        .eq('gw', row.gw)
        .neq('song_status', 'completed');
      console.error(`[fpl] song GW${row.gw} failed (callback)`);
      return NextResponse.json({ ok: true });
    }

    const clip = body?.data?.data?.[0];
    if (typeof clip?.audio_url === 'string' && clip.audio_url.startsWith('https://')) {
      await supabase
        .from('fpl_gw_reviews')
        .update({
          song_status: 'completed',
          song_audio_url: clip.audio_url,
          song_cover_url: typeof clip.image_url === 'string' ? clip.image_url : null,
          song_title: typeof clip.title === 'string' ? clip.title.slice(0, 200) : null,
          song_lyrics: typeof clip.prompt === 'string' ? clip.prompt.slice(0, 5000) : null,
          song_error: null,
          updated_at: now,
        })
        .eq('season', row.season)
        .eq('gw', row.gw);
      console.log(`[fpl] song GW${row.gw} completed`);
      // Suno's URL is temporary: keep our own copy (several callbacks may arrive; upsert).
      const stored = await persistSong(row.season, row.gw, clip.audio_url);
      if (stored) {
        const { error } = await supabase
          .from('fpl_gw_reviews')
          .update({ song_storage_path: stored, updated_at: new Date().toISOString() })
          .eq('season', row.season)
          .eq('gw', row.gw);
        if (error) console.error(`[fpl] song GW${row.gw} stored but path not saved: ${error.message}`);
      }
    }
  } catch (e) {
    console.error('[fpl] song callback error:', e);
  }
  return NextResponse.json({ ok: true });
}
