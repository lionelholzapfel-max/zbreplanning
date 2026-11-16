// Archive of every gameweek review, newest first.
import Navbar from '@/components/Navbar';
import { getLeague } from '@/lib/fpl/data';
import { getReviews } from '@/lib/fpl/review';
import { computeLeagueStats, gameweekFacts } from '@/lib/fpl/stats';
import { snapshotAtGw } from '@/lib/fpl/snapshot';
import { FPL_LEAGUE_NAME } from '@/lib/fpl/config';
import { ReviewSection } from '@/components/fpl/ReviewSection';

// Behind login and fed by live FPL data (cached 5 min in data.ts): never prerender.
export const dynamic = 'force-dynamic';

export const metadata = { title: `Reviews — ${FPL_LEAGUE_NAME}` };

export default async function ReviewsPage() {
  let league;
  try {
    league = await getLeague();
  } catch (e) {
    console.error('[fpl] reviews: league load failed', e);
    league = null;
  }
  const reviews = await getReviews();
  const finished = league ? league.snap.events.filter((e) => e.finished).map((e) => e.id).sort((a, b) => b - a) : [];

  return (
    <div className="theme-fpl pb-24 md:pb-10">
      <Navbar />
      <main className="max-w-[1080px] mx-auto px-4 pt-8">
        <div className="f-label !text-[var(--f-red)] tracking-[0.3em]">Les archives</div>
        <h1 className="f-anton text-5xl md:text-7xl mt-1 mb-8">Les reviews</h1>
        {!league ? <p className="text-[var(--f-muted)]">FPL ne répond pas, réessaie dans quelques minutes.</p> : null}
        {league
          ? finished.map((gw) => (
              <ReviewSection
                key={gw}
                row={reviews.find((r) => r.gw === gw) ?? null}
                facts={(() => {
                  const frozen = snapshotAtGw(league.snap, gw);
                  return gameweekFacts(frozen, computeLeagueStats(frozen), gw);
                })()}
              />
            ))
          : null}
      </main>
    </div>
  );
}
