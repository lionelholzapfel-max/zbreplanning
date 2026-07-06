import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import { MEMBERS } from '@/data/members';

// POST /api/drere-song/generate - Manually trigger song generation (admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();

    // Only admins can manually trigger (flag en base — l'id '1' codé en dur désignait Benjamin)
    if (!user || user.is_admin !== true) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const weekStart = body.week_start || getLastMondayDate();

    const supabase = getSupabaseAdmin();

    // Get the Drère(s) of the week — une égalité insère une ligne PAR co-Drère,
    // donc pas de .single() (erreur dès qu'il y a deux lignes).
    const { data: drereRows } = await supabase
      .from('daily_awards')
      .select('user_id, points_earned')
      .eq('award_date', weekStart)
      .eq('award_type', 'drere_week');

    const coDreres = ((drereRows || []) as Array<{ user_id: string; points_earned: number }>)
      .map((row) => ({ row, member: MEMBERS.find(m => m.id === row.user_id) }))
      .filter((x) => x.member)
      .sort((a, b) => Number(a.member!.id) - Number(b.member!.id));

    if (coDreres.length === 0) {
      return NextResponse.json({ error: 'No Drère found for this week' }, { status: 404 });
    }

    const drereNames = coDreres.map((x) => x.member!.name.split(' ')[0]);
    const isDuo = drereNames.length > 1;

    // Generate lyrics
    const lyrics = generateLyrics(drereNames.join(' & '), coDreres[0].row.points_earned, isDuo);

    // Create the song record
    const { data: songRecord, error: insertError } = await supabase
      .from('drere_week_songs')
      .upsert({
        week_start_date: weekStart,
        user_id: coDreres[0].row.user_id,
        lyrics,
        status: 'completed', // For now, just lyrics
        updated_at: new Date().toISOString(),
      }, { onConflict: 'week_start_date' })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: 'Erreur création' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Song created with lyrics',
      song: songRecord,
      lyrics,
      drere: {
        name: drereNames.join(' & '),
        points: coDreres[0].row.points_earned,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

function getLastMondayDate(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now.getTime() - diff * 86400000);
  return monday.toISOString().split('T')[0];
}

function generateLyrics(drereName: string, points: number, isDuo: boolean): string {
  // « Drère » se prononce dréré → écrit « Dréré » dans les paroles.
  const verses = [
    `🎤 ${drereName.toUpperCase()} - DRÉRÉ OF THE WEEK 🎤`,
    '',
    `${drereName} ${isDuo ? 'sont les boss, les rois' : 'est le boss, le roi'} de la semaine`,
    `${points} points au compteur, ${isDuo ? 'ce sont eux qui mènent' : "c'est lui qui mène"}`,
    `Pendant que les autres galéraient dans leurs pronos`,
    `${isDuo ? 'Eux ils voyaient clair, tels de vrais héros' : 'Lui il voyait clair, tel un vrai héros'}`,
    '',
    `Score exact par-ci, victoire par-là`,
    `${drereName} ${isDuo ? 'savaient' : 'savait'} déjà comment ça finirait`,
    `Les autres dormaient, ${isDuo ? 'eux ils calculaient' : 'lui il calculait'}`,
    `Le football n'a plus de secret, ${isDuo ? 'ils ont tout raflé' : 'il a tout raflé'}`,
    '',
    `${drereName} Dréré of the Week, personne peut ${isDuo ? 'les' : 'le'} toucher`,
    `${isDuo ? 'Les couronnes sur les têtes, ce sont eux les vrais winners!' : "La couronne sur la tête, c'est lui le vrai winner!"}`,
    `👑 RESPECT 👑`,
  ];

  return verses.join('\n');
}
