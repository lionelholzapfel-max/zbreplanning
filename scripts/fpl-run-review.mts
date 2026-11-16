// Manual one-off: generate (idempotently) the review of a GW, from a local shell.
// Usage: npx tsx --conditions=react-server --env-file=.env.local --env-file=~/.secrets/zbreplanning.env \
//          scripts/fpl-run-review.mts [gw] [--song]
import { buildSnapshot } from '../src/lib/fpl/snapshot';
import { computeLeagueStats } from '../src/lib/fpl/stats';
import { runReviewPipeline } from '../src/lib/fpl/review';

const gwArg = process.argv.find((a) => /^\d+$/.test(a));
const snap = await buildSnapshot();
const stats = computeLeagueStats(snap);
const res = await runReviewPipeline(snap, stats, {
  gw: gwArg ? Number(gwArg) : undefined,
  withSong: process.argv.includes('--song'),
});
console.log(JSON.stringify(res, null, 2));
