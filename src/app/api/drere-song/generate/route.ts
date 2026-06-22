import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import { MEMBERS } from '@/data/members';

// POST /api/drere-song/generate - Manually trigger song generation (admin only)
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();

    // Only Lionel (admin) can manually trigger
    if (!user || user.id !== '1') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const weekStart = body.week_start || getLastMondayDate();

    const supabase = getSupabaseAdmin();

    // Get the Drère of the week
    const { data: drereData } = await supabase
      .from('daily_awards')
      .select('user_id, points_earned')
      .eq('award_date', weekStart)
      .eq('award_type', 'drere_week')
      .single();

    if (!drereData) {
      return NextResponse.json({ error: 'No Drère found for this week' }, { status: 404 });
    }

    const drereMember = MEMBERS.find(m => m.id === drereData.user_id);
    if (!drereMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Generate lyrics
    const lyrics = generateLyrics(drereMember.name.split(' ')[0], drereData.points_earned);

    // Create the song record
    const { data: songRecord, error: insertError } = await supabase
      .from('drere_week_songs')
      .upsert({
        week_start_date: weekStart,
        user_id: drereData.user_id,
        lyrics,
        status: 'completed', // For now, just lyrics
        updated_at: new Date().toISOString(),
      }, { onConflict: 'week_start_date' })
      .select()
      .single();

    if (insertError) {
      console.error('[DrereSong] Insert error:', insertError);
      return NextResponse.json({ error: 'Erreur création' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Song created with lyrics',
      song: songRecord,
      lyrics,
      drere: {
        name: drereMember.name,
        points: drereData.points_earned,
      },
    });
  } catch (error) {
    console.error('[DrereSong] Generate error:', error);
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

function generateLyrics(drereName: string, points: number): string {
  const verses = [
    `🎤 ${drereName.toUpperCase()} - DRÈRE OF THE WEEK 🎤`,
    '',
    `${drereName} est le boss, le roi de la semaine`,
    `${points} points au compteur, c'est lui qui mène`,
    `Pendant que les autres galéraient dans leurs pronos`,
    `Lui il voyait clair, tel un vrai héros`,
    '',
    `Score exact par-ci, victoire par-là`,
    `${drereName} savait déjà comment ça finirait`,
    `Les autres dormaient, lui il calculait`,
    `Le football n'a plus de secret, il a tout raflé`,
    '',
    `${drereName} Drère of the Week, personne peut le toucher`,
    `La couronne sur la tête, c'est lui le vrai winner!`,
    `👑 RESPECT 👑`,
  ];

  return verses.join('\n');
}
