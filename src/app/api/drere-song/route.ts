import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import { MEMBERS } from '@/data/members';

interface WeekStats {
  drereId: string;
  drereName: string;
  drerePoints: number;
  mziId: string | null;
  mziName: string | null;
  mziPoints: number | null;
  bestPredictions: Array<{
    match: string;
    predicted: string;
    actual: string;
    points: number;
  }>;
  worstPredictions: Array<{
    userId: string;
    userName: string;
    match: string;
    predicted: string;
    actual: string;
  }>;
}

// GET /api/drere-song?week=YYYY-MM-DD - Get the song for a specific week
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Non connecté' }, { status: 401 });
    }

    const weekStart = request.nextUrl.searchParams.get('week');
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('drere_week_songs')
      .select('*')
      .eq('status', 'completed');

    if (weekStart) {
      query = query.eq('week_start_date', weekStart);
    } else {
      query = query.order('week_start_date', { ascending: false }).limit(1);
    }

    const { data, error } = await query.single();

    if (error || !data) {
      return NextResponse.json({ song: null });
    }

    // Get member info
    const member = MEMBERS.find(m => m.id === data.user_id);

    return NextResponse.json({
      song: {
        ...data,
        member_name: member?.name || 'Unknown',
        member_slug: member?.slug || 'unknown',
      },
    });
  } catch (error) {
    console.error('[DrereSong] GET Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/drere-song/generate - Generate a new song (called by cron or admin)
export async function POST(request: NextRequest) {
  try {
    // This should be called by cron or admin only
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Allow if it's a cron job or admin
    const user = await getSessionUser();
    const isCron = authHeader === `Bearer ${cronSecret}`;
    const isAdmin = user?.id === '1'; // Lionel

    if (!isCron && !isAdmin) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const weekStart = body.week_start || getLastMondayDate();

    const supabase = getSupabaseAdmin();

    // Check if song already exists for this week
    const { data: existingSong } = await supabase
      .from('drere_week_songs')
      .select('id, status')
      .eq('week_start_date', weekStart)
      .single();

    if (existingSong?.status === 'completed') {
      return NextResponse.json({ message: 'Song already exists', song: existingSong });
    }

    // Get the week's stats
    const stats = await getWeekStats(supabase, weekStart);

    if (!stats) {
      return NextResponse.json({ error: 'No Drère found for this week' }, { status: 404 });
    }

    // Generate lyrics
    const lyrics = generateLyrics(stats);

    // Create or update the song record
    const { data: songRecord, error: insertError } = await supabase
      .from('drere_week_songs')
      .upsert({
        week_start_date: weekStart,
        user_id: stats.drereId,
        lyrics,
        status: 'pending',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'week_start_date' })
      .select()
      .single();

    if (insertError) {
      console.error('[DrereSong] Insert error:', insertError);
      return NextResponse.json({ error: 'Erreur création' }, { status: 500 });
    }

    // Trigger Suno AI generation (async - will be updated when complete)
    generateSongWithSuno(songRecord.id, lyrics, stats.drereName).catch(console.error);

    return NextResponse.json({
      message: 'Song generation started',
      song: songRecord,
      lyrics,
    });
  } catch (error) {
    console.error('[DrereSong] POST Error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

function getLastMondayDate(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? 6 : day - 1; // Days since Monday
  const monday = new Date(now.getTime() - diff * 86400000);
  return monday.toISOString().split('T')[0];
}

async function getWeekStats(supabase: ReturnType<typeof getSupabaseAdmin>, weekStart: string): Promise<WeekStats | null> {
  // Get the Drère of the week
  const { data: drereData } = await supabase
    .from('daily_awards')
    .select('user_id, points_earned')
    .eq('award_date', weekStart)
    .eq('award_type', 'drere_week')
    .single();

  if (!drereData) return null;

  const drereMember = MEMBERS.find(m => m.id === drereData.user_id);
  if (!drereMember) return null;

  // Get the week's worst performer (most mzi awards)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  const { data: mziData } = await supabase
    .from('daily_awards')
    .select('user_id')
    .eq('award_type', 'mzi')
    .gte('award_date', weekStart)
    .lte('award_date', weekEndStr);

  // Count mzi per user
  const mziCounts: Record<string, number> = {};
  for (const m of mziData || []) {
    mziCounts[m.user_id] = (mziCounts[m.user_id] || 0) + 1;
  }

  let mziId: string | null = null;
  let mziName: string | null = null;
  let maxMzi = 0;
  for (const [userId, count] of Object.entries(mziCounts)) {
    if (count > maxMzi && userId !== drereData.user_id) {
      maxMzi = count;
      mziId = userId;
      mziName = MEMBERS.find(m => m.id === userId)?.name || null;
    }
  }

  // Get Drère's best predictions of the week
  const { data: predictions } = await supabase
    .from('points_log')
    .select(`
      user_id,
      total_points,
      match_id,
      match_score_predictions!inner(home_score, away_score),
      match_results!inner(home_score, away_score, matches!inner(home_team, away_team, match_date))
    `)
    .eq('user_id', drereData.user_id)
    .gte('match_results.matches.match_date', weekStart)
    .lte('match_results.matches.match_date', weekEndStr)
    .order('total_points', { ascending: false })
    .limit(3);

  const bestPredictions = (predictions || []).map((p: any) => ({
    match: `${p.match_results.matches.home_team} vs ${p.match_results.matches.away_team}`,
    predicted: `${p.match_score_predictions.home_score}-${p.match_score_predictions.away_score}`,
    actual: `${p.match_results.home_score}-${p.match_results.away_score}`,
    points: p.total_points,
  }));

  // Get worst predictions of the week (from anyone)
  const { data: worstPreds } = await supabase
    .from('points_log')
    .select(`
      user_id,
      match_id,
      match_score_predictions!inner(home_score, away_score),
      match_results!inner(home_score, away_score, matches!inner(home_team, away_team, match_date))
    `)
    .eq('total_points', 0)
    .gte('match_results.matches.match_date', weekStart)
    .lte('match_results.matches.match_date', weekEndStr)
    .limit(3);

  const worstPredictions = (worstPreds || []).map((p: any) => {
    const member = MEMBERS.find(m => m.id === p.user_id);
    return {
      userId: p.user_id,
      userName: member?.name || 'Unknown',
      match: `${p.match_results.matches.home_team} vs ${p.match_results.matches.away_team}`,
      predicted: `${p.match_score_predictions.home_score}-${p.match_score_predictions.away_score}`,
      actual: `${p.match_results.home_score}-${p.match_results.away_score}`,
    };
  });

  return {
    drereId: drereData.user_id,
    drereName: drereMember.name.split(' ')[0],
    drerePoints: drereData.points_earned,
    mziId,
    mziName: mziName?.split(' ')[0] || null,
    mziPoints: maxMzi > 0 ? maxMzi : null,
    bestPredictions,
    worstPredictions,
  };
}

function generateLyrics(stats: WeekStats): string {
  const { drereName, drerePoints, mziName, bestPredictions, worstPredictions } = stats;

  // Build dynamic lyrics based on stats
  const verses: string[] = [];

  // Intro/Hook
  verses.push(`${drereName} est le boss, le roi de la semaine`);
  verses.push(`${drerePoints} points au compteur, c'est lui qui mène`);

  // Verse about best predictions
  if (bestPredictions.length > 0) {
    const best = bestPredictions[0];
    verses.push(`Il a prédit ${best.match.split(' vs ')[0]}, score exact ${best.predicted}`);
    verses.push(`Pendant que les autres galéraient, lui il a tout raflé`);
  }

  // Verse about the Mzi (if exists)
  if (mziName) {
    verses.push(`Pendant ce temps ${mziName} dort sur ses pronos`);
    verses.push(`Zéro point zéro gloire, il reste en bas du tableau`);
  }

  // Outro
  verses.push(`${drereName} Drère of the Week, personne peut le toucher`);
  verses.push(`La couronne sur la tête, c'est lui le vrai winner!`);

  return verses.join('\n');
}

async function generateSongWithSuno(songId: number, lyrics: string, drereName: string) {
  const supabase = getSupabaseAdmin();

  try {
    // Update status to generating
    await supabase
      .from('drere_week_songs')
      .update({ status: 'generating', updated_at: new Date().toISOString() })
      .eq('id', songId);

    // Use Goapi.ai Suno wrapper (https://goapi.ai/docs/suno-api)
    const apiKey = process.env.GOAPI_KEY || process.env.SUNO_API_KEY;

    if (!apiKey) {
      console.log('[DrereSong] No API key configured, using lyrics only mode');
      // Mark as completed with just lyrics (no audio)
      await supabase
        .from('drere_week_songs')
        .update({
          status: 'completed',
          error_message: 'Audio generation not configured - lyrics only',
          updated_at: new Date().toISOString()
        })
        .eq('id', songId);
      return;
    }

    // Step 1: Generate the song
    const generateResponse = await fetch('https://api.goapi.ai/v1/suno/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        custom_mode: true,
        input: {
          prompt: lyrics,
          style: 'hip-hop français, rap victoire, énergique, célébration, trap beats',
          title: `${drereName} - Drère of the Week`,
        },
        model: 'chirp-v4',
      }),
    });

    if (!generateResponse.ok) {
      const errorText = await generateResponse.text();
      throw new Error(`Goapi error: ${generateResponse.status} - ${errorText}`);
    }

    const generateResult = await generateResponse.json();
    const taskId = generateResult.data?.task_id;

    if (!taskId) {
      throw new Error('No task_id returned from Goapi');
    }

    console.log('[DrereSong] Generation started, task_id:', taskId);

    // Step 2: Poll for completion (max 2 minutes)
    let audioUrl: string | null = null;
    const maxAttempts = 24; // 24 * 5s = 2 minutes

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

      const statusResponse = await fetch(`https://api.goapi.ai/v1/suno/task/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!statusResponse.ok) continue;

      const statusResult = await statusResponse.json();
      const status = statusResult.data?.status;

      if (status === 'completed') {
        audioUrl = statusResult.data?.output?.audio_url || statusResult.data?.songs?.[0]?.audio_url;
        break;
      } else if (status === 'failed') {
        throw new Error('Song generation failed');
      }
      // Otherwise continue polling
    }

    if (!audioUrl) {
      throw new Error('Timeout waiting for song generation');
    }

    // Update with the audio URL
    await supabase
      .from('drere_week_songs')
      .update({
        status: 'completed',
        audio_url: audioUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', songId);

    console.log('[DrereSong] Song generated successfully:', audioUrl);
  } catch (error: any) {
    console.error('[DrereSong] Generation error:', error);
    await supabase
      .from('drere_week_songs')
      .update({
        status: 'completed', // Still mark as completed so lyrics are visible
        error_message: error.message,
        updated_at: new Date().toISOString()
      })
      .eq('id', songId);
  }
}
