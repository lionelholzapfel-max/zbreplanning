// Pure, deterministic statistics over a LeagueSnapshot. No I/O, no AI: the
// numbers shown on the site and the facts handed to the review writer all come
// from here, so they can be unit-tested.
import type { LeagueSnapshot, ManagerSnapshot, PlayerInfo } from './snapshot';
import { MANAGER_BY_SLUG, type ManagerSlug } from './config';

export const CHIP_LABELS: Record<string, string> = {
  wildcard: 'Wildcard',
  freehit: 'Free Hit',
  bboost: 'Bench Boost',
  '3xc': 'Triple Capitaine',
  manager: 'Assistant Manager',
};

export interface PlayerRef {
  id: number;
  name: string;
  team: string;
  pos: string;
}

export interface PickDetail extends PlayerRef {
  pts: number; // raw points this GW
  scored: number; // pts × multiplier
  multiplier: number;
  isCaptain: boolean;
  isVice: boolean;
  bench: boolean;
  /** 1-11 starting XI, 12-15 bench (before auto-subs) */
  position: number;
  minutes: number;
}

export interface TransferImpact {
  gw: number;
  in: PlayerRef;
  out: PlayerRef;
  inPts: number;
  outPts: number;
  delta: number;
  span: number; // number of GWs counted
  freeHit: boolean;
}

export interface GwRow {
  gw: number;
  points: number; // gross GW points (as FPL shows them)
  hits: number; // transfer cost deducted
  net: number;
  total: number;
  leaguePos: number;
  overallRank: number | null;
  benchPts: number;
  chip: string | null;
  transfers: number;
  captain: PickDetail | null;
  bestCaptain: PickDetail | null;
}

export interface ManagerStats {
  slug: ManagerSlug;
  teamName: string;
  total: number;
  leaguePos: number;
  rows: GwRow[];
  last: GwRow | null;
  avg: number;
  form3: number;
  form5: number;
  stdev: number;
  best: { gw: number; pts: number } | null;
  worst: { gw: number; pts: number } | null;
  drereCount: number;
  mziCount: number;
  weeksTop: number;
  captainPts: number; // extra points from the armband (raw pts of captain, ×(mult-1))
  captainMissed: number; // sum over GWs of (best XI raw pts − captain raw pts)
  captainBestCount: number; // GWs where the captain was the best possible pick
  favouriteCaptain: { player: PlayerRef; times: number } | null;
  benchPts: number;
  hitsPts: number;
  transfersCount: number;
  chips: { name: string; label: string; gw: number; pts: number }[];
  chipStatus: ChipStatus[];
  /** chips still usable in the current half (what's left in the tank) */
  chipsLeftNow: string[];
  topContributors: { player: PlayerRef; pts: number; gws: number }[];
  loyal: { player: PlayerRef; gws: number }[];
  transfers: TransferImpact[];
  bestTransfer: TransferImpact | null;
  worstTransfer: TransferImpact | null;
  transferNet: number;
  differentials: { player: PlayerRef; seasonPts: number }[];
  teamValue: number | null;
  bank: number | null;
  overallRank: number | null;
}

export interface ChipStatus {
  name: string;
  label: string;
  window: string; // "GW1-19"
  start: number;
  stop: number;
  status: 'used' | 'available' | 'expired' | 'upcoming';
  usedGw: number | null;
}

/** Each chip exists once per half-season window (rules come from the API). */
export function chipStatuses(
  windows: LeagueSnapshot['chipWindows'],
  used: { name: string; event: number }[],
  currentGw: number,
): ChipStatus[] {
  return [...windows]
    .sort((a, b) => a.start_event - b.start_event || a.name.localeCompare(b.name))
    .map((w) => {
      const play = used.find((u) => u.name === w.name && u.event >= w.start_event && u.event <= w.stop_event);
      let status: ChipStatus['status'] = 'available';
      if (play) status = 'used';
      else if (w.start_event > currentGw) status = 'upcoming';
      else if (w.stop_event < currentGw) status = 'expired';
      return {
        name: w.name,
        label: CHIP_LABELS[w.name] ?? w.name,
        window: `GW${w.start_event}-${w.stop_event}`,
        start: w.start_event,
        stop: w.stop_event,
        status,
        usedGw: play?.event ?? null,
      };
    });
}

export interface H2HRecord {
  w: number;
  d: number;
  l: number;
  diff: number;
}

export interface LeagueStats {
  gws: number[];
  managers: ManagerStats[]; // sorted by league position
  bySlug: Record<ManagerSlug, ManagerStats>;
  leader: ManagerStats;
  /** per GW, slugs of the GW winners (ties → several) and losers */
  gwWinners: Record<number, ManagerSlug[]>;
  gwLosers: Record<number, ManagerSlug[]>;
  h2h: Record<ManagerSlug, Record<ManagerSlug, H2HRecord>>;
  /** players owned by at least two of us right now */
  shared: { player: PlayerRef; owners: ManagerSlug[] }[];
  biggestTransfer: (TransferImpact & { slug: ManagerSlug }) | null;
  worstTransferOverall: (TransferImpact & { slug: ManagerSlug }) | null;
  highestGw: { slug: ManagerSlug; gw: number; pts: number } | null;
  lowestGw: { slug: ManagerSlug; gw: number; pts: number } | null;
}

function ref(players: LeagueSnapshot['players'], id: number): PlayerRef {
  const p: PlayerInfo | undefined = players[String(id)];
  return { id, name: p?.name ?? `#${id}`, team: p?.team ?? '?', pos: p?.pos ?? '?' };
}

function livePts(snap: LeagueSnapshot, gw: number, id: number): number {
  return snap.live[String(gw)]?.[String(id)]?.pts ?? 0;
}

export function pickDetails(snap: LeagueSnapshot, m: ManagerSnapshot, gw: number): PickDetail[] {
  const picks = m.picks[String(gw)];
  if (!picks) return [];
  return picks.picks.map((pk) => {
    const live = snap.live[String(gw)]?.[String(pk.element)];
    const pts = live?.pts ?? 0;
    return {
      ...ref(snap.players, pk.element),
      pts,
      scored: pts * pk.multiplier,
      multiplier: pk.multiplier,
      isCaptain: pk.is_captain,
      isVice: pk.is_vice_captain,
      bench: pk.multiplier === 0,
      position: pk.position,
      minutes: live?.min ?? 0,
    };
  });
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

/** Points scored by a player over GWs [from, to] inclusive. */
function ptsBetween(snap: LeagueSnapshot, id: number, from: number, to: number): number {
  let s = 0;
  for (const gw of snap.playedGws) if (gw >= from && gw <= to) s += livePts(snap, gw, id);
  return s;
}

/** League position (1..n) per GW, by cumulative total; ties share the better position. */
function leaguePositions(snap: LeagueSnapshot): Record<number, Record<ManagerSlug, number>> {
  const out: Record<number, Record<ManagerSlug, number>> = {};
  for (const gw of snap.playedGws) {
    const totals = snap.managers.map((m) => ({
      slug: m.slug,
      total: m.history.find((h) => h.event === gw)?.total_points ?? -Infinity,
    }));
    const row = {} as Record<ManagerSlug, number>;
    for (const t of totals) row[t.slug] = 1 + totals.filter((o) => o.total > t.total).length;
    out[gw] = row;
  }
  return out;
}

function transferImpacts(snap: LeagueSnapshot, m: ManagerSnapshot): TransferImpact[] {
  const lastGw = snap.playedGws.at(-1) ?? 0;
  return m.transfers
    .filter((t) => t.event <= lastGw)
    // bought and sold again before the same deadline: never played for us
    .filter((t) => !m.transfers.some((o) => o.element_out === t.element_in && o.event === t.event && o.time > t.time))
    .map((t) => {
      const freeHit = m.chips.some((c) => c.name === 'freehit' && c.event === t.event);
      // The incoming player counts until he is sold again (or the last GW).
      const soldAt = m.transfers
        .filter((o) => o.element_out === t.element_in && (o.event > t.event || (o.event === t.event && o.time > t.time)))
        .reduce<number | null>((min, o) => (min === null || o.event < min ? o.event : min), null);
      const to = freeHit ? t.event : soldAt !== null ? Math.max(t.event, soldAt - 1) : lastGw;
      const inPts = ptsBetween(snap, t.element_in, t.event, to);
      const outPts = ptsBetween(snap, t.element_out, t.event, to);
      return {
        gw: t.event,
        in: ref(snap.players, t.element_in),
        out: ref(snap.players, t.element_out),
        inPts,
        outPts,
        delta: inPts - outPts,
        span: to - t.event + 1,
        freeHit,
      };
    })
    .sort((a, b) => b.gw - a.gw);
}

export function computeLeagueStats(snap: LeagueSnapshot): LeagueStats {
  const gws = snap.playedGws;
  const positions = leaguePositions(snap);
  const lastGw = gws.at(-1);

  // GW winners / losers on net points (hits count against you). Only finished
  // gameweeks award a Drère / Mzi: a live GW is not a title yet.
  const finished = new Set(snap.events.filter((e) => e.finished).map((e) => e.id));
  const gwWinners: Record<number, ManagerSlug[]> = {};
  const gwLosers: Record<number, ManagerSlug[]> = {};
  for (const gw of gws) {
    if (!finished.has(gw)) continue;
    const nets = snap.managers
      .map((m) => {
        const h = m.history.find((x) => x.event === gw);
        return h ? { slug: m.slug, net: h.points - h.event_transfers_cost } : null;
      })
      .filter((x): x is { slug: ManagerSlug; net: number } => x !== null);
    if (!nets.length) continue;
    const max = Math.max(...nets.map((n) => n.net));
    const min = Math.min(...nets.map((n) => n.net));
    gwWinners[gw] = nets.filter((n) => n.net === max).map((n) => n.slug);
    gwLosers[gw] = nets.filter((n) => n.net === min).map((n) => n.slug);
  }

  // Current ownership, for differentials and shared players.
  const owners = new Map<number, ManagerSlug[]>();
  if (lastGw !== undefined) {
    for (const m of snap.managers) {
      for (const pk of m.picks[String(lastGw)]?.picks ?? []) {
        owners.set(pk.element, [...(owners.get(pk.element) ?? []), m.slug]);
      }
    }
  }

  const managers: ManagerStats[] = snap.managers.map((m) => {
    const rows: GwRow[] = m.history
      .filter((h) => gws.includes(h.event))
      .map((h) => {
        const details = pickDetails(snap, m, h.event);
        // Starting XI only (with Bench Boost the bench also scores, but a sub can't be captain).
        const xi = details.filter((d) => d.position <= 11);
        const captain = details.find((d) => d.multiplier >= 2) ?? null;
        const bestCaptain = xi.length ? xi.reduce((a, b) => (b.pts > a.pts ? b : a)) : null;
        const chip = m.picks[String(h.event)]?.active_chip ?? null;
        return {
          gw: h.event,
          points: h.points,
          hits: h.event_transfers_cost,
          net: h.points - h.event_transfers_cost,
          total: h.total_points,
          leaguePos: positions[h.event]?.[m.slug] ?? 0,
          overallRank: h.overall_rank,
          benchPts: h.points_on_bench,
          chip,
          transfers: h.event_transfers,
          captain,
          bestCaptain,
        };
      });

    const nets = rows.map((r) => r.net);
    const last = rows.at(-1) ?? null;
    const best = rows.length ? rows.reduce((a, b) => (b.net > a.net ? b : a)) : null;
    const worst = rows.length ? rows.reduce((a, b) => (b.net < a.net ? b : a)) : null;

    // Captaincy.
    let captainPts = 0;
    let captainMissed = 0;
    let captainBestCount = 0;
    const captainTimes = new Map<number, number>();
    for (const r of rows) {
      if (!r.captain) continue;
      captainPts += r.captain.pts * (r.captain.multiplier - 1);
      if (r.bestCaptain) {
        captainMissed += Math.max(0, r.bestCaptain.pts - r.captain.pts);
        if (r.captain.pts >= r.bestCaptain.pts) captainBestCount++;
      }
      captainTimes.set(r.captain.id, (captainTimes.get(r.captain.id) ?? 0) + 1);
    }
    const favCap = [...captainTimes.entries()].sort((a, b) => b[1] - a[1])[0];

    // Contributors & loyalty (points actually scored for this manager).
    const contrib = new Map<number, { pts: number; gws: number }>();
    for (const r of rows) {
      for (const d of pickDetails(snap, m, r.gw)) {
        if (d.bench) continue;
        const c = contrib.get(d.id) ?? { pts: 0, gws: 0 };
        c.pts += d.scored;
        c.gws += 1;
        contrib.set(d.id, c);
      }
    }
    const contribList = [...contrib.entries()].map(([id, c]) => ({ player: ref(snap.players, id), ...c }));

    const transfers = transferImpacts(snap, m);
    const realTransfers = transfers.filter((t) => !t.freeHit);
    const bestTransfer = realTransfers.length ? realTransfers.reduce((a, b) => (b.delta > a.delta ? b : a)) : null;
    const worstTransfer = realTransfers.length ? realTransfers.reduce((a, b) => (b.delta < a.delta ? b : a)) : null;

    const chips = m.chips.map((c) => {
      const r = rows.find((x) => x.gw === c.event);
      let pts = r?.points ?? 0;
      if (c.name === 'bboost') {
        // With Bench Boost the bench scores, so FPL reports 0 "points on bench".
        pts = pickDetails(snap, m, c.event)
          .filter((d) => d.position > 11)
          .reduce((s, d) => s + d.scored, 0);
      }
      if (c.name === '3xc') pts = r?.captain ? r.captain.pts : 0;
      return { name: c.name, label: CHIP_LABELS[c.name] ?? c.name, gw: c.event, pts };
    });

    // Chips: a GW whose deadline passed counts as "current" for availability.
    const nowGw = snap.nextEvent?.id ?? (lastGw ?? 1) + 1;
    const chipStatus = chipStatuses(snap.chipWindows, m.chips, nowGw);
    const chipsLeftNow = chipStatus
      .filter((c) => c.status === 'available' && c.start <= nowGw && c.stop >= nowGw)
      .map((c) => c.label);

    const lastHist = m.history.at(-1);
    const differentials =
      lastGw === undefined
        ? []
        : (m.picks[String(lastGw)]?.picks ?? [])
            .filter((pk) => (owners.get(pk.element) ?? []).length === 1)
            .map((pk) => ({
              player: ref(snap.players, pk.element),
              seasonPts: snap.players[String(pk.element)]?.totalPoints ?? 0,
            }))
            .sort((a, b) => b.seasonPts - a.seasonPts);

    return {
      slug: m.slug,
      teamName: m.teamName,
      total: last?.total ?? 0,
      leaguePos: last?.leaguePos ?? 0,
      rows,
      last,
      avg: mean(nets),
      form3: mean(nets.slice(-3)),
      form5: mean(nets.slice(-5)),
      stdev: stdev(nets),
      best: best ? { gw: best.gw, pts: best.net } : null,
      worst: worst ? { gw: worst.gw, pts: worst.net } : null,
      drereCount: Object.values(gwWinners).filter((s) => s.includes(m.slug)).length,
      mziCount: Object.values(gwLosers).filter((s) => s.includes(m.slug)).length,
      weeksTop: rows.filter((r) => r.leaguePos === 1).length,
      captainPts,
      captainMissed,
      captainBestCount,
      favouriteCaptain: favCap ? { player: ref(snap.players, favCap[0]), times: favCap[1] } : null,
      benchPts: rows.reduce((s, r) => s + r.benchPts, 0),
      hitsPts: rows.reduce((s, r) => s + r.hits, 0),
      transfersCount: m.transfers.length,
      chips,
      chipStatus,
      chipsLeftNow,
      topContributors: [...contribList].sort((a, b) => b.pts - a.pts).slice(0, 8),
      loyal: [...contribList].sort((a, b) => b.gws - a.gws || b.pts - a.pts).slice(0, 5).map(({ player, gws }) => ({ player, gws })),
      transfers,
      bestTransfer,
      worstTransfer,
      transferNet: realTransfers.reduce((s, t) => s + t.delta, 0),
      differentials,
      teamValue: lastHist ? lastHist.value / 10 : null,
      bank: lastHist ? lastHist.bank / 10 : null,
      overallRank: m.overallRank,
    };
  });

  managers.sort((a, b) => a.leaguePos - b.leaguePos || b.total - a.total);
  const bySlug = Object.fromEntries(managers.map((m) => [m.slug, m])) as Record<ManagerSlug, ManagerStats>;

  // Head-to-head on net GW points.
  const h2h = {} as LeagueStats['h2h'];
  for (const a of managers) {
    h2h[a.slug] = {} as Record<ManagerSlug, H2HRecord>;
    for (const b of managers) {
      if (a.slug === b.slug) continue;
      const rec: H2HRecord = { w: 0, d: 0, l: 0, diff: 0 };
      for (const ra of a.rows) {
        const rb = b.rows.find((r) => r.gw === ra.gw);
        if (!rb) continue;
        if (ra.net > rb.net) rec.w++;
        else if (ra.net < rb.net) rec.l++;
        else rec.d++;
        rec.diff += ra.net - rb.net;
      }
      h2h[a.slug][b.slug] = rec;
    }
  }

  const shared = [...owners.entries()]
    .filter(([, o]) => o.length >= 2)
    .map(([id, o]) => ({ player: ref(snap.players, id), owners: o }))
    .sort((a, b) => b.owners.length - a.owners.length);

  const allTransfers = managers.flatMap((m) => m.transfers.filter((t) => !t.freeHit).map((t) => ({ ...t, slug: m.slug })));
  const biggestTransfer = allTransfers.length ? allTransfers.reduce((a, b) => (b.delta > a.delta ? b : a)) : null;
  const worstTransferOverall = allTransfers.length ? allTransfers.reduce((a, b) => (b.delta < a.delta ? b : a)) : null;

  const allRows = managers.flatMap((m) => m.rows.map((r) => ({ slug: m.slug, gw: r.gw, pts: r.net })));
  const highestGw = allRows.length ? allRows.reduce((a, b) => (b.pts > a.pts ? b : a)) : null;
  const lowestGw = allRows.length ? allRows.reduce((a, b) => (b.pts < a.pts ? b : a)) : null;

  return {
    gws,
    managers,
    bySlug,
    leader: managers[0],
    gwWinners,
    gwLosers,
    h2h,
    shared,
    biggestTransfer,
    worstTransferOverall,
    highestGw,
    lowestGw,
  };
}

/** Everything the review writer needs about ONE gameweek, all numbers pre-computed. */
export function gameweekFacts(snap: LeagueSnapshot, stats: LeagueStats, gw: number) {
  const avg = snap.events.find((e) => e.id === gw)?.average_entry_score ?? null;
  const managers = snap.managers.map((m) => {
    const st = stats.bySlug[m.slug];
    const row = st.rows.find((r) => r.gw === gw);
    const prev = st.rows.find((r) => r.gw === gw - 1);
    const details = pickDetails(snap, m, gw);
    const xi = details.filter((d) => !d.bench).sort((a, b) => b.scored - a.scored);
    const bench = details.filter((d) => d.bench);
    const transfers = m.transfers
      .filter((t) => t.event === gw)
      .map((t) => ({
        in: ref(snap.players, t.element_in).name,
        out: ref(snap.players, t.element_out).name,
        inPtsThisGw: livePts(snap, gw, t.element_in),
        outPtsThisGw: livePts(snap, gw, t.element_out),
      }));
    const othersCaptains = snap.managers
      .filter((o) => o.slug !== m.slug)
      .map((o) => stats.bySlug[o.slug].rows.find((r) => r.gw === gw)?.captain?.name)
      .filter(Boolean);
    return {
      who: MANAGER_BY_SLUG[m.slug].firstName,
      slug: m.slug,
      team: m.teamName,
      gwPoints: row?.points ?? null,
      hitCost: row?.hits ?? 0,
      netPoints: row?.net ?? null,
      seasonTotal: row?.total ?? null,
      leaguePosition: row?.leaguePos ?? null,
      leaguePositionBefore: prev?.leaguePos ?? null,
      chip: row?.chip ? (CHIP_LABELS[row.chip] ?? row.chip) : null,
      captain: row?.captain ? { name: row.captain.name, rawPts: row.captain.pts, multiplier: row.captain.multiplier } : null,
      bestPossibleCaptain: row?.bestCaptain ? { name: row.bestCaptain.name, rawPts: row.bestCaptain.pts } : null,
      captainSameAsOthers: row?.captain ? othersCaptains.filter((c) => c === row.captain!.name).length : 0,
      topScorers: xi.slice(0, 3).map((d) => ({ name: d.name, pts: d.scored })),
      blanks: xi.filter((d) => d.pts <= 2).map((d) => ({ name: d.name, pts: d.pts, minutes: d.minutes })),
      benchPoints: row?.benchPts ?? 0,
      benchStars: bench.filter((d) => d.pts >= 6).map((d) => ({ name: d.name, pts: d.pts })),
      transfers,
      seasonCaptainPointsMissed: st.captainMissed,
      seasonBenchPoints: st.benchPts,
      seasonHits: st.hitsPts,
      seasonDrereCount: st.drereCount,
      seasonMziCount: st.mziCount,
      form3: Math.round(st.form3 * 10) / 10,
      differentialsNow: st.differentials.slice(0, 3).map((d) => d.player.name),
      chipsStillAvailableThisHalf: st.chipsLeftNow,
    };
  });
  return {
    gameweek: gw,
    fplAverage: avg,
    drere: stats.gwWinners[gw] ?? [],
    mzi: stats.gwLosers[gw] ?? [],
    leader: stats.leader.slug,
    gapLeaderToSecond: stats.managers[1] ? stats.leader.total - stats.managers[1].total : 0,
    managers,
  };
}

export type GameweekFacts = ReturnType<typeof gameweekFacts>;
