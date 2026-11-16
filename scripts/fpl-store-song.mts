// Manual one-off: copy an already completed Drère song (temporary Suno URL)
// into the private bucket. Free (download + upload only).
// Usage: npx tsx --conditions=react-server --env-file=.env.local scripts/fpl-store-song.mts <gw>
import { getSupabaseAdmin } from '../src/lib/auth/session';
import { FPL_SEASON } from '../src/lib/fpl/config';
import { persistSong } from '../src/lib/fpl/song-store';

const gw = Number(process.argv.find((a) => /^\d+$/.test(a)));
const supabase = getSupabaseAdmin();
const { data: row } = await supabase.from('fpl_gw_reviews').select('song_audio_url').eq('season', FPL_SEASON).eq('gw', gw).single();
if (!row?.song_audio_url) throw new Error(`no song URL for GW${gw}`);
const path = await persistSong(FPL_SEASON, gw, row.song_audio_url);
if (!path) process.exit(1);
const { error } = await supabase.from('fpl_gw_reviews').update({ song_storage_path: path }).eq('season', FPL_SEASON).eq('gw', gw);
console.log(error ? `path not saved: ${error.message}` : `GW${gw} -> ${path}`);
