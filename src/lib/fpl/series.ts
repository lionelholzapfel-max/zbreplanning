// Chart series derived from LeagueStats (pure).
import type { LeagueStats } from './stats';

export interface Point {
  gw: number;
  [slug: string]: number | null;
}

function build(stats: LeagueStats, pick: (slug: string, gw: number) => number | null): Point[] {
  return stats.gws.map((gw) => {
    const p: Point = { gw };
    for (const m of stats.managers) p[m.slug] = pick(m.slug, gw);
    return p;
  });
}

const row = (stats: LeagueStats, slug: string, gw: number) =>
  stats.bySlug[slug as keyof LeagueStats['bySlug']]?.rows.find((r) => r.gw === gw);

export const positionsSeries = (s: LeagueStats) => build(s, (slug, gw) => row(s, slug, gw)?.leaguePos ?? null);
export const gwPointsSeries = (s: LeagueStats) => build(s, (slug, gw) => row(s, slug, gw)?.net ?? null);
export const totalSeries = (s: LeagueStats) => build(s, (slug, gw) => row(s, slug, gw)?.total ?? null);
export const overallRankSeries = (s: LeagueStats) => build(s, (slug, gw) => row(s, slug, gw)?.overallRank ?? null);

/** Gap to the GW's league leader (0 = leading, negative = behind). */
export function gapSeries(s: LeagueStats): Point[] {
  return s.gws.map((gw) => {
    const totals = s.managers.map((m) => row(s, m.slug, gw)?.total ?? null);
    const max = Math.max(...totals.filter((t): t is number => t !== null));
    const p: Point = { gw };
    for (const m of s.managers) {
      const t = row(s, m.slug, gw)?.total;
      p[m.slug] = t === undefined ? null : t - max;
    }
    return p;
  });
}
