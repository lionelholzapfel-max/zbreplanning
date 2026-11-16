// Manual one-off: (re)launch the Drère song of an already reviewed GW.
// Usage: npx tsx --conditions=react-server --env-file=.env.local --env-file=~/.secrets/zbreplanning.env \
//          scripts/fpl-launch-song.mts <gw>
// PAID (Suno credits): run only with an explicit go.
import { buildSnapshot, snapshotAtGw } from '../src/lib/fpl/snapshot';
import { computeLeagueStats, gameweekFacts } from '../src/lib/fpl/stats';
import { buildSongBrief } from '../src/lib/fpl/song-brief';
import { launchSong } from '../src/lib/fpl/review';
import { FPL_SEASON } from '../src/lib/fpl/config';

const gw = Number(process.argv.find((a) => /^\d+$/.test(a)));
if (!gw) throw new Error('usage: fpl-launch-song.mts <gw>');
const frozen = snapshotAtGw(await buildSnapshot(), gw);
const brief = buildSongBrief(gameweekFacts(frozen, computeLeagueStats(frozen), gw));
console.log(`brief (${brief.length} chars):\n${brief}\n`);
console.log('task:', await launchSong(FPL_SEASON, gw, brief));
