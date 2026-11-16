// Money paths of the review pipeline, against an in-memory table and a fake
// Claude: no network, no paid call, no database write.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

type Row = Record<string, unknown> & { season: string; gw: number };
const table: Row[] = [];

// Minimal chainable fake of the supabase-js calls used by review.ts.
function fakeSupabase() {
  return {
    from: () => {
      const filters: [string, unknown][] = [];
      let op: 'select' | 'update' | 'insert' = 'select';
      let patch: Record<string, unknown> = {};
      const match = () => table.filter((r) => filters.every(([k, v]) => r[k] === v));
      const run = () => {
        if (op === 'update') {
          const rows = match();
          rows.forEach((r) => Object.assign(r, patch));
          return { data: rows.map((r) => ({ ...r })), error: null };
        }
        return { data: match().map((r) => ({ ...r })), error: null };
      };
      const q = {
        select: () => q,
        eq: (k: string, v: unknown) => {
          filters.push([k, v]);
          return q;
        },
        single: async () => {
          const { data } = run();
          return data.length ? { data: data[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'none' } };
        },
        update: (p: Record<string, unknown>) => {
          op = 'update';
          patch = p;
          return q;
        },
        insert: async (row: Row) => {
          op = 'insert';
          if (table.some((r) => r.season === row.season && r.gw === row.gw)) {
            return { error: { code: '23505', message: 'duplicate key' } };
          }
          table.push({ attempts: 1, cost_usd: 0, ...row });
          return { error: null };
        },
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej),
      };
      return q;
    },
  };
}

vi.mock('@/lib/auth/session', () => ({ getSupabaseAdmin: () => fakeSupabase() }));

const parse = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {
    constructor(readonly status: number | undefined) {
      super('api error');
    }
  }
  class Anthropic {
    static APIError = APIError;
    messages = { parse };
  }
  return { default: Anthropic };
});
vi.mock('@anthropic-ai/sdk/helpers/zod', () => ({ zodOutputFormat: () => ({}) }));

const { runReviewPipeline } = await import('./review');
const { FPL_SEASON } = await import('./config');
const { default: Anthropic } = await import('@anthropic-ai/sdk');

// --- a 3-GW league where GW1..3 are validated -------------------------------
function snapWith(checked: number[], n = 3) {
  const gws = Array.from({ length: n }, (_, i) => i + 1);
  const hist = (e: number) => ({
    event: e, points: 50, total_points: 50 * e, rank: null, overall_rank: 1, bank: 0, value: 1000,
    event_transfers: 0, event_transfers_cost: 0, points_on_bench: 0,
  });
  return {
    fetchedAt: '', chipWindows: [], playedGws: gws, lastFinishedGw: n, currentGw: n, currentGwFinished: true, nextEvent: null,
    events: gws.map((id) => ({
      id, name: `GW${id}`, deadline_time: '2026-08-01T10:00:00Z', finished: true, data_checked: checked.includes(id),
      is_current: id === n, is_next: false, average_entry_score: 50, highest_score: 90,
    })),
    players: {}, live: {},
    managers: (['ramzi', 'lionel', 'greg', 'edu'] as const).map((slug, i) => ({
      slug, entryId: i, teamName: slug, overallRank: 1, history: gws.map(hist), past: [], chips: [], transfers: [], picks: {},
    })),
  } as never;
}

const okResponse = {
  stop_reason: 'end_turn',
  usage: { input_tokens: 5000, output_tokens: 3000 },
  parsed_output: { headline: 'x' },
};
const OK_COST = 5000 * 4e-6 + 3000 * 20e-6; // 0.08

describe('runReviewPipeline — money guards', () => {
  beforeEach(() => {
    table.length = 0;
    parse.mockReset();
    process.env.SUNO_API_KEY = 'test-key-not-real';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: { taskId: `task-${Math.random()}` } }) })),
    );
  });

  it('pays once per GW: a second run is skipped without calling Claude', async () => {
    parse.mockResolvedValue(okResponse);
    const first = await runReviewPipeline(snapWith([1, 2, 3]), { withSong: false });
    const second = await runReviewPipeline(snapWith([1, 2, 3]), { withSong: false });
    expect(first).toMatchObject({ action: 'generated', gw: 3 });
    expect(second.action).toBe('skipped');
    expect(parse).toHaveBeenCalledTimes(1);
    expect(table[0].cost_usd).toBeCloseTo(OK_COST);
  });

  it('keeps the cost of failed attempts and stops after 3 attempts', async () => {
    parse.mockResolvedValue({ ...okResponse, parsed_output: null });
    for (let i = 0; i < 5; i++) await runReviewPipeline(snapWith([1, 2, 3]), { withSong: false });
    expect(parse).toHaveBeenCalledTimes(3);
    expect(table[0].attempts).toBe(3);
    expect(table[0].cost_usd).toBeCloseTo(3 * OK_COST);
  });

  it('books an unbilled API error at 0 and a network failure at the worst case', async () => {
    const { APIError } = Anthropic as unknown as { APIError: new (s?: number) => Error };
    parse.mockRejectedValueOnce(new APIError(529));
    await runReviewPipeline(snapWith([1, 2, 3]), { withSong: false });
    expect(table[0].cost_usd).toBe(0);
    parse.mockRejectedValueOnce(new Error('socket hang up'));
    await runReviewPipeline(snapWith([1, 2, 3]), { withSong: false });
    expect(Number(table[0].cost_usd)).toBeGreaterThan(0.3);
  });

  it('refuses to spend once the season budget is reached', async () => {
    table.push({ season: FPL_SEASON, gw: 1, status: 'ready', attempts: 1, cost_usd: 5 });
    const res = await runReviewPipeline(snapWith([1, 2, 3]), { withSong: false });
    expect(res.action).toBe('skipped');
    expect(parse).not.toHaveBeenCalled();
  });

  it('never back-fills the season after a manual run on an old GW', async () => {
    parse.mockResolvedValue(okResponse);
    const all = [1, 2, 3, 4, 5];
    await runReviewPipeline(snapWith(all, 5), { gw: 1, withSong: false }); // manual test on GW1
    for (let i = 0; i < 4; i++) await runReviewPipeline(snapWith(all, 5)); // daily cron
    expect(table.map((r) => r.gw).sort()).toEqual([1, 5]);
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it('catches up one missed week inside an unbroken run, without a song', async () => {
    parse.mockResolvedValue(okResponse);
    for (const gw of [1, 2, 3]) table.push({ season: FPL_SEASON, gw, status: 'ready', attempts: 1, cost_usd: 0 });
    await runReviewPipeline(snapWith([1, 2, 3, 4, 5], 5)); // GW5 (latest), with its song
    await runReviewPipeline(snapWith([1, 2, 3, 4, 5], 5)); // GW4 was missed → caught up, no song
    await runReviewPipeline(snapWith([1, 2, 3, 4, 5], 5)); // nothing left
    expect(table.map((r) => r.gw).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(parse).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it('bills a killed attempt at worst case when retrying a stuck row', async () => {
    parse.mockResolvedValue(okResponse);
    const old = new Date(Date.now() - 16 * 60_000).toISOString();
    table.push({ season: FPL_SEASON, gw: 3, status: 'generating', attempts: 1, cost_usd: 0, updated_at: old });
    const res = await runReviewPipeline(snapWith([1, 2, 3]), { withSong: false });
    expect(res.action).toBe('generated');
    expect(Number(table[0].cost_usd)).toBeCloseTo(0.4 + OK_COST);
    expect(table[0].attempts).toBe(2);
  });

  it('a Suno failure leaves the stored review ready (no second paid review)', async () => {
    parse.mockResolvedValue(okResponse);
    vi.mocked(fetch).mockRejectedValue(new Error('suno down'));
    const res = await runReviewPipeline(snapWith([1, 2, 3]));
    expect(res.action).toBe('generated');
    expect(table[0].status).toBe('ready');
    expect(table[0].song_status).toBe('failed');
    await runReviewPipeline(snapWith([1, 2, 3]));
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it('does not review a GW whose points FPL has not validated yet', async () => {
    parse.mockResolvedValue(okResponse);
    const res = await runReviewPipeline(snapWith([1, 2]), { withSong: false });
    expect(res).toMatchObject({ action: 'generated', gw: 2 });
  });
});
