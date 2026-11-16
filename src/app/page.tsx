// FPL home — the Ziarclays Zbremiership (4 friends' Fantasy Premier League).
import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowRight } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { getSessionUser } from '@/lib/auth/session';
import { getLeague } from '@/lib/fpl/data';
import { getReviews } from '@/lib/fpl/review';
import { gameweekFacts } from '@/lib/fpl/stats';
import { positionsSeries } from '@/lib/fpl/series';
import {
  FPL_LEAGUE_NAME,
  FPL_SEASON,
  MANAGER_BY_SLUG,
  ibanJoke,
  managerForMember,
  photoUrl,
  type ManagerSlug,
} from '@/lib/fpl/config';
import { Face, SectionHead, Stars, cssColor, fmtBrussels, fmtRank, ordinal } from '@/components/fpl/ui';
import { Countdown, GwCelebration } from '@/components/fpl/interactive';
import { FaceLineChart } from '@/components/fpl/charts';
import { ReviewSection } from '@/components/fpl/ReviewSection';

export const metadata = { title: `${FPL_LEAGUE_NAME} — ZbrePlanning` };

function FplError({ message }: { message: string }) {
  return (
    <div className="theme-fpl">
      <Navbar />
      <main className="max-w-[1080px] mx-auto px-4 py-16 text-center">
        <h1 className="f-display text-3xl font-bold">FPL ne répond pas</h1>
        <p className="mt-3 text-[var(--f-muted)]">
          Le site officiel de la Fantasy Premier League est indisponible (souvent pendant les mises à jour du
          mardi). Réessaie dans quelques minutes.
        </p>
        <p className="mt-6 text-xs text-[var(--f-muted-2)]">{message}</p>
      </main>
    </div>
  );
}

export default async function FplHome() {
  const user = await getSessionUser();
  const me = managerForMember(user?.member_slug)?.slug;

  let league;
  try {
    league = await getLeague();
  } catch (e) {
    console.error('[fpl] home: league load failed', e);
    return <FplError message={e instanceof Error ? e.message : 'unknown error'} />;
  }
  const { snap, stats } = league;
  const reviews = await getReviews();

  const lastGw = stats.gws.at(-1);
  if (lastGw === undefined) return <FplError message="Aucune gameweek jouée pour l’instant." />;

  // The "week" shown = latest GW FPL has finished (live GW shown in the ticker).
  const finishedGws = snap.events.filter((e) => e.finished).map((e) => e.id);
  const reviewGw = finishedGws.length ? Math.max(...finishedGws) : lastGw;
  const facts = gameweekFacts(snap, stats, reviewGw);
  const reviewRow = reviews.find((r) => r.gw === reviewGw) ?? null;

  const liveGw = snap.currentGw !== null && !snap.currentGwFinished ? snap.currentGw : null;
  const leader = stats.leader;
  const second = stats.managers[1];
  const leaderM = MANAGER_BY_SLUG[leader.slug];
  const gap = second ? leader.total - second.total : 0;
  const next = snap.nextEvent;

  const tickerGw = liveGw ?? reviewGw;
  const ticker = [...stats.managers]
    .map((m) => ({ m, row: m.rows.find((r) => r.gw === tickerGw) }))
    .sort((a, b) => (b.row?.net ?? 0) - (a.row?.net ?? 0));

  return (
    <div className="theme-fpl pb-24 md:pb-10">
      <Navbar />

      {/* Hero */}
      <header className="relative overflow-hidden border-b border-[var(--f-line)]">
        <div className="absolute inset-0 f-hatch" aria-hidden="true" />
        <div className="absolute inset-0 grid grid-cols-4 opacity-[0.22]" aria-hidden="true">
          {stats.managers.map((m) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={m.slug} src={photoUrl(m.slug, 'full')} alt="" className="w-full h-full object-cover object-top" />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0b]/60 via-[#0a0a0b]/70 to-[#0a0a0b]" aria-hidden="true" />
        <div className="relative max-w-[1080px] mx-auto px-4 pt-10 pb-8 md:pt-16 md:pb-12">
          <div className="f-label !text-[var(--f-red)] tracking-[0.3em]">Fantasy Premier League · {FPL_SEASON}</div>
          <h1 className="f-anton text-[clamp(2.6rem,9vw,6rem)] mt-2">{FPL_LEAGUE_NAME}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {liveGw ? (
              <span className="inline-flex items-center gap-2 f-display font-semibold">
                <span className="w-2 h-2 rounded-full bg-[var(--f-red)] animate-pulse" aria-hidden="true" />
                GW{liveGw} en cours — points en direct
              </span>
            ) : null}
            {next ? (
              <span className="f-display">
                <span className="text-[var(--f-muted)]">Deadline GW{next.id} · </span>
                {fmtBrussels(next.deadline_time)}
                <span className="text-[var(--f-muted)]"> · </span>
                <Countdown iso={next.deadline_time} />
              </span>
            ) : null}
          </div>
        </div>
      </header>

      {/* Ticker */}
      <div className="border-b border-[var(--f-line)] bg-[var(--f-bg-soft)]">
        <div className="max-w-[1080px] mx-auto px-4 flex items-stretch overflow-x-auto">
          <div className="f-label flex items-center pr-4 mr-2 border-r border-[var(--f-line)] shrink-0">
            {liveGw ? `Live GW${liveGw}` : `GW${tickerGw}`}
          </div>
          {ticker.map(({ m, row }) => (
            <div key={m.slug} className="flex items-center gap-2.5 px-3 py-3 shrink-0 border-r border-[var(--f-line-soft)]" style={cssColor(m.slug)}>
              <Face slug={m.slug} size={28} />
              <div>
                <div className="text-xs font-semibold" style={{ color: MANAGER_BY_SLUG[m.slug].color }}>
                  {MANAGER_BY_SLUG[m.slug].firstName}
                </div>
                <div className="f-num text-lg leading-none">{row?.net ?? '—'}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <main className="max-w-[1080px] mx-auto px-4 pt-8">
        {/* Leader */}
        <section className="f-champ p-6 md:p-8 mb-10 text-center f-in">
          <div className="f-label !text-[var(--f-gold)]">Classement après la GW{lastGw}</div>
          <div className="mt-3 flex justify-center">
            <Face slug={leader.slug} size={96} />
          </div>
          <h2 className="f-display text-4xl md:text-6xl font-bold mt-4 leading-none">
            {leaderM.firstName} <span className="text-[var(--f-gold)]">— en tête</span>
          </h2>
          <div className="mt-2 text-[var(--f-muted)]">
            <span className="f-num text-[var(--f-gold)] text-xl">{leader.total} pts</span>
            {second ? <span> · {gap === 0 ? 'à égalité avec' : `${gap} pt${gap > 1 ? 's' : ''} devant`} {MANAGER_BY_SLUG[second.slug].firstName}</span> : null}
          </div>
          <p className="mt-4 text-lg md:text-xl font-semibold">
            « {reviewRow?.review?.ibanJoke ?? ibanJoke(leaderM.firstName, lastGw)} »
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {stats.managers.map((m) => (
              <span key={m.slug} className="f-pill" style={m.slug === leader.slug ? { borderColor: 'rgba(244,196,48,.5)' } : undefined}>
                <Face slug={m.slug} size={26} />
                <span className="text-sm">
                  <span className="text-[var(--f-muted)]">{ordinal(m.leaguePos)}</span> {MANAGER_BY_SLUG[m.slug].firstName}
                </span>
                <span className="f-num">{m.total}</span>
              </span>
            ))}
          </div>
        </section>

        {/* Review of the week */}
        <ReviewSection row={reviewRow} facts={facts} />

        {/* Managers */}
        <section className="mb-10">
          <SectionHead title="Les managers" right={<Link href="/fpl/managers" className="f-link">Les fiches complètes</Link>} />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.managers.map((m) => {
              const cfg = MANAGER_BY_SLUG[m.slug];
              const prevPos = m.rows.at(-2)?.leaguePos;
              const move = prevPos ? prevPos - m.leaguePos : 0;
              return (
                <Link
                  key={m.slug}
                  href={`/fpl/managers#${m.slug}`}
                  className="f-card f-rule-top overflow-hidden group transition-transform duration-150 hover:-translate-y-0.5"
                  style={cssColor(m.slug)}
                >
                  <div className="relative aspect-[3/4] bg-[var(--f-surface-2)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoUrl(m.slug, 'full')} alt={cfg.fullName} loading="lazy" className="absolute inset-0 w-full h-full object-cover object-top" />
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 to-transparent" />
                    <div className="absolute top-2 left-2 f-anton text-5xl text-white/90 drop-shadow">{m.leaguePos}</div>
                    {me === m.slug ? (
                      <span className="absolute top-2 right-2 f-label !text-black bg-[var(--f-gold)] px-1.5 py-0.5 rounded">Toi</span>
                    ) : null}
                    <div className="absolute bottom-2 left-3 right-3">
                      <Stars count={cfg.stars} size={14} />
                      <div className="f-display text-xl font-bold leading-tight">{cfg.firstName}</div>
                      <div className="text-xs text-[#c9ccd3] truncate">{m.teamName}</div>
                    </div>
                  </div>
                  <div className="p-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="f-label">Total</div>
                      <div className="f-num text-xl">{m.total}</div>
                    </div>
                    <div>
                      <div className="f-label">GW{m.last?.gw}</div>
                      <div className="f-num text-xl flex items-center gap-1">
                        {m.last?.net ?? '—'}
                        {move > 0 ? <ArrowUp className="w-4 h-4 text-[var(--f-green)]" aria-label="monte" /> : null}
                        {move < 0 ? <ArrowDown className="w-4 h-4 text-[var(--f-down)]" aria-label="descend" /> : null}
                      </div>
                    </div>
                    <div className="col-span-2 text-xs text-[var(--f-muted)]">
                      Rang mondial {fmtRank(m.overallRank)} ·{' '}
                      {m.chipsLeftNow.length ? `chips : ${m.chipsLeftNow.join(', ')}` : 'plus de chips avant la GW20'}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Race */}
        <section className="mb-10">
          <SectionHead title="La course" right={<Link href="/fpl/stats" className="f-link">Toutes les stats</Link>} />
          <div className="f-card p-3 md:p-5">
            <div className="f-label mb-2">Position dans la ligue, GW par GW</div>
            <FaceLineChart data={positionsSeries(stats)} invert domain={[1, 4]} ticks={[1, 2, 3, 4]} valueFormatter={(v) => ordinal(v)} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            {stats.managers.map((m) => (
              <div key={m.slug} className="f-card f-rule p-3" style={cssColor(m.slug)}>
                <div className="f-label">{MANAGER_BY_SLUG[m.slug].firstName}</div>
                <div className="text-sm mt-1">
                  <span className="f-num text-lg">{m.drereCount}</span> <span className="text-[var(--f-muted)]">× Drère</span>
                  <span className="mx-1.5 text-[var(--f-line)]">|</span>
                  <span className="f-num text-lg">{m.mziCount}</span> <span className="text-[var(--f-muted)]">× Mzi</span>
                </div>
                <div className="text-xs text-[var(--f-muted)] mt-1">{m.weeksTop} semaine{m.weeksTop > 1 ? 's' : ''} en tête</div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-right">
            <Link href="/fpl/reviews" className="inline-flex items-center gap-1 f-link min-h-[44px]">
              Toutes les reviews <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        <p className="text-xs text-[var(--f-muted-2)] pb-4">
          Données Fantasy Premier League, mises à jour toutes les 5 minutes (dernière : {fmtBrussels(snap.fetchedAt, false)}).
        </p>
      </main>

      <GwCelebration
        gw={reviewGw}
        drere={facts.drere as ManagerSlug[]}
        mzi={facts.mzi as ManagerSlug[]}
        drerePts={facts.managers.find((m) => m.slug === facts.drere[0])?.netPoints ?? null}
        mziPts={facts.managers.find((m) => m.slug === facts.mzi[0])?.netPoints ?? null}
      />
    </div>
  );
}
