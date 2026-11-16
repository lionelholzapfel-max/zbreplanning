// Builds one trimmed, JSON-serialisable snapshot of the whole mini-league from the
// public FPL API, and caches it (bootstrap-static alone is ~1.8 MB, over the 2 MB
// fetch-cache comfort zone, so we cache the trimmed result instead of raw fetches).
import type { z } from 'zod';
import {
  BootstrapSchema,
  EntrySchema,
  HistorySchema,
  LiveSchema,
  PicksSchema,
  TransferSchema,
  type FplChipWindow,
  type FplEvent,
  type FplHistory,
  type FplPicks,
  type FplTransfer,
} from './schemas';
import { MANAGERS, type ManagerSlug } from './config';

const BASE = 'https://fantasy.premierleague.com/api';
const POSITIONS = ['', 'GK', 'DEF', 'MID', 'FWD'] as const;

export interface PlayerInfo {
  id: number;
  name: string;
  fullName: string;
  team: string;
  pos: (typeof POSITIONS)[number];
  cost: number; // in £m
  selectedBy: number; // global ownership %
  totalPoints: number;
}

export interface LiveStat {
  pts: number;
  min: number;
  g: number;
  a: number;
  cs: number;
  bonus: number;
}

export interface ManagerSnapshot {
  slug: ManagerSlug;
  entryId: number;
  teamName: string;
  overallRank: number | null;
  history: FplHistory['current'];
  past: FplHistory['past'];
  chips: FplHistory['chips'];
  transfers: FplTransfer[];
  /** keyed by gameweek number (as string once serialised) */
  picks: Record<string, FplPicks>;
}

export interface LeagueSnapshot {
  fetchedAt: string;
  events: FplEvent[];
  /** chip windows from the game rules: each chip once per half-season */
  chipWindows: FplChipWindow[];
  /** gameweeks whose deadline has passed (finished or in progress), ascending */
  playedGws: number[];
  lastFinishedGw: number | null;
  currentGw: number | null;
  currentGwFinished: boolean;
  nextEvent: FplEvent | null;
  players: Record<string, PlayerInfo>;
  /** live[gw][playerId] — only players that matter to the league */
  live: Record<string, Record<string, LiveStat>>;
  managers: ManagerSnapshot[];
}

async function getJson<S extends z.ZodTypeAny>(path: string, schema: S): Promise<z.infer<S>> {
  const res = await fetch(`${BASE}${path}`, {
    cache: 'no-store',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; zbreplanning-fpl/1.0)' },
  });
  if (!res.ok) {
    throw new Error(`[fpl] ${path} -> HTTP ${res.status}`);
  }
  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) {
    throw new Error(`[fpl] ${path} -> unexpected shape: ${parsed.error.message.slice(0, 300)}`);
  }
  return parsed.data;
}

/** Run async jobs with bounded concurrency (be polite to the FPL API). */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function buildSnapshot(): Promise<LeagueSnapshot> {
  const started = Date.now();
  const bootstrap = await getJson('/bootstrap-static/', BootstrapSchema);
  const events = bootstrap.events;
  const playedGws = events.filter((e) => e.finished || e.is_current).map((e) => e.id).sort((a, b) => a - b);
  const current = events.find((e) => e.is_current) ?? null;
  const finished = events.filter((e) => e.finished).map((e) => e.id);
  const lastFinishedGw = finished.length ? Math.max(...finished) : null;
  const nextEvent = events.find((e) => e.is_next) ?? null;

  const teams = new Map(bootstrap.teams.map((t) => [t.id, t.short_name]));

  const managers = await pool(MANAGERS, 4, async (m) => {
    const [entry, history, transfers] = await Promise.all([
      getJson(`/entry/${m.entryId}/`, EntrySchema),
      getJson(`/entry/${m.entryId}/history/`, HistorySchema),
      getJson(`/entry/${m.entryId}/transfers/`, TransferSchema.array()),
    ]);
    // A manager who joined late has no picks before their first GW.
    const gws = history.current.map((h) => h.event).filter((gw) => playedGws.includes(gw));
    const pickList = await pool(gws, 6, (gw) => getJson(`/entry/${m.entryId}/event/${gw}/picks/`, PicksSchema));
    const picks: Record<string, FplPicks> = {};
    gws.forEach((gw, i) => (picks[String(gw)] = pickList[i]));
    const snap: ManagerSnapshot = {
      slug: m.slug,
      entryId: m.entryId,
      teamName: entry.name,
      overallRank: entry.summary_overall_rank,
      history: history.current,
      past: history.past,
      chips: history.chips,
      transfers,
      picks,
    };
    return snap;
  });

  // Every player who was ever picked or transferred by one of us.
  const relevant = new Set<number>();
  for (const m of managers) {
    for (const p of Object.values(m.picks)) p.picks.forEach((pk) => relevant.add(pk.element));
    m.transfers.forEach((t) => {
      relevant.add(t.element_in);
      relevant.add(t.element_out);
    });
  }

  const liveList = await pool(playedGws, 5, (gw) => getJson(`/event/${gw}/live/`, LiveSchema));
  const live: LeagueSnapshot['live'] = {};
  playedGws.forEach((gw, i) => {
    const byId: Record<string, LiveStat> = {};
    for (const el of liveList[i].elements) {
      if (!relevant.has(el.id)) continue;
      const s = el.stats;
      byId[String(el.id)] = {
        pts: s.total_points,
        min: s.minutes,
        g: s.goals_scored,
        a: s.assists,
        cs: s.clean_sheets,
        bonus: s.bonus,
      };
    }
    live[String(gw)] = byId;
  });

  const players: Record<string, PlayerInfo> = {};
  for (const el of bootstrap.elements) {
    if (!relevant.has(el.id)) continue;
    players[String(el.id)] = {
      id: el.id,
      name: el.web_name,
      fullName: `${el.first_name} ${el.second_name}`,
      team: teams.get(el.team) ?? '?',
      pos: POSITIONS[el.element_type] ?? 'MID',
      cost: el.now_cost / 10,
      selectedBy: Number(el.selected_by_percent) || 0,
      totalPoints: el.total_points,
    };
  }

  console.log(
    `[fpl] snapshot built in ${Date.now() - started}ms: ${playedGws.length} GWs, ${relevant.size} players`,
  );

  return {
    fetchedAt: new Date().toISOString(),
    events,
    chipWindows: bootstrap.chips,
    playedGws,
    lastFinishedGw,
    currentGw: current?.id ?? null,
    currentGwFinished: current?.finished ?? false,
    nextEvent,
    players,
    live,
    managers,
  };
}

/**
 * The league as it stood at the end of `gw`: later gameweeks (possibly live)
 * are cut, so a review of GW N never sees points scored in GW N+1.
 */
export function snapshotAtGw(snap: LeagueSnapshot, gw: number): LeagueSnapshot {
  const upTo = <T>(rec: Record<string, T>) => Object.fromEntries(Object.entries(rec).filter(([k]) => Number(k) <= gw));
  return {
    ...snap,
    playedGws: snap.playedGws.filter((g) => g <= gw),
    lastFinishedGw: gw,
    currentGw: gw,
    currentGwFinished: true,
    nextEvent: snap.events.find((e) => e.id === gw + 1) ?? null,
    live: upTo(snap.live),
    managers: snap.managers.map((m) => {
      const history = m.history.filter((h) => h.event <= gw);
      return {
        ...m,
        history,
        overallRank: history.at(-1)?.overall_rank ?? m.overallRank,
        transfers: m.transfers.filter((t) => t.event <= gw),
        chips: m.chips.filter((c) => c.event <= gw),
        picks: upTo(m.picks),
      };
    }),
  };
}
