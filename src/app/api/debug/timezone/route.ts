import { NextResponse } from 'next/server';
import {
  getMatchById,
  getMatchKickoff,
  getPredictionLockTime,
  isPredictionLocked,
  formatBelgiumTime,
  getMatchTimezoneDebug,
  FIRST_MATCH_KICKOFF,
  GLOBAL_PREDICTIONS_LOCK,
  areGlobalPredictionsLocked,
  getTimeUntilGlobalLock,
} from '@/lib/matches';

// GET /api/debug/timezone
// Returns timezone debug info for first 3 matches + global predictions
// Use this to verify timezone handling is correct on Vercel (UTC)
export async function GET() {
  const now = new Date();

  // Debug info for matches 1, 2, 3
  const matchDebug = [1, 2, 3].map(id => getMatchTimezoneDebug(id));

  // Global predictions debug
  const globalDebug = {
    firstMatchKickoffUtc: FIRST_MATCH_KICKOFF.toISOString(),
    firstMatchKickoffBelgium: formatBelgiumTime(FIRST_MATCH_KICKOFF),
    globalLockUtc: GLOBAL_PREDICTIONS_LOCK.toISOString(),
    globalLockBelgium: formatBelgiumTime(GLOBAL_PREDICTIONS_LOCK),
    isGlobalLocked: areGlobalPredictionsLocked(),
    msUntilGlobalLock: getTimeUntilGlobalLock(),
  };

  // Server info
  const serverInfo = {
    nowUtc: now.toISOString(),
    nowBelgium: formatBelgiumTime(now),
    serverTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    nodeVersion: process.version,
  };

  return NextResponse.json({
    status: 'ok',
    description: 'Timezone debug - verify kickoff times are correctly interpreted as Europe/Brussels',
    serverInfo,
    globalPredictions: globalDebug,
    matches: matchDebug,
    verification: {
      match1Expected: {
        kickoffBelgium: '11/06/2026 21:00:00',
        lockBelgium: '11/06/2026 19:00:00',
        kickoffUtc: '2026-06-11T19:00:00.000Z',
        lockUtc: '2026-06-11T17:00:00.000Z',
      },
      match2Expected: {
        kickoffBelgium: '12/06/2026 04:00:00',
        lockBelgium: '12/06/2026 02:00:00',
        kickoffUtc: '2026-06-12T02:00:00.000Z',
        lockUtc: '2026-06-12T00:00:00.000Z',
      },
    },
  });
}
