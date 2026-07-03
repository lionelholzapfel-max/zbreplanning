/**
 * Recharts theme for the dark-premium redesign.
 * One accent (green), faint grid, no loud colored legend.
 */
export const chartTheme = {
  accent: '#34D399',
  accentMuted: 'rgba(52, 211, 153, 0.12)',
  gold: '#E8B93E', // leader only
  other: 'rgba(255, 255, 255, 0.18)', // non-highlighted lines
  otherHover: '#F2F4F3', // hover → primary
  grid: 'rgba(255, 255, 255, 0.05)',
  axis: '#5F6963', // tertiary
  text: '#5F6963', // tertiary
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
  tick: { fill: chartTheme.text, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: chartTheme.grid },
} as const;

/** Shared <Tooltip> content styling — surface-3 panel + top-light. */
export const chartTooltipStyle = {
  contentStyle: {
    background: '#1D2220', // --surface-3
    border: '1px solid rgba(255, 255, 255, 0.06)', // --hairline
    borderRadius: 8,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)', // --top-light
    color: '#F2F4F3', // --text-primary
    fontSize: 12,
  },
  cursor: { stroke: chartTheme.grid },
  labelStyle: { color: '#9CA6A1' }, // --text-secondary
} as const;
