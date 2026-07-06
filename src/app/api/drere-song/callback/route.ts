import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/auth/session';

/**
 * Callback sunoapi.org (callBackUrl). Le poller serverless peut être tué par
 * Vercel avant la fin de génération (~5-10 min) : ce callback est le filet qui
 * collecte le résultat quoi qu'il arrive. Auth implicite par task_id (opaque).
 * Toujours répondre 200 — un callback en échec peut basculer la tâche Suno en
 * CALLBACK_EXCEPTION.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const taskId: string | undefined = body?.data?.task_id;
    const callbackType: string | undefined = body?.data?.callbackType;
    if (!taskId) return NextResponse.json({ ok: true });

    const supabase = getSupabaseAdmin();

    // Retrouver la chanson : par task_id, sinon (rangée créée avant la
    // colonne task_id) la génération en cours la plus récente.
    let songId: number | null = null;
    const { data: byTask } = await supabase
      .from('drere_week_songs')
      .select('id')
      .eq('task_id', taskId)
      .maybeSingle();
    if (byTask) {
      songId = byTask.id;
    } else {
      const { data: inFlight } = await supabase
        .from('drere_week_songs')
        .select('id')
        .in('status', ['pending', 'generating'])
        .is('audio_url', null)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (inFlight) songId = inFlight.id;
    }
    if (songId === null) return NextResponse.json({ ok: true });

    if (callbackType === 'error' || body?.code !== 200) {
      await supabase
        .from('drere_week_songs')
        .update({
          status: 'failed',
          error_message: `Suno callback error: ${JSON.stringify(body).slice(0, 300)}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', songId)
        .neq('status', 'completed');
      return NextResponse.json({ ok: true });
    }

    // 'first' et 'complete' portent les clips ; 'text' = paroles prêtes.
    const clip = body?.data?.data?.[0];
    if (clip?.audio_url) {
      const update: Record<string, unknown> = {
        status: 'completed',
        audio_url: clip.audio_url,
        cover_image_url: clip.image_url || null,
        error_message: null,
        updated_at: new Date().toISOString(),
      };
      if (typeof clip.prompt === 'string' && clip.prompt.trim().length > 0) {
        update.lyrics = clip.prompt; // paroles écrites par Suno (mode non-custom)
      }
      await supabase.from('drere_week_songs').update(update).eq('id', songId);
    }
  } catch {
    // ne jamais faire échouer le callback
  }
  return NextResponse.json({ ok: true });
}
