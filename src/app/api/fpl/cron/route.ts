import { NextResponse, type NextRequest } from 'next/server';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth/session';
import { buildSnapshot } from '@/lib/fpl/snapshot';
import { computeLeagueStats } from '@/lib/fpl/stats';
import { runReviewPipeline } from '@/lib/fpl/review';

// The review call can take a while (Claude writes ~1-2k words of JSON).
export const maxDuration = 300;

async function run(opts: { gw?: number; withSong?: boolean }) {
  // Always work on fresh data here, and refresh the cached site data too.
  const snap = await buildSnapshot();
  const stats = computeLeagueStats(snap);
  const result = await runReviewPipeline(snap, stats, opts);
  revalidateTag('fpl', 'max');
  console.log('[fpl] cron result:', JSON.stringify(result));
  return result;
}

// GET — Vercel Cron (sends "Authorization: Bearer $CRON_SECRET").
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json(await run({}));
  } catch (e) {
    console.error('[fpl] cron failed:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
}

const ManualSchema = z.object({
  gw: z.number().int().min(1).max(38).optional(),
  withSong: z.boolean().optional(),
});

// POST — manual trigger by an admin (same idempotent pipeline, same budget cap).
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user?.is_admin) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  const parsed = ManualSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  try {
    return NextResponse.json(await run(parsed.data));
  } catch (e) {
    console.error('[fpl] manual run failed:', e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
}
