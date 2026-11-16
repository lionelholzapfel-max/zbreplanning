import { describe, expect, it } from 'vitest';
import { chipStatuses, computeLeagueStats, gameweekFacts } from './stats';
import { buildSongBrief } from './song-brief';
import { ibanJoke } from './config';
import { snapshotAtGw } from './snapshot';
import type { LeagueSnapshot, ManagerSnapshot } from './snapshot';
import type { FplHistoryGw, FplPicks } from './schemas';

// --- tiny synthetic league -------------------------------------------------
// Players 1..15 belong to everyone's squad template; points per GW are set per test.

const PLAYERS = Object.fromEntries(
  Array.from({ length: 20 }, (_, i) => {
    const id = i + 1;
    return [String(id), { id, name: `P${id}`, fullName: `Player ${id}`, team: 'AAA', pos: 'MID' as const, cost: 5, selectedBy: 10, totalPoints: 0 }];
  }),
);

function picks(ids: number[], captain: number, opts: { chip?: string | null; benchBoost?: boolean; triple?: boolean } = {}): FplPicks {
  return {
    active_chip: opts.chip ?? null,
    automatic_subs: [],
    picks: ids.map((element, i) => {
      const position = i + 1;
      const onBench = position > 11 && !opts.benchBoost;
      const isCap = element === captain;
      return {
        element,
        position,
        multiplier: onBench ? 0 : isCap ? (opts.triple ? 3 : 2) : 1,
        is_captain: isCap,
        is_vice_captain: false,
      };
    }),
  };
}

function hist(event: number, points: number, total: number, extra: Partial<FplHistoryGw> = {}): FplHistoryGw {
  return {
    event,
    points,
    total_points: total,
    rank: null,
    overall_rank: 100000 * event,
    bank: 5,
    value: 1000,
    event_transfers: 0,
    event_transfers_cost: 0,
    points_on_bench: 0,
    ...extra,
  };
}

const SQUAD = Array.from({ length: 15 }, (_, i) => i + 1);

function manager(slug: ManagerSnapshot['slug'], entryId: number, partial: Partial<ManagerSnapshot>): ManagerSnapshot {
  return {
    slug,
    entryId,
    teamName: `${slug} FC`,
    overallRank: 1000,
    history: [],
    past: [],
    chips: [],
    transfers: [],
    picks: {},
    ...partial,
  };
}

function live(points: Record<number, number>) {
  return Object.fromEntries(
    Object.entries(points).map(([id, pts]) => [id, { pts, min: 90, g: 0, a: 0, cs: 0, bonus: 0 }]),
  );
}

function league(): LeagueSnapshot {
  // GW1: P1=10, P2=2, P12 (bench)=8. GW2: P1=1, P2=12, P16=6 (transferred in for P3), P3=0.
  return {
    fetchedAt: '2026-11-16T00:00:00Z',
    events: [
      { id: 1, name: 'GW1', deadline_time: '2026-08-15T10:00:00Z', finished: true, data_checked: true, is_current: false, is_next: false, average_entry_score: 50, highest_score: 100 },
      { id: 2, name: 'GW2', deadline_time: '2026-08-22T10:00:00Z', finished: true, data_checked: true, is_current: true, is_next: false, average_entry_score: 40, highest_score: 90 },
      { id: 3, name: 'GW3', deadline_time: '2026-08-29T10:00:00Z', finished: false, data_checked: false, is_current: false, is_next: true, average_entry_score: null, highest_score: null },
    ],
    chipWindows: [
      { name: 'bboost', start_event: 1, stop_event: 19 },
      { name: '3xc', start_event: 1, stop_event: 19 },
      { name: 'bboost', start_event: 20, stop_event: 38 },
    ],
    playedGws: [1, 2],
    lastFinishedGw: 2,
    currentGw: 2,
    currentGwFinished: true,
    nextEvent: null,
    players: PLAYERS,
    live: {
      '1': live({ 1: 10, 2: 2, 12: 8 }),
      '2': live({ 1: 1, 2: 12, 3: 0, 16: 6 }),
    },
    managers: [
      // Ramzi: captains P1 both GWs; takes a -4 hit in GW2 bringing P16 for P3.
      manager('ramzi', 1, {
        history: [hist(1, 20, 20, { points_on_bench: 8 }), hist(2, 20, 36, { event_transfers: 1, event_transfers_cost: 4 })],
        transfers: [{ element_in: 16, element_in_cost: 50, element_out: 3, element_out_cost: 50, event: 2, time: '2026-08-21T00:00:00Z' }],
        picks: { '1': picks(SQUAD, 1), '2': picks([1, 2, 16, ...SQUAD.slice(3)], 1) },
      }),
      // Lionel: Bench Boost in GW1 (P12 on bench scores 8), captains P2 in GW2.
      manager('lionel', 2, {
        history: [hist(1, 28, 28), hist(2, 25, 53)],
        chips: [{ name: 'bboost', time: '2026-08-15T00:00:00Z', event: 1 }],
        picks: { '1': picks(SQUAD, 1, { chip: 'bboost', benchBoost: true }), '2': picks(SQUAD, 2) },
      }),
      // Greg & Edu: identical boring teams → tie situations.
      manager('greg', 3, {
        history: [hist(1, 12, 12), hist(2, 14, 26)],
        picks: { '1': picks(SQUAD, 2), '2': picks(SQUAD, 1) },
      }),
      manager('edu', 4, {
        history: [hist(1, 12, 12), hist(2, 14, 26)],
        picks: { '1': picks(SQUAD, 2), '2': picks(SQUAD, 1) },
      }),
    ],
  };
}

describe('computeLeagueStats', () => {
  const snap = league();
  const stats = computeLeagueStats(snap);

  it('ranks by total and keeps the net-of-hits total', () => {
    expect(stats.managers.map((m) => m.slug)).toEqual(['lionel', 'ramzi', 'greg', 'edu']);
    const ramzi = stats.bySlug.ramzi;
    expect(ramzi.total).toBe(36);
    // net = gross GW points − hit cost, and the nets add up to the total
    expect(ramzi.rows.map((r) => r.net)).toEqual([20, 16]);
    expect(ramzi.rows.reduce((s, r) => s + r.net, 0)).toBe(ramzi.total);
    expect(ramzi.hitsPts).toBe(4);
  });

  it('shares positions on ties', () => {
    expect(stats.bySlug.greg.leaguePos).toBe(3);
    expect(stats.bySlug.edu.leaguePos).toBe(3);
  });

  it('picks GW winners and losers on net points, ties included', () => {
    expect(stats.gwWinners[1]).toEqual(['lionel']);
    expect(stats.gwLosers[1]).toEqual(['greg', 'edu']);
    expect(stats.gwWinners[2]).toEqual(['lionel']);
    expect(stats.bySlug.greg.mziCount).toBe(2);
    expect(stats.bySlug.lionel.drereCount).toBe(2);
  });

  it('measures captaincy against the best XI pick', () => {
    const ramzi = stats.bySlug.ramzi;
    // GW1 captain P1 (10) was best; GW2 captain P1 (1) vs best P2 (12) → 11 missed
    expect(ramzi.captainBestCount).toBe(1);
    expect(ramzi.captainMissed).toBe(11);
    expect(ramzi.captainPts).toBe(11); // armband extra: 10 + 1
    expect(ramzi.favouriteCaptain?.player.name).toBe('P1');
  });

  it('values Bench Boost by what the bench actually scored', () => {
    const bb = stats.bySlug.lionel.chips.find((c) => c.name === 'bboost');
    expect(bb?.pts).toBe(8);
  });

  it('computes transfer impact from the transfer GW onwards', () => {
    const t = stats.bySlug.ramzi.transfers[0];
    expect(t.in.name).toBe('P16');
    expect(t.out.name).toBe('P3');
    expect(t.inPts).toBe(6);
    expect(t.outPts).toBe(0);
    expect(t.delta).toBe(6);
    expect(stats.biggestTransfer?.slug).toBe('ramzi');
  });

  it('builds a symmetric head-to-head', () => {
    const a = stats.h2h.lionel.ramzi;
    const b = stats.h2h.ramzi.lionel;
    expect(a.w).toBe(b.l);
    expect(a.diff).toBe(-b.diff);
    expect(stats.h2h.greg.edu).toEqual({ w: 0, d: 2, l: 0, diff: 0 });
  });

  it('lists players owned by several of us', () => {
    expect(stats.shared.find((s) => s.player.id === 1)?.owners.length).toBe(4);
    // P16 is Ramzi-only → differential
    expect(stats.bySlug.ramzi.differentials.map((d) => d.player.id)).toContain(16);
  });
});

describe('chipStatuses', () => {
  const windows = [
    { name: 'wildcard', start_event: 2, stop_event: 19 },
    { name: 'wildcard', start_event: 20, stop_event: 38 },
    { name: 'freehit', start_event: 2, stop_event: 19 },
  ];

  it('marks used, available and upcoming chips per half-season', () => {
    const s = chipStatuses(windows, [{ name: 'wildcard', event: 6 }], 11);
    expect(s.find((c) => c.name === 'wildcard' && c.start === 2)?.status).toBe('used');
    expect(s.find((c) => c.name === 'wildcard' && c.start === 20)?.status).toBe('upcoming');
    expect(s.find((c) => c.name === 'freehit')?.status).toBe('available');
  });

  it('does not count a first-half chip for the second half', () => {
    const s = chipStatuses(windows, [{ name: 'wildcard', event: 6 }], 25);
    expect(s.find((c) => c.name === 'wildcard' && c.start === 20)?.status).toBe('available');
    expect(s.find((c) => c.name === 'freehit')?.status).toBe('expired');
  });
});

describe('gameweekFacts', () => {
  const snap = league();
  const stats = computeLeagueStats(snap);
  const facts = gameweekFacts(snap, stats, 2);

  it('hands the writer pre-computed, consistent numbers', () => {
    const ramzi = facts.managers.find((m) => m.slug === 'ramzi')!;
    expect(ramzi.netPoints).toBe(16);
    expect(ramzi.hitCost).toBe(4);
    expect(ramzi.captain).toEqual({ name: 'P1', rawPts: 1, multiplier: 2 });
    expect(ramzi.bestPossibleCaptain).toEqual({ name: 'P2', rawPts: 12 });
    expect(ramzi.transfers).toEqual([{ in: 'P16', out: 'P3', inPtsThisGw: 6, outPtsThisGw: 0 }]);
    expect(facts.drere).toEqual(['lionel']);
    expect(facts.leader).toBe('lionel');
  });

  it('builds a Suno brief under the 500-char API limit', () => {
    const brief = buildSongBrief(facts);
    expect(brief.length).toBeLessThanOrEqual(500);
    expect(brief).toContain('Lionel');
    expect(brief).toContain('Drère');
  });
});

describe('ibanJoke', () => {
  it('names the leader and rotates', () => {
    expect(ibanJoke('Edu', 0)).toBe('Edu, je peux avoir ton IBAN ?');
    expect(ibanJoke('Edu', 1)).not.toBe(ibanJoke('Edu', 0));
    expect(ibanJoke('Edu', -3)).toContain('Edu');
  });
});

describe('review-driven rules', () => {
  it('stops counting a transfer when the player is sold again', () => {
    const snap = league();
    snap.live['3'] = live({ 16: 20, 4: 1 });
    snap.playedGws = [1, 2, 3];
    snap.events[2] = { ...snap.events[2], finished: true, data_checked: true };
    const ramzi = snap.managers[0];
    ramzi.history.push(hist(3, 10, 46));
    ramzi.picks['3'] = picks([1, 2, 4, ...SQUAD.slice(3)], 1);
    // P16 bought in GW2, sold for P4 in GW3: his 20 pts in GW3 are not Ramzi's.
    ramzi.transfers.push({ element_in: 4, element_in_cost: 50, element_out: 16, element_out_cost: 50, event: 3, time: '2026-08-28T00:00:00Z' });
    const t = computeLeagueStats(snap).bySlug.ramzi.transfers.find((x) => x.in.id === 16)!;
    expect(t.inPts).toBe(6);
    expect(t.span).toBe(1);
  });

  it('awards no Drère / Mzi for a GW still being played', () => {
    const snap = league();
    snap.events[1] = { ...snap.events[1], finished: false, data_checked: false };
    const stats = computeLeagueStats(snap);
    expect(stats.gwWinners[2]).toBeUndefined();
    expect(stats.bySlug.lionel.drereCount).toBe(1);
  });

  it('never picks a Bench Boost substitute as the ideal captain', () => {
    const snap = league();
    snap.live['1'] = live({ 1: 10, 2: 2, 12: 30 });
    const lionel = computeLeagueStats(snap).bySlug.lionel.rows.find((r) => r.gw === 1)!;
    expect(lionel.bestCaptain?.id).toBe(1);
  });
});

describe('same-GW transfer chains', () => {
  function withGw3(moves: [number, number, string][]) {
    const snap = league();
    snap.live['3'] = live({ 3: 1, 16: 9, 17: 5, 18: 2 });
    snap.playedGws = [1, 2, 3];
    snap.events[2] = { ...snap.events[2], finished: true, data_checked: true };
    const ramzi = snap.managers[0];
    ramzi.history.push(hist(3, 10, 46));
    ramzi.transfers = moves.map(([out, inn, time]) => ({ element_in: inn, element_in_cost: 50, element_out: out, element_out_cost: 50, event: 3, time }));
    return computeLeagueStats(snap).bySlug.ramzi.transfers;
  }

  it('A->B then B->C counts as A->C', () => {
    const t = withGw3([[3, 17, '2026-08-28T01:00:00Z'], [17, 18, '2026-08-28T02:00:00Z']]);
    expect(t).toHaveLength(1);
    expect([t[0].out.id, t[0].in.id]).toEqual([3, 18]);
  });

  it('A->B then B->A leaves nothing', () => {
    expect(withGw3([[3, 17, '2026-08-28T01:00:00Z'], [17, 3, '2026-08-28T02:00:00Z']])).toEqual([]);
  });
});

describe('snapshotAtGw', () => {
  it('hides everything that happened after the reviewed GW', () => {
    const cut = snapshotAtGw(league(), 1);
    expect(cut.playedGws).toEqual([1]);
    expect(cut.managers[0].transfers).toEqual([]);
    expect(Object.keys(cut.live)).toEqual(['1']);
    const facts = gameweekFacts(cut, computeLeagueStats(cut), 1);
    expect(facts.managers.find((m) => m.slug === 'ramzi')?.seasonTotal).toBe(20);
  });
});
