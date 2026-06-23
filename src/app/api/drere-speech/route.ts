import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';

// GET /api/drere-speech?date=YYYY-MM-DD - Get the Drère's speech for a specific date
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Non connecté' }, { status: 401 });
    }

    const date = request.nextUrl.searchParams.get('date');
    if (!date) {
      return NextResponse.json({ error: 'Date requise' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Check if there's a speech for this date
    const { data, error } = await supabase
      .from('drere_speeches')
      .select('*')
      .eq('award_date', date)
      .single();

    if (error || !data) {
      return NextResponse.json({ speech: null });
    }

    // Get public URL for the audio
    const { data: urlData } = supabase.storage
      .from('drere-speeches')
      .getPublicUrl(data.audio_path);

    return NextResponse.json({
      speech: {
        ...data,
        audio_url: urlData?.publicUrl,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/drere-speech - Upload a new Drère speech
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Non connecté' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Get the form data
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const date = formData.get('date') as string;

    if (!audioFile || !date) {
      return NextResponse.json({ error: 'Audio et date requis' }, { status: 400 });
    }

    // Check if user is actually the Drère for this date
    const { data: drereData } = await supabase
      .from('daily_awards')
      .select('user_id')
      .eq('award_date', date)
      .eq('award_type', 'drere')
      .eq('user_id', user.id)
      .single();

    if (!drereData) {
      return NextResponse.json({ error: "Tu n'es pas le Drère de ce jour !" }, { status: 403 });
    }

    // Upload audio to storage
    const fileName = `${date}_${user.id}_${Date.now()}.webm`;
    const { error: uploadError } = await supabase.storage
      .from('drere-speeches')
      .upload(fileName, audioFile, {
        contentType: 'audio/webm',
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json({ error: 'Erreur upload' }, { status: 500 });
    }

    // Delete any existing speech for this date/user
    await supabase
      .from('drere_speeches')
      .delete()
      .eq('award_date', date)
      .eq('user_id', user.id);

    // Save to database
    const { error: dbError } = await supabase
      .from('drere_speeches')
      .insert({
        user_id: user.id,
        award_date: date,
        audio_path: fileName,
      });

    if (dbError) {
      return NextResponse.json({ error: 'Erreur sauvegarde' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
