'use client';

// Charts where every manager is identified by their own (fat) face at the end
// of their line instead of a colour legend.
import { useId } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MANAGERS, MANAGER_BY_SLUG, photoUrl, type ManagerSlug } from '@/lib/fpl/config';

export interface SeriesPoint {
  gw: number;
  [slug: string]: number | null;
}

const GRID = '#1c2030';
const AXIS = '#6a707b';
const TOOLTIP_STYLE = {
  background: '#0c0e14',
  border: '1px solid #262a34',
  borderRadius: 6,
  fontSize: 12,
  color: '#f5f6f8',
};

interface DotProps {
  cx?: number;
  cy?: number;
  index?: number;
}

function faceDot(slug: ManagerSlug, lastIndex: number, uid: string, dx = 0, size = 30) {
  const color = MANAGER_BY_SLUG[slug].color;
  const FaceDot = (props: DotProps) => {
    const { cy, index } = props;
    let { cx } = props;
    if (cx === undefined || cy === undefined || index !== lastIndex) {
      return <g key={`${slug}-${index}`} />;
    }
    const r = size / 2;
    cx += dx;
    const clipId = `${uid}-${slug}`;
    return (
      <g key={`${slug}-face`}>
        <defs>
          <clipPath id={clipId}>
            <circle cx={cx} cy={cy} r={r} />
          </clipPath>
        </defs>
        <circle cx={cx} cy={cy} r={r + 2.5} fill={color} />
        <image
          href={photoUrl(slug, 'face')}
          x={cx - r}
          y={cy - r}
          width={size}
          height={size}
          clipPath={`url(#${clipId})`}
          preserveAspectRatio="xMidYMid slice"
        />
      </g>
    );
  };
  return FaceDot;
}

const FORMATTERS: Record<string, (v: number) => string> = {
  number: (v) => String(v),
  ordinal: (v) => (v === 1 ? '1er' : `${v}e`),
  rank: (v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1).replace('.', ',')} M` : v >= 1000 ? `${Math.round(v / 1000)} k` : String(v)),
};

/**
 * Faces sitting on (almost) the same final value would hide each other: shift
 * the later ones sideways. "Close" = nearer than one face height on screen.
 */
function staggerOffsets(data: SeriesPoint[], log: boolean, plotHeight: number): Partial<Record<ManagerSlug, number>> {
  const last = data.at(-1);
  if (!last) return {};
  const t = (v: number) => (log ? Math.log10(Math.max(v, 1)) : v);
  const all = data.flatMap((p) => MANAGERS.map((m) => p[m.slug])).filter((v): v is number => typeof v === 'number').map(t);
  const range = Math.max(...all) - Math.min(...all) || 1;
  const ends = MANAGERS.map((m) => ({ slug: m.slug, v: last[m.slug] }))
    .filter((e): e is { slug: ManagerSlug; v: number } => typeof e.v === 'number')
    .sort((a, b) => t(a.v) - t(b.v));
  const out: Partial<Record<ManagerSlug, number>> = {};
  let group = 0;
  for (let i = 0; i < ends.length; i++) {
    const close = i > 0 && Math.abs(t(ends[i].v) - t(ends[i - 1].v)) / range < 34 / plotHeight;
    group = close ? group + 1 : 0;
    out[ends[i].slug] = group === 0 ? 0 : group % 2 ? -26 : 26 * (group / 2);
  }
  return out;
}

function nameOf(slug: string) {
  return MANAGER_BY_SLUG[slug as ManagerSlug]?.firstName ?? slug;
}

/**
 * Generic multi-line chart, one line per manager, face at the last point.
 * `invert` flips the Y axis (positions, overall rank: smaller is better).
 */
export function FaceLineChart({
  data,
  height = 280,
  invert = false,
  domain,
  ticks,
  unit = '',
  log = false,
  zeroLine = false,
  format = 'number',
}: {
  data: SeriesPoint[];
  height?: number;
  invert?: boolean;
  domain?: [number | string, number | string];
  ticks?: number[];
  unit?: string;
  log?: boolean;
  zeroLine?: boolean;
  /** formatting is chosen by name: functions can't cross the server/client boundary */
  format?: 'number' | 'ordinal' | 'rank';
}) {
  const uid = useId().replace(/:/g, '');
  const lastIndex = data.length - 1;
  const offsets = staggerOffsets(data, log, Math.max(height - 70, 80));
  const fmt = FORMATTERS[format] ?? ((v: number) => `${v}${unit}`);
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer initialDimension={{ width: 600, height }}>
        <LineChart data={data} margin={{ top: 20, right: 40, bottom: 4, left: 0 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="gw"
            padding={{ left: 6, right: 22 }}
            tickFormatter={(gw) => `GW${gw}`}
            stroke={AXIS}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: GRID }}
          />
          <YAxis
            reversed={invert}
            domain={domain ?? ['auto', 'auto']}
            ticks={ticks}
            scale={log ? 'log' : 'auto'}
            allowDataOverflow={false}
            padding={{ top: 14, bottom: 14 }}
            stroke={AXIS}
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v: number) => fmt(v)}
          />
          {zeroLine ? <ReferenceLine y={0} stroke="#3a3f4b" /> : null}
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={(gw) => `GW${gw}`}
            formatter={(v, name) => [typeof v === 'number' ? fmt(v) : String(v), nameOf(String(name))]}
            itemSorter={(item) => (invert ? 1 : -1) * Number(item.value ?? 0)}
          />
          {MANAGERS.map((m) => (
            <Line
              key={m.slug}
              type="monotone"
              dataKey={m.slug}
              name={m.slug}
              stroke={m.color}
              strokeWidth={2.25}
              dot={faceDot(m.slug, lastIndex, uid, offsets[m.slug] ?? 0)}
              activeDot={{ r: 4, stroke: m.color, fill: '#0a0a0b' }}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Grouped bars of GW points, one colour per manager. */
export function GwPointsBars({ data, height = 260 }: { data: SeriesPoint[]; height?: number }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer initialDimension={{ width: 600, height }}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }} barGap={1} barCategoryGap="18%">
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="gw" tickFormatter={(gw) => `${gw}`} stroke={AXIS} tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis stroke={AXIS} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            labelFormatter={(gw) => `GW${gw}`}
            formatter={(v, name) => [`${v} pts`, nameOf(String(name))]}
          />
          {MANAGERS.map((m) => (
            <Bar key={m.slug} dataKey={m.slug} name={m.slug} fill={m.color} radius={[2, 2, 0, 0]} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
