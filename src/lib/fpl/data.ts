// Server-side cached access to the league data (see snapshot.ts for the fetcher).
import 'server-only';
import { unstable_cache } from 'next/cache';
import { buildSnapshot } from './snapshot';
import { computeLeagueStats } from './stats';

/** Cached for 5 minutes; tag 'fpl' can be revalidated on demand. */
export const getSnapshot = unstable_cache(buildSnapshot, ['fpl-snapshot-v1'], {
  revalidate: 300, // 5 min: near-live during a gameweek
  tags: ['fpl'],
});

export async function getLeague() {
  const snap = await getSnapshot();
  return { snap, stats: computeLeagueStats(snap) };
}
