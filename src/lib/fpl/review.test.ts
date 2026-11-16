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
function snapWith(checked: number[]) {
  const gws = [1, 2, 3];
  const hist = (e: number) => ({
    event: e, points: 50, total_points: 50 * e, rank: null, overall_rank: 1, bank: 0, value: 1000,
    event_transfers: 0, event_transfers_cost: 0, points_on_bench: 0,
  });
  return {
    fetchedAt: '', chipWindows: [], playedGws: gws, lastFinishedGw: 3, currentGw: 3, currentGwFinished: true, nextEvent: null,
    events: gws.map((id) => ({
      id, name: `GW${id}`, deadline_time: '2026-08-01T10:00:00Z', finished: true, data_checked: checked.includes(id),
      is_current: id === 3, is_next: false, average_entry_score: 50, highest_score: 90,
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

  it('catches up at most the GW just before the latest, without a song, never further back', async () => {
    parse.mockResolvedValue(okResponse);
    await runReviewPipeline(snapWith([1, 2, 3]), { gw: 1, withSong: false }); // manual test on GW1
    await runReviewPipeline(snapWith([1, 2, 3])); // cron: latest = GW3
    await runReviewPipeline(snapWith([1, 2, 3])); // cron: GW2 just before latest was missed → caught up, no song
    await runReviewPipeline(snapWith([1, 2, 3])); // cron: nothing left
    expect(table.map((r) => r.gw).sort()).toEqual([1, 2, 3]);
    expect(parse).toHaveBeenCalledTimes(3);
    // Only GW3 (the week that just ended) asked Suno for a song.
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it('does not review a GW whose points FPL has not validated yet', async () => {
    parse.mockResolvedValue(okResponse);
    const res = await runReviewPipeline(snapWith([1, 2]), { withSong: false });
    expect(res).toMatchObject({ action: 'generated', gw: 2 });
  });
});
