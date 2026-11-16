// Manager bios — one full-screen "tale of the tape" per manager.
import Navbar from '@/components/Navbar';
import { getLeague } from '@/lib/fpl/data';
import { FPL_LEAGUE_NAME, MANAGERS, MANAGER_BY_SLUG, photoUrl, type ManagerSlug } from '@/lib/fpl/config';
import { Delta, Face, Name, Stars, cssColor, fmtRank, ordinal, dec } from '@/components/fpl/ui';

// Behind login and fed by live FPL data (cached 5 min in data.ts): never prerender.
export const dynamic = 'force-dynamic';

export const metadata = { title: `Managers — ${FPL_LEAGUE_NAME}` };

export default async function ManagersPage() {
  let league;
  try {
    league = await getLeague();
  } catch (e) {
    console.error('[fpl] managers: league load failed', e);
    league = null;
  }
  const stats = league?.stats ?? null;
  const snap = league?.snap ?? null;

  // Sort by current position when we have data, else by stars.
  const order = stats ? stats.managers.map((m) => m.slug) : [...MANAGERS].sort((a, b) => b.stars - a.stars).map((m) => m.slug);

  return (
    <div className="theme-fpl pb-24 md:pb-10">
      <Navbar />
      <h1 className="sr-only">Les managers</h1>
      <nav className="sticky top-14 z-40 bg-[#0a0a0b]/90 backdrop-blur border-b border-[var(--f-line)]" aria-label="Managers">
        <div className="max-w-[1080px] mx-auto px-4 flex gap-1 overflow-x-auto">
          {order.map((slug) => (
            <a key={slug} href={`#${slug}`} className="flex items-center gap-2 px-3 py-2.5 shrink-0 min-h-[44px]">
              <Face slug={slug} size={24} />
              <span className="f-display text-sm">{MANAGER_BY_SLUG[slug].firstName}</span>
            </a>
          ))}
        </div>
      </nav>

      {order.map((slug, idx) => {
        const cfg = MANAGER_BY_SLUG[slug];
        const st = stats?.bySlug[slug];
        const past = snap?.managers.find((m) => m.slug === slug)?.past ?? [];
        // Rival = the opponent with the tightest head-to-head points difference.
        const rival =
          stats && st
            ? (Object.entries(stats.h2h[slug]) as [ManagerSlug, { w: number; d: number; l: number; diff: number }][]).sort(
                (a, b) => Math.abs(a[1].diff) - Math.abs(b[1].diff),
              )[0]
            : null;
        const bestPast = past.length ? past.reduce((a, b) => (b.rank < a.rank ? b : a)) : null;
        return (
          <section
            key={slug}
            id={slug}
            className="relative overflow-hidden scroll-mt-28 border-b border-[var(--f-line)]"
            style={cssColor(slug)}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(120% 90% at ${idx % 2 ? '78%' : '22%'} 50%, color-mix(in srgb, ${cfg.color} 22%, transparent) 0%, transparent 55%)`,
              }}
              aria-hidden="true"
            />
            <div
              className="absolute -bottom-10 right-2 f-anton select-none pointer-events-none"
              style={{ fontSize: 'clamp(10rem,30vw,26rem)', color: `color-mix(in srgb, ${cfg.color} 9%, transparent)` }}
              aria-hidden="true"
            >
              {st?.leaguePos ?? idx + 1}
            </div>
            <div className="relative max-w-[1080px] mx-auto px-4 py-12 md:py-20 grid md:grid-cols-[minmax(260px,0.9fr)_1.1fr] gap-8 md:gap-14 items-start">
              <div className={`md:sticky md:top-32 ${idx % 2 ? 'md:order-2' : ''}`}>
                <div className="relative">
                  <div className="absolute -inset-6 f-glow rounded-3xl" aria-hidden="true" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl(slug, 'full')}
                    alt={cfg.fullName}
                    className="relative w-full aspect-[3/4] object-cover object-top rounded-2xl"
                    style={{ boxShadow: `0 30px 70px rgba(0,0,0,.65), 0 0 0 1px color-mix(in srgb, ${cfg.color} 35%, #000)` }}
                  />
                </div>
              </div>

              <div>
                <div className="f-label tracking-[0.3em]" style={{ color: cfg.color }}>
                  {st ? `${ordinal(st.leaguePos)} de la ligue` : 'Manager'} · {st?.teamName}
                </div>
                <h2 className="f-anton mt-2" style={{ fontSize: 'clamp(3rem,9vw,6.5rem)' }}>
                  {cfg.firstName}
                </h2>
                <div className="f-display text-xl md:text-2xl mt-1" style={{ color: cfg.color }}>
                  « {cfg.ringName} »
                </div>
                <p className="mt-2 text-[var(--f-muted)]">{cfg.tagline}</p>

                <div className="mt-5 f-card p-4">
                  <div className="flex items-center gap-3">
                    <Stars count={cfg.stars} size={26} />
                    <span className="f-display text-lg">{cfg.stars} titre{cfg.stars > 1 ? 's' : ''}</span>
                  </div>
                  <ul className="mt-3 space-y-1 text-sm text-[#d9dce2]">
                    {cfg.starNotes.map((n, i) => (
                      <li key={i} className="flex gap-2">
                        <span style={{ color: 'var(--f-gold)' }} aria-hidden="true">★</span>
                        {n}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5 space-y-3 text-[16px] leading-relaxed text-[#e4e6ea] f-rule pl-4">
                  {cfg.bio.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>

                {st ? (
                  <>
                    <div className="mt-6 grid grid-cols-3 gap-px bg-[var(--f-line)] rounded-[10px] overflow-hidden">
                      {[
                        { l: 'Total', v: st.total },
                        { l: 'Rang mondial', v: fmtRank(st.overallRank) },
                        { l: 'Moy./GW', v: dec(st.avg) },
                        { l: 'Drère', v: `${st.drereCount}×` },
                        { l: 'Mzi', v: `${st.mziCount}×` },
                        { l: 'Meilleure GW', v: st.best ? `${st.best.pts}` : '—' },
                      ].map((x) => (
                        <div key={x.l} className="bg-[var(--f-surface)] p-3">
                          <div className="f-label">{x.l}</div>
                          <div className="f-num text-2xl">{x.v}</div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid sm:grid-cols-2 gap-3">
                      <div className="f-card f-rule p-4">
                        <div className="f-label" style={{ color: cfg.color }}>Prise de signature</div>
                        <div className="f-display text-lg mt-1">
                          {st.favouriteCaptain
                            ? `Le brassard sur ${st.favouriteCaptain.player.name} (${st.favouriteCaptain.times}×)`
                            : 'Pas encore de capitaine fétiche'}
                        </div>
                      </div>
                      <div className="f-card f-rule p-4">
                        <div className="f-label" style={{ color: cfg.color }}>Coup fatal</div>
                        <div className="f-display text-lg mt-1">
                          {st.bestTransfer
                            ? `${st.bestTransfer.out.name} → ${st.bestTransfer.in.name} (${st.bestTransfer.delta > 0 ? '+' : ''}${st.bestTransfer.delta})`
                            : '—'}
                        </div>
                      </div>
                      <div className="f-card f-rule p-4">
                        <div className="f-label" style={{ color: cfg.color }}>Talon d’Achille</div>
                        <div className="text-sm mt-1 text-[#d9dce2]">
                          {st.benchPts} pts laissés sur le banc, {st.captainMissed} pts ratés au brassard
                          {st.hitsPts ? `, ${st.hitsPts} pts de hits` : ''}.
                        </div>
                      </div>
                      <div className="f-card f-rule p-4">
                        <div className="f-label" style={{ color: cfg.color }}>Chips</div>
                        <div className="text-sm mt-1 text-[#d9dce2]">
                          {st.chipsLeftNow.length ? `Encore en poche : ${st.chipsLeftNow.join(', ')}` : 'Tout grillé avant la GW20'}
                        </div>
                      </div>
                    </div>

                    {rival ? (
                      <div className="mt-4 f-card p-4 flex items-center gap-3">
                        <span className="f-label px-2 py-1 rounded bg-[var(--f-gold)] !text-black">Rival</span>
                        <Face slug={rival[0]} size={32} />
                        <div className="text-sm">
                          <Name slug={rival[0]} /> · {rival[1].w}-{rival[1].d}-{rival[1].l} en face-à-face, écart{' '}
                          <Delta value={rival[1].diff} /> pts
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}

                {past.length ? (
                  <div className="mt-4 f-card p-4">
                    <div className="f-label mb-2">Historique FPL (rang mondial final)</div>
                    <div className="flex flex-wrap gap-2 text-sm">
                      {past
                        .slice(-8)
                        .reverse()
                        .map((p) => (
                          <span
                            key={p.season_name}
                            className="rounded border border-[var(--f-line)] px-2 py-1"
                            style={bestPast?.season_name === p.season_name ? { borderColor: 'var(--f-gold)' } : undefined}
                          >
                            <span className="text-[var(--f-muted)]">{p.season_name}</span>{' '}
                            <span className="f-num">{fmtRank(p.rank)}</span>
                          </span>
                        ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
