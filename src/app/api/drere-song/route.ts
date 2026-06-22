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

    // Trigger DiffRhythm AI generation (async - will be updated when complete)
    generateSongWithDiffRhythm(songRecord.id, lyrics, stats.drereName).catch(console.error);

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

  // Multiple song structures for variety
  const structures = [
    generateHipHopLyrics,
    generateRockAnthemLyrics,
    generatePopCelebrationLyrics,
    generateEpicOrchestraLyrics,
  ];

  // Pick a random structure based on week date hash
  const weekHash = stats.drereId.charCodeAt(0) + drerePoints;
  const structureIndex = weekHash % structures.length;

  return structures[structureIndex](stats);
}

function generateHipHopLyrics(stats: WeekStats): string {
  const { drereName, drerePoints, mziName, worstPredictions } = stats;
  const lines: string[] = [];

  lines.push(`[00:00.00] Yeah yeah its ${drereName}!`);
  lines.push(`[00:03.00] Drere of the Week lets go!`);
  lines.push(`[00:06.00] ${drereName} is the king the boss of the week`);
  lines.push(`[00:09.00] ${drerePoints} points on the board hes at his peak`);
  lines.push(`[00:12.00] While yall were sleeping on predictions`);
  lines.push(`[00:15.00] He saw it all clear no contradictions`);
  lines.push(`[00:18.00] Called every match with precision and grace`);
  lines.push(`[00:21.00] Left all the haters in last place`);
  lines.push(`[00:24.00] ${drereName} Drere of the Week crown on his head`);
  lines.push(`[00:27.00] Rest of yall should have stayed in bed`);

  if (mziName) {
    lines.push(`[00:30.00] ${mziName} out here catching Ls all day`);
    lines.push(`[00:33.00] Zero points bro just stay away`);
  }

  if (worstPredictions.length > 0) {
    const roast = worstPredictions[0];
    const firstName = roast.userName.split(' ')[0];
    lines.push(`[00:36.00] ${firstName} predicted ${roast.predicted} it ended ${roast.actual}`);
    lines.push(`[00:39.00] Bro needs glasses thats factual`);
  }

  lines.push(`[00:42.00] But ${drereName} saw the future like a prophet supreme`);
  lines.push(`[00:45.00] Living the glory living the dream`);
  lines.push(`[00:48.00] Drere of the Week put respect on the name`);
  lines.push(`[00:51.00] ${drereName} runs this game!`);

  return lines.join('\n');
}

function generateRockAnthemLyrics(stats: WeekStats): string {
  const { drereName, drerePoints, mziName, worstPredictions } = stats;
  const lines: string[] = [];

  lines.push(`[00:00.00] Ladies and gentlemen`);
  lines.push(`[00:03.00] Your champion has arrived`);
  lines.push(`[00:06.00] ${drereName} standing tall above them all`);
  lines.push(`[00:09.00] ${drerePoints} points of pure glory`);
  lines.push(`[00:12.00] They tried to beat him but they failed`);
  lines.push(`[00:15.00] Victory was never in doubt`);
  lines.push(`[00:18.00] He called the scores before they happened`);
  lines.push(`[00:21.00] The oracle of football has spoken`);
  lines.push(`[00:24.00] ${drereName} Drere of the Week`);
  lines.push(`[00:27.00] Untouchable unstoppable`);

  if (mziName) {
    lines.push(`[00:30.00] While ${mziName} crashed and burned`);
    lines.push(`[00:33.00] Zero points nothing learned`);
  }

  if (worstPredictions.length > 0) {
    const roast = worstPredictions[0];
    const firstName = roast.userName.split(' ')[0];
    lines.push(`[00:36.00] ${firstName} with the terrible call`);
    lines.push(`[00:39.00] Watching champions while losers fall`);
  }

  lines.push(`[00:42.00] So raise your hands for the king`);
  lines.push(`[00:45.00] ${drereName} makes the stadium sing`);
  lines.push(`[00:48.00] Drere of the Week forever reign`);
  lines.push(`[00:51.00] ${drereName} owns this game!`);

  return lines.join('\n');
}

function generatePopCelebrationLyrics(stats: WeekStats): string {
  const { drereName, drerePoints, mziName, worstPredictions } = stats;
  const lines: string[] = [];

  lines.push(`[00:00.00] Celebrating tonight`);
  lines.push(`[00:03.00] ${drereName} in the spotlight`);
  lines.push(`[00:06.00] Oh ${drereName} you did it again`);
  lines.push(`[00:09.00] ${drerePoints} points you are the champion`);
  lines.push(`[00:12.00] Dancing through the predictions`);
  lines.push(`[00:15.00] Perfect scores no contradictions`);
  lines.push(`[00:18.00] Every match you saw it coming`);
  lines.push(`[00:21.00] While the others kept on stumbling`);
  lines.push(`[00:24.00] ${drereName} oh ${drereName}`);
  lines.push(`[00:27.00] Drere of the Week hooray`);

  if (mziName) {
    lines.push(`[00:30.00] Sorry ${mziName} not your day`);
    lines.push(`[00:33.00] Maybe next time find a way`);
  }

  if (worstPredictions.length > 0) {
    const roast = worstPredictions[0];
    const firstName = roast.userName.split(' ')[0];
    lines.push(`[00:36.00] ${firstName} oh what happened there`);
    lines.push(`[00:39.00] ${roast.predicted} prediction wasnt fair`);
  }

  lines.push(`[00:42.00] But tonight we celebrate`);
  lines.push(`[00:45.00] ${drereName} you are so great`);
  lines.push(`[00:48.00] Drere of the Week its your time to shine`);
  lines.push(`[00:51.00] ${drereName} youre so fine!`);

  return lines.join('\n');
}

function generateEpicOrchestraLyrics(stats: WeekStats): string {
  const { drereName, drerePoints, mziName, worstPredictions } = stats;
  const lines: string[] = [];

  lines.push(`[00:00.00] In the realm of predictions`);
  lines.push(`[00:04.00] A legend rises`);
  lines.push(`[00:08.00] ${drereName} the chosen one ascends`);
  lines.push(`[00:12.00] With ${drerePoints} points of pure dominance`);
  lines.push(`[00:16.00] The prophecy has been fulfilled`);
  lines.push(`[00:20.00] Every score foretold with precision`);
  lines.push(`[00:24.00] Mortals tremble at his wisdom`);
  lines.push(`[00:28.00] ${drereName} Drere of the Week`);

  if (mziName) {
    lines.push(`[00:32.00] ${mziName} fell into darkness`);
    lines.push(`[00:36.00] Zero glory zero light`);
  }

  if (worstPredictions.length > 0) {
    const roast = worstPredictions[0];
    const firstName = roast.userName.split(' ')[0];
    lines.push(`[00:40.00] ${firstName} wandered lost and blind`);
    lines.push(`[00:44.00] Predicting ${roast.predicted} out of mind`);
  }

  lines.push(`[00:48.00] But ${drereName} saw through time`);
  lines.push(`[00:52.00] The oracle supreme divine`);
  lines.push(`[00:56.00] All hail the Drere of the Week`);
  lines.push(`[01:00.00] ${drereName} the glory you seek!`);

  return lines.join('\n');
}

async function generateSongWithDiffRhythm(songId: number, lyrics: string, drereName: string) {
  const supabase = getSupabaseAdmin();

  try {
    // Update status to generating
    await supabase
      .from('drere_week_songs')
      .update({ status: 'generating', updated_at: new Date().toISOString() })
      .eq('id', songId);

    // Use Goapi.ai DiffRhythm API (faster & cheaper than Suno)
    const apiKey = process.env.GOAPI_KEY;

    if (!apiKey) {
      console.log('[DrereSong] No GOAPI_KEY configured, using lyrics only mode');
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

    // Step 1: Create the song generation task
    // DiffRhythm API via GoAPI - POST https://api.goapi.ai/api/v1/task
    const generateResponse = await fetch('https://api.goapi.ai/api/v1/task', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'Qubico/diffrhythm',
        task_type: 'txt2audio-base',
        input: {
          lyrics: lyrics,
          style_prompt: 'hip-hop français, rap victoire, trap énergique, célébration sportive',
        },
        config: {},
      }),
    });

    if (!generateResponse.ok) {
      const errorText = await generateResponse.text();
      throw new Error(`DiffRhythm error: ${generateResponse.status} - ${errorText}`);
    }

    const generateResult = await generateResponse.json();
    const taskId = generateResult.data?.task_id || generateResult.task_id;

    if (!taskId) {
      // Maybe it returned the audio directly?
      const directUrl = generateResult.data?.audio_url || generateResult.audio_url;
      if (directUrl) {
        await supabase
          .from('drere_week_songs')
          .update({
            status: 'completed',
            audio_url: directUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', songId);
        console.log('[DrereSong] Song generated directly:', directUrl);
        return;
      }
      throw new Error('No task_id or audio_url returned');
    }

    console.log('[DrereSong] Generation started, task_id:', taskId);

    // Step 2: Poll for completion (max 2 minutes)
    let audioUrl: string | null = null;
    const maxAttempts = 24; // 24 * 5s = 2 minutes

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

      const statusResponse = await fetch(`https://api.goapi.ai/api/v1/task/${taskId}`, {
        headers: {
          'x-api-key': apiKey,
        },
      });

      if (!statusResponse.ok) continue;

      const statusResult = await statusResponse.json();
      const status = statusResult.data?.status;

      console.log('[DrereSong] Poll status:', status, 'attempt:', i + 1);

      if (status === 'completed') {
        // Output contains the audio URL
        audioUrl = statusResult.data?.output?.audio_url || statusResult.data?.output?.url;
        break;
      } else if (status === 'failed') {
        throw new Error('Song generation failed: ' + (statusResult.data?.error?.message || 'Unknown error'));
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
// Trigger redeploy 1782159272
