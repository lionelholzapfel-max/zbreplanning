/**
 * Recharts theme for the dark-premium redesign.
 * One accent (green), faint grid, no loud colored legend.
 */
export const chartTheme = {
  accent: '#34D399',
  accentMuted: 'rgba(52, 211, 153, 0.12)',
  grid: 'rgba(255, 255, 255, 0.06)',
  axis: '#71717A',
  text: '#A1A1AA',
  strokeWidth: 1.5,
} as const;

/** Shared <CartesianGrid> props. */
export const chartGridProps = {
  stroke: chartTheme.grid,
  strokeDasharray: '0',
  vertical: false,
} as const;

/** Shared axis props. */
export const chartAxisProps = {
  stroke: chartTheme.axis,
  tick: { fill: chartTheme.text, fontSize: 12 },
  tickLine: false,
  axisLine: { stroke: chartTheme.grid },
} as const;

/** Shared <Tooltip> content styling. */
export const chartTooltipStyle = {
  contentStyle: {
    background: '#1A1A1E',
    border: '1px solid rgba(255, 255, 255, 0.14)',
    borderRadius: 8,
    color: '#FAFAFA',
    fontSize: 12,
  },
  cursor: { stroke: chartTheme.grid },
  labelStyle: { color: '#A1A1AA' },
} as const;
