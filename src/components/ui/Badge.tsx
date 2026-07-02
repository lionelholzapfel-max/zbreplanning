import { HTMLAttributes } from 'react';

type BadgeVariant = 'neutral' | 'accent' | 'gold' | 'danger' | 'live';

const styles: Record<BadgeVariant, string> = {
  neutral: 'bg-[var(--surface-raised)] text-[var(--text-secondary)] border border-[var(--hairline)]',
  accent: 'bg-[var(--accent-muted)] text-[var(--accent)]',
  gold: 'bg-[rgba(234,179,8,0.12)] text-[var(--gold)]',
  danger: 'bg-[rgba(248,113,113,0.12)] text-[var(--danger)]',
  live: 'bg-[rgba(239,68,68,0.12)] text-[var(--live)]',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

/** 11px uppercase, discreet. `live` shows a 6px pulsing red dot + LIVE. */
export function Badge({ variant = 'neutral', className = '', children, ...props }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.04em] leading-none ${styles[variant]} ${className}`}
      {...props}
    >
      {variant === 'live' && (
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--live)] animate-live" aria-hidden />
      )}
      {variant === 'live' && children == null ? 'LIVE' : children}
    </span>
  );
}
