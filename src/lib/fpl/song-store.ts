import 'server-only';
import { getSupabaseAdmin } from '@/lib/auth/session';

// Suno only hands out temporary audio URLs: the Drère song is copied into the
// private bucket (it mocks real people, so it stays behind the login).
export const SONG_BUCKET = 'fpl-private';
const MAX_BYTES = 20 * 1024 * 1024;

export function songPath(season: string, gw: number): string {
  return `songs/${season.replace(/[^0-9-]/g, '-')}-gw${gw}.mp3`;
}

/** Downloads the mp3 and stores it; returns the storage path, or null on failure (logged). */
export async function persistSong(season: string, gw: number, audioUrl: string): Promise<string | null> {
  try {
    if (!audioUrl.startsWith('https://')) throw new Error('audio URL is not https');
    const res = await fetch(audioUrl, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`download HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) throw new Error(`unexpected size ${bytes.byteLength}`);
    const path = songPath(season, gw);
    const { error } = await getSupabaseAdmin()
      .storage.from(SONG_BUCKET)
      .upload(path, bytes, { contentType: 'audio/mpeg', upsert: true });
    if (error) throw new Error(`upload: ${error.message}`);
    console.log(`[fpl] song GW${gw} stored (${Math.round(bytes.byteLength / 1024)} KB) at ${path}`);
    return path;
  } catch (e) {
    console.error(`[fpl] song GW${gw} NOT stored (temporary URL kept, it will expire):`, e);
    return null;
  }
}
