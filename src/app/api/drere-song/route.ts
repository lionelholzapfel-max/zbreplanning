import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getSupabaseAdmin } from '@/lib/auth/session';
import { MEMBERS } from '@/data/members';

// Import matches data
const matchesData = require('@/data/matches.json') as Array<{
  id: number;
  match: string;
  date: string;
  dateDisplay: string;
  time: string;
  stadium: string;
  city: string;
  phase: string;
  group?: string;
}>;

interface MatchInfo {
  id: number;
  match: string;
  date: string;
}

interface WeekStats {
  drereId: string;
  drereName: string;
  drerePoints: number;
  // Gros coup de la semaine
  grosCoup: {
    matchName: string;
    predictedScore: string;
    actualScore: string;
    points: number;
    countries: string[];
  } | null;
  // Stats de la semaine
  exactScoresThisWeek: number;
  drereJourCount: number;
  // Pires performers actifs
  worstActivePerformers: Array<{
    name: string;
    points: number;
  }>;
  // Pour le roast
  mziName: string | null;
  // Style musique basé sur le gros coup
  musicStyle: string;
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
    // Pass the music style based on the "gros coup" country
    generateSongWithDiffRhythm(songRecord.id, lyrics, stats.drereName, stats.musicStyle).catch(console.error);

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

// Map countries to music styles
const COUNTRY_MUSIC_STYLES: Record<string, string> = {
  'Mexique': 'latin trap mariachi energetic',
  'Brésil': 'brazilian funk samba party',
  'Argentine': 'tango latin passionate',
  'France': 'french rap hip-hop energetic',
  'Espagne': 'reggaeton flamenco spanish',
  'Angleterre': 'uk grime british rap',
  'Allemagne': 'techno electronic powerful',
  'Italie': 'italian pop melodic',
  'Portugal': 'portuguese fado modern',
  'Pays-Bas': 'dutch edm electronic dance',
  'Belgique': 'belgian techno electronic',
  'Corée du Sud': 'k-pop energetic modern',
  'Japon': 'j-pop electronic anime',
  'USA': 'american hip-hop trap',
  'États-Unis': 'american hip-hop trap',
  'Afrique du Sud': 'afrobeat amapiano',
  'Maroc': 'arabic gnawa fusion',
  'Sénégal': 'afrobeat mbalax',
  'Nigeria': 'afrobeats highlife',
  'Cameroun': 'makossa afrobeat',
  'Colombie': 'reggaeton cumbia',
  'Croatie': 'balkan electronic',
  'Serbie': 'balkan turbo folk',
};

function getMatchInfo(matchId: number): MatchInfo | null {
  const match = (matchesData as any[]).find(m => m.id === matchId);
  if (!match) return null;
  return {
    id: match.id,
    match: match.match,
    date: match.date,
  };
}

function extractCountries(matchName: string): string[] {
  // Format: "Pays1 - Pays2"
  const parts = matchName.split(' - ');
  return parts.map(p => p.trim());
}

function getMusicStyleForCountries(countries: string[]): string {
  for (const country of countries) {
    if (COUNTRY_MUSIC_STYLES[country]) {
      return COUNTRY_MUSIC_STYLES[country];
    }
  }
  return 'hip-hop trap energetic victory anthem';
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

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  // 1. Get Drère's GROS COUP (best prediction with most points)
  const { data: bestPrediction } = await supabase
    .from('points_log')
    .select('match_id, total_points, detail')
    .eq('user_id', drereData.user_id)
    .gte('created_at', weekStart)
    .lt('created_at', weekEndStr + 'T23:59:59')
    .order('total_points', { ascending: false })
    .limit(1)
    .single();

  let grosCoup: WeekStats['grosCoup'] = null;
  let musicStyle = 'hip-hop trap energetic victory anthem male rapper';

  if (bestPrediction) {
    const matchInfo = getMatchInfo(bestPrediction.match_id);
    if (matchInfo) {
      // Get the prediction details
      const { data: predDetails } = await supabase
        .from('match_score_predictions')
        .select('home_score, away_score')
        .eq('user_id', drereData.user_id)
        .eq('match_id', bestPrediction.match_id)
        .single();

      const { data: resultDetails } = await supabase
        .from('match_results')
        .select('home_score, away_score')
        .eq('match_id', bestPrediction.match_id)
        .single();

      const countries = extractCountries(matchInfo.match);
      musicStyle = getMusicStyleForCountries(countries);

      grosCoup = {
        matchName: matchInfo.match,
        predictedScore: predDetails ? `${predDetails.home_score}-${predDetails.away_score}` : '?-?',
        actualScore: resultDetails ? `${resultDetails.home_score}-${resultDetails.away_score}` : '?-?',
        points: bestPrediction.total_points,
        countries,
      };
    }
  }

  // 2. Count exact scores this week
  const { data: exactScores } = await supabase
    .from('points_log')
    .select('id')
    .eq('user_id', drereData.user_id)
    .gte('created_at', weekStart)
    .lt('created_at', weekEndStr + 'T23:59:59')
    .eq('total_points', 3);

  const exactScoresThisWeek = exactScores?.length || 0;

  // 3. Count Drère du jour appearances this week
  const { data: drereJours } = await supabase
    .from('daily_awards')
    .select('id')
    .eq('user_id', drereData.user_id)
    .eq('award_type', 'drere_jour')
    .gte('award_date', weekStart)
    .lte('award_date', weekEndStr);

  const drereJourCount = drereJours?.length || 0;

  // 4. Get active players (last 3 days) with worst performance this week
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const threeDaysAgoStr = threeDaysAgo.toISOString();

  const { data: activeUsers } = await supabase
    .from('match_score_predictions')
    .select('user_id')
    .gte('created_at', threeDaysAgoStr);

  const activeUserIds = Array.from(new Set((activeUsers || []).map(u => u.user_id))) as string[];

  // Get week totals for active users (excluding drère)
  const { data: weekTotals } = await supabase
    .from('points_log')
    .select('user_id, total_points')
    .in('user_id', activeUserIds.filter(id => id !== drereData.user_id))
    .gte('created_at', weekStart)
    .lt('created_at', weekEndStr + 'T23:59:59');

  // Sum points per user
  const userPoints: Record<string, number> = {};
  for (const log of weekTotals || []) {
    userPoints[log.user_id] = (userPoints[log.user_id] || 0) + log.total_points;
  }

  // Sort by points (ascending = worst first)
  const sortedWorst = Object.entries(userPoints)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([userId, points]) => ({
      name: MEMBERS.find(m => m.id === userId)?.name.split(' ')[0] || 'Unknown',
      points,
    }));

  // 5. Get Type Mzi (most mzi awards this week)
  const { data: mziData } = await supabase
    .from('daily_awards')
    .select('user_id')
    .eq('award_type', 'mzi')
    .gte('award_date', weekStart)
    .lte('award_date', weekEndStr);

  const mziCounts: Record<string, number> = {};
  for (const m of mziData || []) {
    mziCounts[m.user_id] = (mziCounts[m.user_id] || 0) + 1;
  }

  let mziName: string | null = null;
  let maxMzi = 0;
  for (const [userId, count] of Object.entries(mziCounts)) {
    if (count > maxMzi && userId !== drereData.user_id) {
      maxMzi = count;
      mziName = MEMBERS.find(m => m.id === userId)?.name.split(' ')[0] || null;
    }
  }

  return {
    drereId: drereData.user_id,
    drereName: drereMember.name.split(' ')[0],
    drerePoints: drereData.points_earned,
    grosCoup,
    exactScoresThisWeek,
    drereJourCount,
    worstActivePerformers: sortedWorst,
    mziName,
    musicStyle,
  };
}

function generateLyrics(stats: WeekStats): string {
  const { drereName, drerePoints } = stats;

  // Multiple song structures for variety
  const structures = [
    generateHipHopLyrics,
    generateRockAnthemLyrics,
    generateGrosCoupLyrics,
    generateChampionStatsLyrics,
  ];

  // Pick structure based on week hash for variety
  const weekHash = stats.drereId.charCodeAt(0) + drerePoints;
  const structureIndex = weekHash % structures.length;

  return structures[structureIndex](stats);
}

// Structure 1: Hip-hop classique avec roast des perdants
function generateHipHopLyrics(stats: WeekStats): string {
  const { drereName, drerePoints, grosCoup, exactScoresThisWeek, worstActivePerformers, mziName } = stats;
  const lines: string[] = [];

  lines.push(`[00:00.00] Yeah yeah its ${drereName}!`);
  lines.push(`[00:03.00] Drere of the Week lets go!`);
  lines.push(`[00:06.00] ${drereName} got ${drerePoints} points this week he the king`);

  // Mention worst performers
  if (worstActivePerformers.length >= 2) {
    const [worst1, worst2] = worstActivePerformers;
    lines.push(`[00:09.00] While ${worst1.name} and ${worst2.name} cant do a thing`);
    lines.push(`[00:12.00] Only ${worst1.points} points thats embarrassing yo`);
  } else {
    lines.push(`[00:09.00] While the others falling behind`);
    lines.push(`[00:12.00] ${drereName} saw it coming every time`);
  }

  lines.push(`[00:15.00] ${drereName} saw the future now everybody knows`);

  // Gros coup mention
  if (grosCoup) {
    const countries = grosCoup.countries;
    lines.push(`[00:18.00] Called ${countries[0]} ${grosCoup.predictedScore} exact score`);
    lines.push(`[00:21.00] The prophet predicted it all and more`);
  } else {
    lines.push(`[00:18.00] Called every match with precision supreme`);
    lines.push(`[00:21.00] Living the glory living the dream`);
  }

  lines.push(`[00:24.00] ${drereName} Drere of the Week crown on his head`);

  if (worstActivePerformers.length >= 2) {
    lines.push(`[00:27.00] ${worstActivePerformers[0].name} and ${worstActivePerformers[1].name} should have stayed in bed`);
  } else {
    lines.push(`[00:27.00] Rest of yall should have stayed in bed`);
  }

  // Exact scores flex
  if (exactScoresThisWeek > 0) {
    lines.push(`[00:30.00] ${exactScoresThisWeek} exact scores this week no debate`);
    lines.push(`[00:33.00] ${drereName} sees the future he dont hesitate`);
  }

  // Mzi roast
  if (mziName) {
    lines.push(`[00:36.00] ${mziName} catching Ls all day long`);
    lines.push(`[00:39.00] Zero points bro your predictions wrong`);
  }

  lines.push(`[00:42.00] Drere of the Week respect the crown`);
  lines.push(`[00:45.00] ${drereName} runs this game he runs this town!`);

  return lines.join('\n');
}

// Structure 2: Rock anthem épique
function generateRockAnthemLyrics(stats: WeekStats): string {
  const { drereName, drerePoints, grosCoup, drereJourCount, worstActivePerformers, mziName } = stats;
  const lines: string[] = [];

  lines.push(`[00:00.00] Ladies and gentlemen`);
  lines.push(`[00:03.00] Your champion has arrived`);
  lines.push(`[00:06.00] ${drereName} standing tall above them all`);
  lines.push(`[00:09.00] ${drerePoints} points of pure glory`);

  // Drère du jour mentions
  if (drereJourCount > 0) {
    lines.push(`[00:12.00] Drere du jour ${drereJourCount} times this week`);
    lines.push(`[00:15.00] Unstoppable force they could not compete`);
  } else {
    lines.push(`[00:12.00] They tried to beat him but they failed`);
    lines.push(`[00:15.00] Victory was never in doubt`);
  }

  // Gros coup
  if (grosCoup) {
    lines.push(`[00:18.00] ${grosCoup.matchName} he called it right`);
    lines.push(`[00:21.00] ${grosCoup.predictedScore} exact score what a sight`);
  } else {
    lines.push(`[00:18.00] He called the scores before they happened`);
    lines.push(`[00:21.00] The oracle of football has spoken`);
  }

  lines.push(`[00:24.00] ${drereName} Drere of the Week`);
  lines.push(`[00:27.00] Untouchable unstoppable`);

  if (worstActivePerformers.length > 0) {
    const worst = worstActivePerformers[0];
    lines.push(`[00:30.00] While ${worst.name} only got ${worst.points}`);
    lines.push(`[00:33.00] Thats nothing compared to ${drereName}s joints`);
  }

  if (mziName) {
    lines.push(`[00:36.00] ${mziName} crashed and burned today`);
    lines.push(`[00:39.00] Zero points he should just stay away`);
  }

  lines.push(`[00:42.00] So raise your hands for the king`);
  lines.push(`[00:45.00] ${drereName} makes the stadium sing`);
  lines.push(`[00:48.00] Drere of the Week forever reign`);
  lines.push(`[00:51.00] ${drereName} owns this game!`);

  return lines.join('\n');
}

// Structure 3: Focus sur le GROS COUP de la semaine
function generateGrosCoupLyrics(stats: WeekStats): string {
  const { drereName, drerePoints, grosCoup, exactScoresThisWeek, worstActivePerformers } = stats;
  const lines: string[] = [];

  lines.push(`[00:00.00] Listen up everybody`);
  lines.push(`[00:03.00] ${drereName} got the vision`);

  if (grosCoup) {
    lines.push(`[00:06.00] The match was ${grosCoup.matchName}`);
    lines.push(`[00:09.00] Everybody said they knew the game`);
    lines.push(`[00:12.00] But ${drereName} called it ${grosCoup.predictedScore}`);
    lines.push(`[00:15.00] Exact score he knew for sure`);
    lines.push(`[00:18.00] ${grosCoup.countries[0]} versus ${grosCoup.countries[1] || 'the rest'}`);
    lines.push(`[00:21.00] ${drereName} predictions are the best`);
  } else {
    lines.push(`[00:06.00] Every match he called it clean`);
    lines.push(`[00:09.00] Best predictor youve ever seen`);
    lines.push(`[00:12.00] While others guessing in the dark`);
    lines.push(`[00:15.00] ${drereName} hits the mark`);
    lines.push(`[00:18.00] Prophet vision crystal clear`);
    lines.push(`[00:21.00] Thats why ${drereName} is here`);
  }

  lines.push(`[00:24.00] ${drerePoints} points for the week`);
  lines.push(`[00:27.00] ${drereName} Drere of the Week`);

  if (exactScoresThisWeek > 1) {
    lines.push(`[00:30.00] Not one but ${exactScoresThisWeek} exact scores`);
    lines.push(`[00:33.00] ${drereName} opens all the doors`);
  }

  if (worstActivePerformers.length >= 2) {
    lines.push(`[00:36.00] ${worstActivePerformers[0].name} got ${worstActivePerformers[0].points} its a shame`);
    lines.push(`[00:39.00] ${worstActivePerformers[1].name} ${worstActivePerformers[1].points} points just the same`);
  }

  lines.push(`[00:42.00] But ${drereName} different level you know`);
  lines.push(`[00:45.00] Drere of the Week stealing the show!`);

  return lines.join('\n');
}

// Structure 4: Stats champion avec toutes les données
function generateChampionStatsLyrics(stats: WeekStats): string {
  const { drereName, drerePoints, grosCoup, exactScoresThisWeek, drereJourCount, worstActivePerformers, mziName } = stats;
  const lines: string[] = [];

  lines.push(`[00:00.00] Stats dont lie check the facts`);
  lines.push(`[00:03.00] ${drereName} got the impact`);
  lines.push(`[00:06.00] ${drerePoints} points total for the week`);

  if (exactScoresThisWeek > 0) {
    lines.push(`[00:09.00] ${exactScoresThisWeek} exact scores he got technique`);
  } else {
    lines.push(`[00:09.00] Consistency at its peak`);
  }

  if (drereJourCount > 0) {
    lines.push(`[00:12.00] Drere du jour ${drereJourCount} times awarded`);
    lines.push(`[00:15.00] Competition left discarded`);
  } else {
    lines.push(`[00:12.00] Day by day he built the lead`);
    lines.push(`[00:15.00] ${drereName} got everything he need`);
  }

  if (grosCoup) {
    lines.push(`[00:18.00] MVP prediction ${grosCoup.matchName}`);
    lines.push(`[00:21.00] ${grosCoup.predictedScore} exact score hall of fame`);
  } else {
    lines.push(`[00:18.00] Every prediction on point`);
    lines.push(`[00:21.00] ${drereName} running the joint`);
  }

  lines.push(`[00:24.00] Now lets talk about the rest`);

  if (worstActivePerformers.length >= 2) {
    lines.push(`[00:27.00] ${worstActivePerformers[0].name} ${worstActivePerformers[0].points} points not impressed`);
    lines.push(`[00:30.00] ${worstActivePerformers[1].name} ${worstActivePerformers[1].points} didnt pass the test`);
  }

  if (mziName) {
    lines.push(`[00:33.00] ${mziName} is Type Mzi this week`);
    lines.push(`[00:36.00] Zero game predictions weak`);
  }

  lines.push(`[00:39.00] But ${drereName} stands on top`);
  lines.push(`[00:42.00] The king who never stops`);
  lines.push(`[00:45.00] Drere of the Week no debate`);
  lines.push(`[00:48.00] ${drereName} is truly great!`);

  return lines.join('\n');
}

async function generateSongWithDiffRhythm(songId: number, lyrics: string, drereName: string, musicStyle: string) {
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
          // Dynamic music style based on the "gros coup" country
          style_prompt: musicStyle,
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
