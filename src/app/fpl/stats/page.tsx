// FPL analytics — dense tile dashboard, every number computed in src/lib/fpl/stats.ts.
import Navbar from '@/components/Navbar';
import { getLeague } from '@/lib/fpl/data';
import { seasonSpendUsd, SEASON_BUDGET_USD } from '@/lib/fpl/review';
import { gapSeries, gwPointsSeries, overallRankSeries, positionsSeries } from '@/lib/fpl/series';
import { FPL_LEAGUE_NAME, MANAGER_BY_SLUG, type ManagerSlug } from '@/lib/fpl/config';
import type { TransferImpact } from '@/lib/fpl/stats';
import { Delta, Face, Name, SectionHead, Tile, cssColor, fmtRank, ordinal } from '@/components/fpl/ui';
import { FaceLineChart, GwPointsBars } from '@/components/fpl/charts';
import { Expandable } from '@/components/fpl/interactive';

export const metadata = { title: `Stats — ${FPL_LEAGUE_NAME}` };

function TransferLine({ t, slug }: { t: TransferImpact; slug?: ManagerSlug }) {
  return (
    <div className="flex items-center gap-2 text-sm py-1.5 border-b border-[var(--f-line-soft)] last:border-0">
      {slug ? <Face slug={slug} size={22} /> : null}
      <span className="f-label w-12 shrink-0">GW{t.gw}</span>
      <span className="min-w-0 flex-1 truncate">
        <span className="text-[var(--f-down)]">{t.out.name}</span>
        <span className="text-[var(--f-muted)]"> → </span>
        <span className="text-[var(--f-green)]">{t.in.name}</span>
        <span className="text-[var(--f-muted-2)] text-xs"> ({t.outPts} vs {t.inPts}{t.freeHit ? ', Free Hit' : ''})</span>
      </span>
      <Delta value={t.delta} />
    </div>
  );
}

export default async function FplStatsPage() {
  let league;
  try {
    league = await getLeague();
  } catch (e) {
    console.error('[fpl] stats: league load failed', e);
    return (
      <div className="theme-fpl">
        <Navbar />
        <main className="max-w-[1080px] mx-auto px-4 py-16 text-center">
          <h1 className="f-display text-3xl font-bold">FPL ne répond pas</h1>
          <p className="mt-3 text-[var(--f-muted)]">Réessaie dans quelques minutes.</p>
        </main>
      </div>
    );
  }
  const { stats } = league;
  let spent: number | null = null;
  try {
    spent = await seasonSpendUsd();
  } catch {
    spent = null;
  }

  const ms = stats.managers;
  const max = <K extends keyof (typeof ms)[number]>(key: K) =>
    [...ms].sort((a, b) => Number(b[key]) - Number(a[key]))[0];
  const min = <K extends keyof (typeof ms)[number]>(key: K) =>
    [...ms].sort((a, b) => Number(a[key]) - Number(b[key]))[0];

  const benchKing = max('benchPts');
  const capMiss = max('captainMissed');
  const consistent = min('stdev');
  const chaos = max('stdev');
  const inForm = max('form3');
  const transferGuru = max('transferNet');

  return (
    <div className="theme-fpl pb-24 md:pb-10">
      <Navbar />
      <main className="max-w-[1080px] mx-auto px-4 pt-8">
        <div className="f-label !text-[var(--f-red)] tracking-[0.3em]">Analytics</div>
        <h1 className="f-anton text-5xl md:text-7xl mt-1 mb-8">Les stats</h1>

        {/* KPIs */}
        <section className="mb-10">
          <SectionHead title="La course" right={`Après la GW${stats.gws.at(-1)}`} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {ms.map((m) => (
              <Tile key={m.slug} label={`${ordinal(m.leaguePos)} · ${MANAGER_BY_SLUG[m.slug].firstName}`} slug={m.slug}>
                <div className="flex items-end justify-between">
                  <div className="f-num text-3xl">{m.total}</div>
                  <Face slug={m.slug} size={36} />
                </div>
                <div className="text-xs text-[var(--f-muted)] mt-1">
                  {m.slug === stats.leader.slug ? 'Leader' : `${m.total - stats.leader.total} du leader`} · moy. {m.avg.toFixed(1)}/GW
                </div>
              </Tile>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-3 mt-3">
            <div className="f-card p-3 md:p-4">
              <div className="f-label mb-2">Écart avec le leader (pts)</div>
              <FaceLineChart data={gapSeries(stats)} zeroLine />
            </div>
            <div className="f-card p-3 md:p-4">
              <div className="f-label mb-2">Position dans la ligue</div>
              <FaceLineChart data={positionsSeries(stats)} invert domain={[1, 4]} ticks={[1, 2, 3, 4]} valueFormatter={(v) => ordinal(v)} />
            </div>
          </div>
          <div className="f-card p-3 md:p-4 mt-3">
            <div className="f-label mb-2">Points par GW (hits déduits)</div>
            <GwPointsBars data={gwPointsSeries(stats)} />
          </div>
        </section>

        {/* Awards strip */}
        <section className="mb-10">
          <SectionHead title="Les trophées de la saison" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Tile label="Le plus en forme (3 dernières GW)" slug={inForm.slug}>
              <Name slug={inForm.slug} className="f-display text-xl" />
              <div className="f-num text-2xl">{inForm.form3.toFixed(1)} <span className="text-sm text-[var(--f-muted)]">pts/GW</span></div>
            </Tile>
            <Tile label="Le roi du banc" slug={benchKing.slug}>
              <Name slug={benchKing.slug} className="f-display text-xl" />
              <div className="f-num text-2xl">{benchKing.benchPts} <span className="text-sm text-[var(--f-muted)]">pts sur le banc</span></div>
            </Tile>
            <Tile label="Mauvais capitaine" slug={capMiss.slug}>
              <Name slug={capMiss.slug} className="f-display text-xl" />
              <div className="f-num text-2xl">{capMiss.captainMissed} <span className="text-sm text-[var(--f-muted)]">pts ratés au brassard</span></div>
            </Tile>
            <Tile label="Monsieur Régularité" slug={consistent.slug}>
              <Name slug={consistent.slug} className="f-display text-xl" />
              <div className="f-num text-2xl">±{consistent.stdev.toFixed(1)} <span className="text-sm text-[var(--f-muted)]">écart-type</span></div>
            </Tile>
            <Tile label="Les montagnes russes" slug={chaos.slug}>
              <Name slug={chaos.slug} className="f-display text-xl" />
              <div className="f-num text-2xl">±{chaos.stdev.toFixed(1)} <span className="text-sm text-[var(--f-muted)]">écart-type</span></div>
            </Tile>
            <Tile label="Le meilleur mercato" slug={transferGuru.slug}>
              <Name slug={transferGuru.slug} className="f-display text-xl" />
              <div className="f-num text-2xl"><Delta value={transferGuru.transferNet} /> <span className="text-sm text-[var(--f-muted)]">pts via transferts</span></div>
            </Tile>
            {stats.highestGw ? (
              <Tile label="Record d'une GW" slug={stats.highestGw.slug}>
                <Name slug={stats.highestGw.slug} className="f-display text-xl" />
                <div className="f-num text-2xl">{stats.highestGw.pts} <span className="text-sm text-[var(--f-muted)]">pts en GW{stats.highestGw.gw}</span></div>
              </Tile>
            ) : null}
            {stats.lowestGw ? (
              <Tile label="Le fond du trou" slug={stats.lowestGw.slug}>
                <Name slug={stats.lowestGw.slug} className="f-display text-xl" />
                <div className="f-num text-2xl">{stats.lowestGw.pts} <span className="text-sm text-[var(--f-muted)]">pts en GW{stats.lowestGw.gw}</span></div>
              </Tile>
            ) : null}
          </div>
        </section>

        {/* Transfers */}
        <section className="mb-10">
          <SectionHead title="Le mercato" right="Points du joueur entré moins ceux du joueur sorti, depuis le transfert" />
          <div className="grid md:grid-cols-2 gap-3 mb-3">
            {stats.biggestTransfer ? (
              <div className="f-card f-rule p-4" style={{ ['--c' as string]: 'var(--f-green)' }}>
                <div className="f-label mb-2">Le transfert de la saison</div>
                <TransferLine t={stats.biggestTransfer} slug={stats.biggestTransfer.slug} />
              </div>
            ) : null}
            {stats.worstTransferOverall ? (
              <div className="f-card f-rule p-4" style={{ ['--c' as string]: 'var(--f-down)' }}>
                <div className="f-label mb-2">Le transfert regretté</div>
                <TransferLine t={stats.worstTransferOverall} slug={stats.worstTransferOverall.slug} />
              </div>
            ) : null}
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {ms.map((m) => (
              <div key={m.slug} className="f-card f-rule p-4" style={cssColor(m.slug)}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Face slug={m.slug} size={28} />
                    <Name slug={m.slug} className="f-display text-lg" />
                  </div>
                  <div className="text-sm">
                    <span className="text-[var(--f-muted)]">bilan </span>
                    <Delta value={m.transferNet} />
                  </div>
                </div>
                <div className="text-xs text-[var(--f-muted)] mb-2">
                  {m.transfersCount} transferts (Wildcard et Free Hit inclus) · {m.hitsPts} pts de hits
                </div>
                {m.bestTransfer ? (
                  <div className="text-xs f-label mt-1">Meilleur</div>
                ) : null}
                {m.bestTransfer ? <TransferLine t={m.bestTransfer} /> : null}
                {m.worstTransfer ? <div className="text-xs f-label mt-2">Pire</div> : null}
                {m.worstTransfer ? <TransferLine t={m.worstTransfer} /> : null}
                <Expandable label={`Les ${m.transfers.length} transferts`}>
                  <div className="mt-2">
                    {m.transfers.map((t, i) => (
                      <TransferLine key={`${t.gw}-${t.in.id}-${t.out.id}-${i}`} t={t} />
                    ))}
                  </div>
                </Expandable>
              </div>
            ))}
          </div>
        </section>

        {/* Captaincy */}
        <section className="mb-10">
          <SectionHead title="Le brassard" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {ms.map((m) => (
              <Tile key={m.slug} label={MANAGER_BY_SLUG[m.slug].firstName} slug={m.slug}>
                <div className="f-num text-2xl">+{m.captainPts}</div>
                <div className="text-xs text-[var(--f-muted)]">pts bonus du capitaine</div>
                <div className="text-sm mt-2">
                  Bon choix <span className="f-num">{m.captainBestCount}/{m.rows.length}</span> GW
                </div>
                <div className="text-sm">
                  Raté : <span className="f-num text-[var(--f-down)]">{m.captainMissed}</span> pts
                </div>
                {m.favouriteCaptain ? (
                  <div className="text-xs text-[var(--f-muted)] mt-2">
                    Chouchou : {m.favouriteCaptain.player.name} ({m.favouriteCaptain.times}×)
                  </div>
                ) : null}
              </Tile>
            ))}
          </div>
        </section>

        {/* Chips */}
        <section className="mb-10">
          <SectionHead title="Les chips" right="Un jeu complet par moitié de saison (GW1-19, puis GW20-38)" />
          <div className="grid md:grid-cols-2 gap-3">
            {ms.map((m) => (
              <div key={m.slug} className="f-card f-rule p-4" style={cssColor(m.slug)}>
                <div className="flex items-center gap-2 mb-3">
                  <Face slug={m.slug} size={28} />
                  <Name slug={m.slug} className="f-display text-lg" />
                  <span className="ml-auto text-xs text-[var(--f-muted)]">
                    {m.chipsLeftNow.length ? `Encore : ${m.chipsLeftNow.join(', ')}` : 'Plus rien avant la GW20'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {m.chipStatus.map((c) => {
                    const used = m.chips.find((u) => u.name === c.name && u.gw === c.usedGw);
                    const styles: Record<string, string> = {
                      used: 'opacity-55 line-through',
                      available: 'border-[var(--f-green)] text-white',
                      expired: 'opacity-35 line-through',
                      upcoming: 'opacity-70',
                    };
                    return (
                      <div
                        key={`${c.name}-${c.window}`}
                        className={`text-xs rounded border border-[var(--f-line)] px-2 py-1.5 ${styles[c.status]}`}
                        title={c.window}
                      >
                        <span className="font-semibold">{c.label}</span>{' '}
                        <span className="text-[var(--f-muted)] no-underline">
                          {c.status === 'used' ? `GW${c.usedGw}${used ? ` · ${used.pts} pts` : ''}` : c.status === 'available' ? 'dispo' : c.status === 'upcoming' ? `dès GW${c.start}` : 'perdu'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Head to head */}
        <section className="mb-10">
          <SectionHead title="Face-à-face" right="Victoires / nuls / défaites GW par GW" />
          <div className="f-card overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="text-left">
                  <th className="p-3 f-label">Contre →</th>
                  {ms.map((b) => (
                    <th key={b.slug} className="p-3">
                      <div className="flex items-center gap-2">
                        <Face slug={b.slug} size={22} />
                        <span className="f-label">{MANAGER_BY_SLUG[b.slug].firstName}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ms.map((a) => (
                  <tr key={a.slug} className="border-t border-[var(--f-line-soft)]">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Face slug={a.slug} size={22} />
                        <Name slug={a.slug} />
                      </div>
                    </td>
                    {ms.map((b) => {
                      if (a.slug === b.slug) return <td key={b.slug} className="p-3 text-[var(--f-muted-2)]">—</td>;
                      const r = stats.h2h[a.slug][b.slug];
                      return (
                        <td key={b.slug} className="p-3">
                          <span className="f-num">{r.w}-{r.d}-{r.l}</span>{' '}
                          <span className="text-xs"><Delta value={r.diff} /></span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Players */}
        <section className="mb-10">
          <SectionHead title="Les joueurs qui portent l'équipe" right="Points réellement marqués pour le manager (capitaine compris)" />
          <div className="grid md:grid-cols-2 gap-3">
            {ms.map((m) => (
              <div key={m.slug} className="f-card f-rule p-4" style={cssColor(m.slug)}>
                <div className="flex items-center gap-2 mb-2">
                  <Face slug={m.slug} size={28} />
                  <Name slug={m.slug} className="f-display text-lg" />
                </div>
                <ol className="text-sm">
                  {m.topContributors.map((c, i) => (
                    <li key={c.player.id} className="flex items-center gap-2 py-1 border-b border-[var(--f-line-soft)] last:border-0">
                      <span className="f-num w-5 text-[var(--f-muted)]">{i + 1}</span>
                      <span className="flex-1 truncate">
                        {c.player.name} <span className="text-xs text-[var(--f-muted-2)]">{c.player.team} · {c.player.pos}</span>
                      </span>
                      <span className="text-xs text-[var(--f-muted)]">{c.gws} GW</span>
                      <span className="f-num w-10 text-right">{c.pts}</span>
                    </li>
                  ))}
                </ol>
                {m.differentials.length ? (
                  <div className="mt-3 text-xs text-[var(--f-muted)]">
                    <span className="f-label mr-1">Différentiels</span>
                    {m.differentials.slice(0, 5).map((d) => d.player.name).join(', ')}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
          {stats.shared.length ? (
            <div className="f-card p-4 mt-3">
              <div className="f-label mb-2">L’effectif type de la ligue (joueurs possédés par au moins deux d’entre nous)</div>
              <div className="flex flex-wrap gap-2">
                {stats.shared.map((s) => (
                  <span key={s.player.id} className="f-pill !pr-3">
                    <span className="flex -space-x-1.5">
                      {s.owners.map((o) => (
                        <Face key={o} slug={o} size={20} />
                      ))}
                    </span>
                    <span className="text-sm">{s.player.name}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {/* World */}
        <section className="mb-10">
          <SectionHead title="Face au monde" right="Rang mondial FPL (échelle logarithmique)" />
          <div className="f-card p-3 md:p-4">
            <FaceLineChart data={overallRankSeries(stats)} invert log valueFormatter={(v) => fmtRank(v)} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            {ms.map((m) => (
              <Tile key={m.slug} label={MANAGER_BY_SLUG[m.slug].firstName} slug={m.slug}>
                <div className="f-num text-2xl">{fmtRank(m.overallRank)}</div>
                <div className="text-xs text-[var(--f-muted)]">
                  Valeur {m.teamValue?.toFixed(1)} M · banque {m.bank?.toFixed(1)} M
                </div>
                <div className="text-xs text-[var(--f-muted)]">
                  Meilleure GW {m.best?.pts} (GW{m.best?.gw}) · pire {m.worst?.pts} (GW{m.worst?.gw})
                </div>
              </Tile>
            ))}
          </div>
        </section>

        <p className="text-xs text-[var(--f-muted-2)] pb-4">
          Reviews IA de la saison : {spent === null ? 'coût indisponible' : `${spent.toFixed(2)} $ dépensés sur ${SEASON_BUDGET_USD} $ de budget`}.
        </p>
      </main>
    </div>
  );
}
