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

// « Drère » se prononce dréré : dans les PAROLES (chantées en français), on
// l'écrit phonétiquement « Dréré » pour que Suno le prononce juste.
// Les titres de chansons et l'UI gardent l'orthographe officielle « Drère ».
const SUNG_DRERE = 'Dréré';

interface WeekStats {
  drereId: string;
  drereName: string;
  /** Tous les co-Drères en cas d'égalité (1 entrée sinon). */
  drereIds: string[];
  drereNames: string[];
  isDuo: boolean;
  drerePoints: number;
  // Gros coup de la semaine
  grosCoup: {
    matchName: string;
    predictedScore: string;
    actualScore: string;
    points: number;
    countries: string[];
    /** Prénom de l'auteur (utile quand il y a deux Drères). */
    author: string;
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
    const isAdmin = user?.is_admin === true; // le flag en base — l'id '1' codé en dur désignait Benjamin, pas Lionel

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

    // Paroles de secours (gabarits) — affichées en attendant, remplacées par
    // celles écrites par Suno à la complétion ; utilisées si Suno échoue.
    const lyrics = generateLyrics(stats);
    const brief = buildSongBrief(stats);

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
      return NextResponse.json({ error: 'Erreur création' }, { status: 500 });
    }

    // Trigger Suno AI generation (async - will be updated when complete)
    // Fire and forget - don't await, let it run in background
    generateSongWithSuno(
      songRecord.id,
      brief,
      lyrics,
      stats.drereName,
      stats.musicStyle
    ).catch(err => console.error('Suno generation error:', err));

    return NextResponse.json({
      message: 'Song generation started with Suno AI',
      song: songRecord,
      lyrics,
      musicStyle: stats.musicStyle,
    });
  } catch (error) {
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
  return 'french hip-hop trap energetic victory anthem';
}

async function getWeekStats(supabase: ReturnType<typeof getSupabaseAdmin>, weekStart: string): Promise<WeekStats | null> {
  // Get the Drère(s) of the week — une égalité insère une ligne PAR co-Drère,
  // donc pas de .single() (il jette une erreur dès qu'il y a deux lignes).
  const { data: drereRows } = await supabase
    .from('daily_awards')
    .select('user_id, points_earned')
    .eq('award_date', weekStart)
    .eq('award_type', 'drere_week');

  const coDreres = ((drereRows || []) as Array<{ user_id: string; points_earned: number }>)
    .map((row) => ({ row, member: MEMBERS.find(m => m.id === row.user_id) }))
    .filter((x) => x.member)
    .sort((a, b) => Number(a.member!.id) - Number(b.member!.id)); // ordre déterministe

  if (coDreres.length === 0) return null;

  const drereIds = coDreres.map((x) => x.row.user_id);
  const drereNames = coDreres.map((x) => x.member!.name.split(' ')[0]);
  const isDuo = drereNames.length > 1;

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  // 1. Get Drère's GROS COUP (best prediction with most points)
  const { data: bestPrediction } = await supabase
    .from('points_log')
    .select('user_id, match_id, total_points, detail')
    .in('user_id', drereIds)
    .gte('created_at', weekStart)
    .lt('created_at', weekEndStr + 'T23:59:59')
    .order('total_points', { ascending: false })
    .limit(1)
    .maybeSingle();

  let grosCoup: WeekStats['grosCoup'] = null;
  let musicStyle = 'french hip-hop trap energetic victory anthem, male french rapper';

  if (bestPrediction) {
    const matchInfo = getMatchInfo(bestPrediction.match_id);
    if (matchInfo) {
      // Get the prediction details
      const { data: predDetails } = await supabase
        .from('match_score_predictions')
        .select('home_score, away_score')
        .eq('user_id', bestPrediction.user_id)
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
        author: MEMBERS.find(m => m.id === bestPrediction.user_id)?.name.split(' ')[0] || drereNames[0],
      };
    }
  }

  // 2. Count exact scores this week
  const { data: exactScores } = await supabase
    .from('points_log')
    .select('id')
    .in('user_id', drereIds)
    .gte('created_at', weekStart)
    .lt('created_at', weekEndStr + 'T23:59:59')
    .eq('total_points', 3);

  const exactScoresThisWeek = exactScores?.length || 0;

  // 3. Count Drère du jour appearances this week
  const { data: drereJours } = await supabase
    .from('daily_awards')
    .select('id')
    .in('user_id', drereIds)
    .eq('award_type', 'drere') // 'drere_jour' n'existe pas en base — la stat revenait toujours vide
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
    .in('user_id', activeUserIds.filter(id => !drereIds.includes(id)))
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
    if (count > maxMzi && !drereIds.includes(userId)) {
      maxMzi = count;
      mziName = MEMBERS.find(m => m.id === userId)?.name.split(' ')[0] || null;
    }
  }

  return {
    drereId: drereIds[0],
    drereName: drereNames.join(' & '),
    drereIds,
    drereNames,
    isDuo,
    drerePoints: coDreres[0].row.points_earned, // égalité : même total pour tous
    grosCoup,
    exactScoresThisWeek,
    drereJourCount,
    worstActivePerformers: sortedWorst,
    mziName,
    musicStyle,
  };
}

/**
 * Brief pour Suno en mode non-custom (customMode: false) : on donne le CONTEXTE
 * de la semaine (≤ 500 caractères, limite API) et Suno écrit lui-même des
 * paroles différentes à chaque fois — puis les chante. Le style musical par
 * pays est glissé dans le brief (le champ style est interdit en non-custom).
 */
function buildSongBrief(stats: WeekStats): string {
  const { drereName, drerePoints, grosCoup, worstActivePerformers, mziName, isDuo, musicStyle } = stats;
  const parts: string[] = [];
  parts.push(`Style musical : ${musicStyle}.`);
  parts.push(
    `Chanson de vestiaire 100% en FRANÇAIS pour ${drereName}, « Dréré of the Week » — ${isDuo ? 'les rois' : 'le roi'} de la semaine des pronostics Coupe du Monde 2026 de la Zbre Team (${drerePoints} points).`
  );
  if (grosCoup) {
    parts.push(`Gros coup : ${grosCoup.author} a prédit le score exact ${grosCoup.predictedScore} sur ${grosCoup.matchName}.`);
  }
  const roasts: string[] = [];
  if (worstActivePerformers.length > 0) {
    roasts.push(worstActivePerformers.slice(0, 2).map((w) => `${w.name} (${w.points} pts)`).join(' et '));
  }
  if (mziName) roasts.push(`${mziName} le « Mzi » de la semaine`);
  if (roasts.length > 0) parts.push(`Chambre gentiment ${roasts.join(', et ')}.`);
  parts.push(`Écris toujours « Dréré » (prononcé dréré). Ton chambreur entre potes, drôle, jamais méchant.`);
  let brief = parts.join(' ');
  if (brief.length > 500) brief = brief.slice(0, 497) + '…';
  return brief;
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

// Structure 1: Hip-hop classique avec roast des perdants (paroles en français)
function generateHipHopLyrics(stats: WeekStats): string {
  const { drereName, drerePoints, grosCoup, exactScoresThisWeek, worstActivePerformers, mziName, isDuo } = stats;
  const lines: string[] = [];

  lines.push(`[00:00.00] Ouais ouais c'est ${drereName}!`);
  lines.push(`[00:03.00] ${SUNG_DRERE} of the Week c'est parti`);
  lines.push(`[00:06.00] ${drereName} ${drerePoints} points cette semaine ${isDuo ? 'ce sont les rois' : "c'est le roi"}`);

  if (worstActivePerformers.length >= 2) {
    const [worst1, worst2] = worstActivePerformers;
    lines.push(`[00:09.00] Pendant que ${worst1.name} et ${worst2.name} touchent le fond`);
    lines.push(`[00:12.00] ${worst1.points} petits points la honte à la maison`);
  } else {
    lines.push(`[00:09.00] Pendant que les autres rament loin derrière`);
    lines.push(`[00:12.00] ${drereName} ${isDuo ? 'voyaient' : 'voyait'} clair dans la lumière`);
  }

  lines.push(`[00:15.00] ${drereName} ${isDuo ? 'ont vu' : 'a vu'} le futur tout le monde le sait`);

  if (grosCoup) {
    const countries = grosCoup.countries;
    lines.push(`[00:18.00] ${isDuo ? grosCoup.author : drereName} a dit ${countries[0]} ${grosCoup.predictedScore} score exact`);
    lines.push(`[00:21.00] Le prophète avait tout vu tout prédit`);
  } else {
    lines.push(`[00:18.00] Chaque match annoncé avec précision`);
    lines.push(`[00:21.00] La gloire le rêve la même passion`);
  }

  lines.push(`[00:24.00] ${drereName} ${SUNG_DRERE} of the Week ${isDuo ? 'couronnes sur les têtes' : 'couronne sur la tête'}`);

  if (worstActivePerformers.length >= 2) {
    lines.push(`[00:27.00] ${worstActivePerformers[0].name} et ${worstActivePerformers[1].name} auraient dû rester au lit`);
  } else {
    lines.push(`[00:27.00] Les autres auraient dû rester au lit`);
  }

  if (exactScoresThisWeek > 0) {
    lines.push(`[00:30.00] ${exactScoresThisWeek} scores exacts cette semaine sans débat`);
    lines.push(`[00:33.00] ${drereName} ${isDuo ? 'voient' : 'voit'} le futur ${isDuo ? 'ils gèrent' : 'il gère'} ça`);
  }

  if (mziName) {
    lines.push(`[00:36.00] ${mziName} enchaîne les défaites mon gars`);
    lines.push(`[00:39.00] Zéro point tes pronos c'est pas ça`);
  }

  lines.push(`[00:42.00] ${SUNG_DRERE} of the Week respecte la couronne`);
  lines.push(`[00:45.00] ${drereName} ${isDuo ? 'tiennent le game ils tiennent' : 'tient le game il tient'} la ville!`);

  return lines.join('\n');
}

// Structure 2: Rock anthem épique (paroles en français)
function generateRockAnthemLyrics(stats: WeekStats): string {
  const { drereName, drerePoints, grosCoup, drereJourCount, worstActivePerformers, mziName, isDuo } = stats;
  const lines: string[] = [];

  lines.push(`[00:00.00] Mesdames et messieurs`);
  lines.push(`[00:03.00] ${isDuo ? 'Vos champions sont arrivés' : 'Votre champion est arrivé'}`);
  lines.push(`[00:06.00] ${drereName} au-dessus de tout le monde`);
  lines.push(`[00:09.00] ${drerePoints} points de gloire pure`);

  if (drereJourCount > 0) {
    lines.push(`[00:12.00] ${SUNG_DRERE} du jour ${drereJourCount} fois cette semaine`);
    lines.push(`[00:15.00] Une force que personne n'arrête`);
  } else {
    lines.push(`[00:12.00] Ils ont voulu ${isDuo ? 'les' : 'le'} battre ils ont échoué`);
    lines.push(`[00:15.00] La victoire n'a jamais fait de doute`);
  }

  if (grosCoup) {
    lines.push(`[00:18.00] ${grosCoup.matchName} ${isDuo ? `${grosCoup.author} l'a vu venir` : "il l'a vu venir"}`);
    lines.push(`[00:21.00] ${grosCoup.predictedScore} score exact quelle vista`);
  } else {
    lines.push(`[00:18.00] ${isDuo ? 'Ils voyaient' : 'Il voyait'} les scores avant les matchs`);
    lines.push(`[00:21.00] L'oracle du football a parlé`);
  }

  lines.push(`[00:24.00] ${drereName} ${SUNG_DRERE} of the Week`);
  lines.push(`[00:27.00] Intouchable inarrêtable`);

  if (worstActivePerformers.length > 0) {
    const worst = worstActivePerformers[0];
    lines.push(`[00:30.00] Pendant que ${worst.name} gratte ${worst.points} points`);
    lines.push(`[00:33.00] Rien à voir avec ${drereName} c'est loin`);
  }

  if (mziName) {
    lines.push(`[00:36.00] ${mziName} a tout raté encore une fois`);
    lines.push(`[00:39.00] Zéro pointé il ferait mieux de dormir`);
  }

  lines.push(`[00:42.00] Levez les mains pour ${isDuo ? 'les rois' : 'le roi'}`);
  lines.push(`[00:45.00] ${drereName} fait chanter le stade`);
  lines.push(`[00:48.00] ${SUNG_DRERE} of the Week le règne continue`);
  lines.push(`[00:51.00] ${drereName} possède le game!`);

  return lines.join('\n');
}

// Structure 3: Focus sur le GROS COUP de la semaine (paroles en français)
function generateGrosCoupLyrics(stats: WeekStats): string {
  const { drereName, drerePoints, grosCoup, exactScoresThisWeek, worstActivePerformers, isDuo } = stats;
  const lines: string[] = [];

  lines.push(`[00:00.00] Écoutez bien tout le monde`);
  lines.push(`[00:03.00] ${drereName} a la vision`);

  if (grosCoup) {
    lines.push(`[00:06.00] Le match c'était ${grosCoup.matchName}`);
    lines.push(`[00:09.00] Tout le monde pensait connaître le jeu`);
    lines.push(`[00:12.00] Mais ${isDuo ? grosCoup.author : drereName} a dit ${grosCoup.predictedScore}`);
    lines.push(`[00:15.00] Score exact ${isDuo ? 'ils savaient' : 'il savait'} c'est sûr`);
    lines.push(`[00:18.00] ${grosCoup.countries[0]} contre ${grosCoup.countries[1] || 'le reste du monde'}`);
    lines.push(`[00:21.00] ${drereName} les pronos c'est ${isDuo ? 'eux' : 'lui'}`);
  } else {
    lines.push(`[00:06.00] Chaque match annoncé propre et net`);
    lines.push(`[00:09.00] ${isDuo ? 'Les meilleurs pronostiqueurs' : 'Le meilleur pronostiqueur'} du pays`);
    lines.push(`[00:12.00] Les autres devinent dans le noir`);
    lines.push(`[00:15.00] ${drereName} vise en plein dans le mille`);
    lines.push(`[00:18.00] Vision de prophète cristal pur`);
    lines.push(`[00:21.00] Voilà pourquoi ${drereName} est là`);
  }

  lines.push(`[00:24.00] ${drerePoints} points sur la semaine`);
  lines.push(`[00:27.00] ${drereName} ${SUNG_DRERE} of the Week`);

  if (exactScoresThisWeek > 1) {
    lines.push(`[00:30.00] Pas un mais ${exactScoresThisWeek} scores exacts`);
    lines.push(`[00:33.00] ${drereName} ouvre toutes les portes`);
  }

  if (worstActivePerformers.length >= 2) {
    lines.push(`[00:36.00] ${worstActivePerformers[0].name} ${worstActivePerformers[0].points} points quelle tristesse`);
    lines.push(`[00:39.00] ${worstActivePerformers[1].name} ${worstActivePerformers[1].points} points même détresse`);
  }

  lines.push(`[00:42.00] Mais ${drereName} niveau supérieur tu connais`);
  lines.push(`[00:45.00] ${SUNG_DRERE} of the Week vole le show!`);

  return lines.join('\n');
}

// Structure 4: Stats champion avec toutes les données (paroles en français)
function generateChampionStatsLyrics(stats: WeekStats): string {
  const { drereName, drerePoints, grosCoup, exactScoresThisWeek, drereJourCount, worstActivePerformers, mziName, isDuo } = stats;
  const lines: string[] = [];

  lines.push(`[00:00.00] Les stats mentent pas regarde les faits`);
  lines.push(`[00:03.00] ${drereName} a frappé fort cette fois`);
  lines.push(`[00:06.00] ${drerePoints} points au total sur la semaine`);

  if (exactScoresThisWeek > 0) {
    lines.push(`[00:09.00] ${exactScoresThisWeek} scores exacts quelle technique`);
  } else {
    lines.push(`[00:09.00] La régularité au sommet`);
  }

  if (drereJourCount > 0) {
    lines.push(`[00:12.00] ${SUNG_DRERE} du jour ${drereJourCount} fois ${isDuo ? 'couronnés' : 'couronné'}`);
    lines.push(`[00:15.00] La concurrence est laminée`);
  } else {
    lines.push(`[00:12.00] Jour après jour ${isDuo ? 'ils ont' : 'il a'} creusé l'écart`);
    lines.push(`[00:15.00] ${drereName} a tout ce qu'il faut`);
  }

  if (grosCoup) {
    lines.push(`[00:18.00] Prono MVP sur ${grosCoup.matchName}`);
    lines.push(`[00:21.00] ${grosCoup.predictedScore} score exact hall of fame`);
  } else {
    lines.push(`[00:18.00] Chaque prono en plein dans l'axe`);
    lines.push(`[00:21.00] ${drereName} dirige la baraque`);
  }

  lines.push(`[00:24.00] Maintenant parlons du reste`);

  if (worstActivePerformers.length >= 2) {
    lines.push(`[00:27.00] ${worstActivePerformers[0].name} ${worstActivePerformers[0].points} points pas convaincant`);
    lines.push(`[00:30.00] ${worstActivePerformers[1].name} ${worstActivePerformers[1].points} n'a pas passé le test`);
  }

  if (mziName) {
    lines.push(`[00:33.00] ${mziName} est le type mzi de la semaine`);
    lines.push(`[00:36.00] Zéro point des pronos à la peine`);
  }

  lines.push(`[00:39.00] Mais ${drereName} reste tout en haut`);
  lines.push(`[00:42.00] ${isDuo ? "Les rois qui ne s'arrêtent jamais" : "Le roi qui ne s'arrête jamais"}`);
  lines.push(`[00:45.00] ${SUNG_DRERE} of the Week sans débat`);
  lines.push(`[00:48.00] ${drereName} c'est du grand art!`);

  return lines.join('\n');
}

/**
 * Generate song using Suno AI via sunoapi.org.
 * Voie principale : customMode: false — on envoie le BRIEF (contexte de la
 * semaine) et Suno écrit lui-même des paroles nouvelles, puis les chante.
 * Fallback : customMode: true avec nos paroles gabarit si le non-custom échoue.
 */
async function launchSunoTask(apiKey: string, body: Record<string, unknown>): Promise<string> {
  const generateResponse = await fetch('https://api.sunoapi.org/api/v1/generate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!generateResponse.ok) {
    const errorText = await generateResponse.text();
    throw new Error(`Suno API error: ${generateResponse.status} - ${errorText}`);
  }

  const generateResult = await generateResponse.json();
  const taskId = generateResult.data?.taskId || generateResult.taskId;
  if (!taskId) {
    throw new Error('No taskId returned from Suno API');
  }
  return taskId;
}

async function generateSongWithSuno(songId: string, brief: string, fallbackLyrics: string, drereName: string, musicStyle: string) {
  const supabase = getSupabaseAdmin();

  try {
    // Update status to generating
    await supabase
      .from('drere_week_songs')
      .update({ status: 'generating', updated_at: new Date().toISOString() })
      .eq('id', songId);

    const apiKey = process.env.SUNO_API_KEY;

    if (!apiKey) {
      await supabase
        .from('drere_week_songs')
        .update({
          status: 'completed',
          error_message: 'SUNO_API_KEY not configured - lyrics only',
          updated_at: new Date().toISOString()
        })
        .eq('id', songId);
      return;
    }

    // Voie principale : Suno écrit les paroles depuis le brief.
    // (En non-custom, style et title doivent rester vides — le style est
    // dans le brief. vocalGender : 'm'/'f' selon la doc sunoapi.org.)
    let taskId: string;
    try {
      taskId = await launchSunoTask(apiKey, {
        customMode: false,
        instrumental: false,
        prompt: brief,
        model: 'V5_5',
        vocalGender: 'm',
      });
    } catch (nonCustomError) {
      // Fallback : nos paroles gabarit en mode custom (comportement historique)
      console.error('Suno non-custom failed, falling back to template lyrics:', nonCustomError);
      taskId = await launchSunoTask(apiKey, {
        customMode: true,
        instrumental: false,
        prompt: fallbackLyrics,
        style: `${musicStyle}, french vocals, sung in French`,
        title: `${drereName} - Drère of the Week`,
        model: 'V5_5',
        vocalGender: 'm',
      });
    }

    // Step 2: Poll for completion (max 5 minutes - Suno takes longer)
    let audioUrl: string | null = null;
    let imageUrl: string | null = null;
    const maxAttempts = 60; // 60 * 5s = 5 minutes

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

      const statusResponse = await fetch(
        `https://api.sunoapi.org/api/v1/generate/record-info?taskId=${taskId}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
          },
        }
      );

      if (!statusResponse.ok) continue;

      const statusResult = await statusResponse.json();
      const status = statusResult.data?.status;

      if (status === 'SUCCESS' || status === 'FIRST_SUCCESS') {
        // Get audio data from sunoData array
        const sunoData = statusResult.data?.sunoData;
        if (sunoData && sunoData.length > 0) {
          // Take the first (or best) generated clip
          const clip = sunoData[0];
          audioUrl = clip.audioUrl || clip.audio_url;
          imageUrl = clip.imageUrl || clip.image_url;
          // En non-custom, Suno a écrit les paroles : on remplace le gabarit.
          const sunoLyrics = clip.prompt || clip.lyric || clip.lyrics;
          if (typeof sunoLyrics === 'string' && sunoLyrics.trim().length > 0) {
            await supabase
              .from('drere_week_songs')
              .update({ lyrics: sunoLyrics, updated_at: new Date().toISOString() })
              .eq('id', songId);
          }
        }
        break;
      } else if (status === 'CREATE_TASK_FAILED' || status === 'GENERATE_AUDIO_FAILED' || status === 'CALLBACK_EXCEPTION') {
        throw new Error(`Suno generation failed: ${status}`);
      }
      // PENDING, TEXT_SUCCESS - continue polling
    }

    if (!audioUrl) {
      throw new Error('Timeout waiting for Suno song generation');
    }

    // Update with the audio URL and cover image
    await supabase
      .from('drere_week_songs')
      .update({
        status: 'completed',
        audio_url: audioUrl,
        cover_image_url: imageUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', songId);

  } catch (error: any) {
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
