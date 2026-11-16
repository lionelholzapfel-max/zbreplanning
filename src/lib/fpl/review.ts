// Gameweek review pipeline: the CODE computes every number (stats.ts) and decides
// who is Drère / Mzi; Claude only writes the funny prose around those facts.
// Budget guards: one row per (season, gw) enforced by the DB primary key, real
// cost stored per call, and no new call once the season total exceeds the cap.
import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/auth/session';
import { FPL_LEAGUE_NAME, FPL_SEASON, MANAGERS, MANAGER_BY_SLUG, type ManagerSlug } from './config';
import { computeLeagueStats, gameweekFacts, type GameweekFacts } from './stats';
import { snapshotAtGw, type LeagueSnapshot } from './snapshot';
import { buildSongBrief } from './song-brief';

export const REVIEW_MODEL = 'claude-opus-5-5';
// Claude Opus 5.5 list prices (USD per token).
const PRICE_IN = 4 / 1_000_000;
const PRICE_OUT = 20 / 1_000_000;
/** Lionel's budget: ~5 € for the whole season. Stop generating beyond this. */
export const SEASON_BUDGET_USD = 5;
const MAX_ATTEMPTS = 3;

const SLUGS = MANAGERS.map((m) => m.slug) as [ManagerSlug, ...ManagerSlug[]];

export const ReviewSchema = z.object({
  headline: z.string().describe('Titre de une, style tabloïd sportif, max 90 caractères'),
  intro: z.string().describe('2 à 3 phrases qui résument la GW'),
  drere: z.object({ text: z.string().describe('Le couronnement du Drère de la GW, 2-3 phrases') }),
  mzi: z.object({ text: z.string().describe('Le chambrage du Mzi (loser) de la GW, 2-3 phrases') }),
  ibanJoke: z.string().describe('Une vanne sur le fait de faire déjà le virement au leader du classement'),
  managers: z
    .array(
      z.object({
        slug: z.enum(SLUGS),
        verdict: z.enum(['top', 'correct', 'flop']),
        title: z.string().describe('Surnom de la semaine, max 40 caractères'),
        summary: z.string().describe('2-3 phrases sur sa GW'),
        goodCalls: z.array(z.string()).describe('0 à 3 bons choix, chacun avec le chiffre qui le prouve'),
        badCalls: z.array(z.string()).describe('0 à 3 mauvais choix, chacun avec le chiffre qui le prouve'),
        advice: z.string().describe('Un conseil (ou une pique) pour la GW suivante'),
      }),
    )
    .describe('Exactement un élément par manager'),
  bestTeam: z.object({ slug: z.enum(SLUGS), why: z.string() }).describe('Qui a la meilleure équipe pour la suite'),
  mustChange: z.array(z.object({ slug: z.enum(SLUGS), why: z.string() })).describe('Qui doit faire des changements, 1 ou 2 managers'),
  prediction: z.string().describe('Un pronostic piquant pour la GW suivante'),
});

export type GwReview = z.infer<typeof ReviewSchema>;

export interface ReviewRow {
  season: string;
  gw: number;
  status: 'generating' | 'ready' | 'failed';
  review: GwReview | null;
  facts: GameweekFacts | null;
  drere_slugs: ManagerSlug[];
  mzi_slugs: ManagerSlug[];
  cost_usd: number;
  song_status: 'none' | 'generating' | 'completed' | 'failed';
  song_audio_url: string | null;
  song_cover_url: string | null;
  song_title: string | null;
  song_lyrics: string | null;
  created_at: string;
}

function systemPrompt(): string {
  const lore = MANAGERS.map(
    (m) =>
      `- ${m.firstName} (${m.fullName}), ${m.stars} étoile(s) historique(s), surnom « ${m.ringName} ». ${m.bio.join(' ')}`,
  ).join('\n');
  return `Tu es le chroniqueur officiel de la « ${FPL_LEAGUE_NAME} », une mini-ligue Fantasy Premier League entre quatre potes belges qui jouent pour de l'argent (chacun met au pot, le gagnant de fin de saison rafle tout).

Après chaque gameweek (GW), tu écris la review : qui a bien joué, qui a raté, quels choix étaient bons ou mauvais, qui a la meilleure équipe et qui doit changer des choses. Le ton est celui d'un vestiaire entre amis : drôle, piquant, on se fout gentiment mais franchement de la gueule des gens.

Les managers et leur lore (utilise-le, ce sont des running gags) :
${lore}

Vocabulaire maison :
- Le « Drère » de la GW = celui qui a fait le plus de points cette semaine. On le couronne.
- Le « Mzi » de la GW = celui qui a fait le moins de points. On le chambre.
- Running gag d'argent : le leader du classement général est traité comme si on lui faisait déjà le virement (« X, je peux avoir ton IBAN ? »). Invente une variante nouvelle à chaque fois. N'écris jamais de montant.

Règles strictes :
- Tout en français (belge, familier, sans vulgarité gratuite).
- Utilise UNIQUEMENT les chiffres fournis dans les faits. N'invente aucun score, aucun joueur, aucun événement de match. Chaque bon ou mauvais choix cite le chiffre qui le prouve.
- Le Drère et le Mzi sont déjà décidés dans les faits : ne les change pas.
- Les vannes portent sur les choix FPL, les résultats, le Celtic, l'étoile contestée, la saison Leicester… Jamais sur le physique, la famille ou les origines.
- « captain » = capitaine (ses points sont doublés) ; « bestPossibleCaptain » = le joueur de son XI qui aurait rapporté le plus en capitaine ; « benchPoints » = points laissés sur le banc ; « hitCost » = points perdus en transferts payants.
- Phrases courtes, punchlines. Pas de liste de chiffres sans commentaire.`;
}

/** A failed attempt that was still billed: carries what it cost. */
class PaidAttemptError extends Error {
  constructor(
    message: string,
    readonly costUsd: number,
  ) {
    super(message);
  }
}

const MAX_OUTPUT_TOKENS = 16_000;
/**
 * Cost booked for an attempt that died without a usage report (timeout,
 * network error after the request left, function killed): assume the worst
 * plausible bill, i.e. the full output limit plus a generous prompt.
 */
const UNKNOWN_ATTEMPT_COST_USD = MAX_OUTPUT_TOKENS * PRICE_OUT + 20_000 * PRICE_IN;

/** What a failed writeReview() call cost us. */
function failedAttemptCost(e: unknown): number {
  if (e instanceof PaidAttemptError) return e.costUsd;
  // The API answered with an error status (overloaded, bad request…): not billed.
  if (e instanceof Anthropic.APIError && typeof e.status === 'number') return 0;
  return UNKNOWN_ATTEMPT_COST_USD;
}

export async function writeReview(facts: GameweekFacts) {
  // No hidden SDK retries: every paid attempt is one of ours, counted in the DB.
  const client = new Anthropic({ maxRetries: 0, timeout: 240_000 });
  const response = await client.messages.parse({
    model: REVIEW_MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    output_config: { effort: 'medium', format: zodOutputFormat(ReviewSchema) },
    system: systemPrompt(),
    messages: [
      {
        role: 'user',
        content: `Voici les faits de la GW${facts.gameweek} (JSON, calculés par le code, fiables) :\n\n${JSON.stringify(facts)}\n\nÉcris la review.`,
      },
    ],
  });
  const usage = response.usage;
  const cost = usage.input_tokens * PRICE_IN + usage.output_tokens * PRICE_OUT;
  if (response.stop_reason === 'refusal') {
    throw new PaidAttemptError(`Claude refused: ${response.stop_details?.category ?? 'unknown'}`, cost);
  }
  if (!response.parsed_output) {
    throw new PaidAttemptError(`Claude returned no parsable review (stop_reason=${response.stop_reason})`, cost);
  }
  return { review: response.parsed_output, usage, cost };
}

// ---------------------------------------------------------------------------
// Suno — the Drère of the GW gets a song (sunoapi.org, same flow as the World
// Cup "Drère of the Week"). The loser gets the fixed /sounds/mzi.m4a instead.

function appBaseUrl(): string {
  return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL || 'zbreplanning.vercel.app'}`;
}

export async function launchSong(season: string, gw: number, brief: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const apiKey = process.env.SUNO_API_KEY;
  if (!apiKey) {
    await supabase
      .from('fpl_gw_reviews')
      .update({ song_status: 'failed', song_error: 'SUNO_API_KEY not configured', updated_at: new Date().toISOString() })
      .eq('season', season)
      .eq('gw', gw);
    return null;
  }
  try {
    const res = await fetch('https://api.sunoapi.org/api/v1/generate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customMode: false,
        instrumental: false,
        prompt: brief,
        model: 'V5_5',
        vocalGender: 'm',
        callBackUrl: `${appBaseUrl()}/api/fpl/song/callback`,
      }),
    });
    const body = await res.json().catch(() => null);
    const taskId: string | undefined = body?.data?.taskId || body?.taskId;
    if (!res.ok || !taskId) {
      throw new Error(`Suno launch failed: HTTP ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
    }
    const { error: saveError } = await supabase
      .from('fpl_gw_reviews')
      .update({ song_status: 'generating', song_task_id: taskId, song_error: null, updated_at: new Date().toISOString() })
      .eq('season', season)
      .eq('gw', gw);
    if (saveError) {
      // The song is paid and will be generated, but the callback won't find the row.
      console.error(`[fpl] SONG ORPHANED for GW${gw}: task ${taskId} not saved (${saveError.message}), attach it by hand`);
    }
    console.log(`[fpl] song launched for GW${gw}: task ${taskId}`);
    return taskId;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[fpl] song launch failed for GW${gw}: ${msg}`);
    await supabase
      .from('fpl_gw_reviews')
      .update({ song_status: 'failed', song_error: msg.slice(0, 500), updated_at: new Date().toISOString() })
      .eq('season', season)
      .eq('gw', gw);
    return null;
  }
}

// ---------------------------------------------------------------------------

export async function seasonSpendUsd(season = FPL_SEASON): Promise<number> {
  const { data, error } = await getSupabaseAdmin().from('fpl_gw_reviews').select('cost_usd').eq('season', season);
  if (error) throw new Error(`[fpl] cannot read spend: ${error.message}`);
  return (data ?? []).reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
}

/** Latest GW that FPL has fully validated (bonus + corrections included). */
export function latestCheckedGw(snap: LeagueSnapshot): number | null {
  const done = snap.events.filter((e) => e.finished && e.data_checked).map((e) => e.id);
  return done.length ? Math.max(...done) : null;
}

export type PipelineResult =
  | { action: 'skipped'; reason: string; gw?: number }
  | { action: 'generated'; gw: number; costUsd: number; songTaskId: string | null }
  | { action: 'failed'; gw: number; error: string };

/**
 * Idempotent: safe to call every day. Generates the review of the latest
 * validated GW if (and only if) it does not exist yet and the budget allows it.
 */
export async function runReviewPipeline(
  snap: LeagueSnapshot,
  opts: { gw?: number; withSong?: boolean } = {},
): Promise<PipelineResult> {
  const supabase = getSupabaseAdmin();
  const gw = opts.gw ?? (await nextGwToReview(snap));
  // A catch-up review gets no song (the song celebrates the week that just ended).
  if (opts.gw === undefined && gw !== latestCheckedGw(snap)) opts = { ...opts, withSong: false };
  if (!gw) return { action: 'skipped', reason: 'no validated gameweek yet' };
  if (!snap.playedGws.includes(gw)) return { action: 'skipped', reason: `GW${gw} not in league data`, gw };

  const spent = await seasonSpendUsd();
  if (spent >= SEASON_BUDGET_USD) {
    console.warn(`[fpl] BUDGET CAP reached: $${spent.toFixed(2)} >= $${SEASON_BUDGET_USD}, GW${gw} review NOT generated`);
    return { action: 'skipped', reason: `season budget reached ($${spent.toFixed(2)})`, gw };
  }

  // Facts as they stood at the end of the GW (never points from a later, live GW).
  const frozen = snapshotAtGw(snap, gw);
  const facts = gameweekFacts(frozen, computeLeagueStats(frozen), gw);

  // What earlier failed attempts of this GW already cost (kept in the budget).
  let priorCost = 0;

  // Lock: the primary key (season, gw) guarantees a single row per GW. A failed
  // or stuck (crashed function) attempt may be retried, at most MAX_ATTEMPTS.
  const { error: lockError } = await supabase.from('fpl_gw_reviews').insert({
    season: FPL_SEASON,
    gw,
    status: 'generating',
    facts,
    drere_slugs: facts.drere,
    mzi_slugs: facts.mzi,
  });
  if (lockError) {
    if (lockError.code !== '23505') throw new Error(`[fpl] cannot lock GW${gw}: ${lockError.message}`);
    const { data: existing } = await supabase
      .from('fpl_gw_reviews')
      .select('status, attempts, updated_at, cost_usd')
      .eq('season', FPL_SEASON)
      .eq('gw', gw)
      .single();
    const stuck =
      existing?.status === 'generating' && Date.now() - new Date(existing.updated_at).getTime() > 15 * 60_000;
    const retryable = existing && (existing.status === 'failed' || stuck) && existing.attempts < MAX_ATTEMPTS;
    if (!retryable) {
      return { action: 'skipped', reason: `review already ${existing?.status ?? 'exists'} (attempts ${existing?.attempts ?? '?'})`, gw };
    }
    // A stuck row = a function killed mid-call: that attempt was probably billed.
    priorCost = Number(existing.cost_usd ?? 0) + (stuck ? UNKNOWN_ATTEMPT_COST_USD : 0);
    // Optimistic retry lock: only one caller wins the status/attempts transition.
    const { data: claimed } = await supabase
      .from('fpl_gw_reviews')
      .update({
        status: 'generating',
        attempts: existing.attempts + 1,
        facts,
        cost_usd: priorCost,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('season', FPL_SEASON)
      .eq('gw', gw)
      .eq('attempts', existing.attempts)
      .select('gw');
    if (!claimed?.length) return { action: 'skipped', reason: 'another run is retrying this GW', gw };
    console.log(`[fpl] retrying GW${gw} review (attempt ${existing.attempts + 1}/${MAX_ATTEMPTS})`);
  }

  let review: Awaited<ReturnType<typeof writeReview>> | undefined;
  try {
    review = await writeReview(facts);
    const { usage, cost } = review;
    const { error: saveError } = await supabase
      .from('fpl_gw_reviews')
      .update({
        status: 'ready',
        review: review.review,
        model: REVIEW_MODEL,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cost_usd: priorCost + cost,
        updated_at: new Date().toISOString(),
      })
      .eq('season', FPL_SEASON)
      .eq('gw', gw);
    // Never launch a (paid) song for a review we could not store.
    if (saveError) throw new Error(`review written but not saved: ${saveError.message}`);
    console.log(
      `[fpl] review GW${gw} written: in=${usage.input_tokens} out=${usage.output_tokens} cost=$${cost.toFixed(4)} (season $${(spent + priorCost + cost).toFixed(2)}/${SEASON_BUDGET_USD})`,
    );
  } catch (e) {
    const attemptCost = review ? review.cost : failedAttemptCost(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[fpl] review GW${gw} failed (attempt cost ~$${attemptCost.toFixed(3)}): ${msg}`);
    const { error: failError } = await supabase
      .from('fpl_gw_reviews')
      .update({
        status: 'failed',
        error_message: msg.slice(0, 1000),
        cost_usd: priorCost + attemptCost,
        updated_at: new Date().toISOString(),
      })
      .eq('season', FPL_SEASON)
      .eq('gw', gw);
    if (failError) console.error(`[fpl] cannot record failure of GW${gw}: ${failError.message}`);
    return { action: 'failed', gw, error: msg };
  }

  // The review is stored: a song problem can no longer make us pay for it twice.
  let songTaskId: string | null = null;
  if (opts.withSong !== false) {
    try {
      songTaskId = await launchSong(FPL_SEASON, gw, buildSongBrief(facts));
    } catch (e) {
      console.error(`[fpl] song step crashed for GW${gw}:`, e);
    }
  }
  return { action: 'generated', gw, costUsd: review!.cost, songTaskId };
}

/**
 * The GW the cron should handle: the latest validated GW, or, if it is already
 * reviewed, the one just before it when that one was missed (cron down for a
 * whole week). Never further back: no paid back-fill of the season, whatever
 * a manual run on an old GW left in the table.
 */
async function nextGwToReview(snap: LeagueSnapshot): Promise<number | null> {
  const latest = latestCheckedGw(snap);
  if (!latest) return null;
  const { data, error } = await getSupabaseAdmin().from('fpl_gw_reviews').select('gw').eq('season', FPL_SEASON);
  if (error) throw new Error(`[fpl] cannot read reviewed GWs: ${error.message}`);
  const done = new Set((data ?? []).map((r) => r.gw as number));
  const previous = latest - 1;
  const previousChecked = snap.events.some((e) => e.id === previous && e.finished && e.data_checked);
  // Only catch up if the season's reviews had already started before it.
  const startedBefore = [...done].some((g) => g < previous);
  if (done.has(latest) && previousChecked && !done.has(previous) && startedBefore) return previous;
  return latest;
}

export async function getReviews(season = FPL_SEASON): Promise<ReviewRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('fpl_gw_reviews')
    .select(
      'season, gw, status, review, facts, drere_slugs, mzi_slugs, cost_usd, song_status, song_audio_url, song_cover_url, song_title, song_lyrics, created_at',
    )
    .eq('season', season)
    .order('gw', { ascending: false });
  if (error) {
    console.error(`[fpl] cannot read reviews: ${error.message}`);
    return [];
  }
  return (data ?? []) as ReviewRow[];
}

export function managerName(slug: ManagerSlug): string {
  return MANAGER_BY_SLUG[slug]?.firstName ?? slug;
}
