// Small presentational building blocks for the FPL pages (server-safe, no hooks).
import type { CSSProperties, ReactNode } from 'react';
import { MANAGER_BY_SLUG, photoUrl, type ManagerSlug } from '@/lib/fpl/config';

export function cssColor(slug: ManagerSlug): CSSProperties {
  return { ['--c' as string]: MANAGER_BY_SLUG[slug].color } as CSSProperties;
}

export function Face({
  slug,
  size = 40,
  ring = true,
  className = '',
}: {
  slug: ManagerSlug;
  size?: number;
  ring?: boolean;
  className?: string;
}) {
  const m = MANAGER_BY_SLUG[slug];
  return (
    // eslint-disable-next-line @next/next/no-img-element -- authenticated API route, not a static asset
    <img
      src={photoUrl(slug, 'face')}
      alt={m.firstName}
      width={size}
      height={size}
      loading="lazy"
      className={`rounded-full object-cover shrink-0 bg-[var(--f-surface-3)] ${className}`}
      style={{
        width: size,
        height: size,
        boxShadow: ring ? `0 0 0 2px ${m.color}` : undefined,
      }}
    />
  );
}

export function Stars({ count, size = 16, color = 'var(--f-gold)' }: { count: number; size?: number; color?: string }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${count} étoile${count > 1 ? 's' : ''}`}>
      {Array.from({ length: count }, (_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill={color}
            d="M12 2.5l2.9 6.2 6.8.8-5 4.6 1.4 6.7L12 17.4l-6.1 3.4 1.4-6.7-5-4.6 6.8-.8z"
          />
        </svg>
      ))}
    </span>
  );
}

export function SectionHead({ title, right, id }: { title: string; right?: ReactNode; id?: string }) {
  return (
    <div className="f-head" id={id}>
      <h2>{title}</h2>
      {right ? <div className="f-label text-right">{right}</div> : null}
    </div>
  );
}

export function Name({ slug, className = '' }: { slug: ManagerSlug; className?: string }) {
  const m = MANAGER_BY_SLUG[slug];
  return (
    <span className={`font-semibold ${className}`} style={{ color: m.color }}>
      {m.firstName}
    </span>
  );
}

export function Delta({ value, suffix = '' }: { value: number; suffix?: string }) {
  const color = value > 0 ? 'var(--f-green)' : value < 0 ? 'var(--f-down)' : 'var(--f-muted)';
  return (
    <span className="f-num" style={{ color }}>
      {value > 0 ? '+' : ''}
      {value}
      {suffix}
    </span>
  );
}

export function Tile({
  label,
  children,
  slug,
  className = '',
}: {
  label: string;
  children: ReactNode;
  slug?: ManagerSlug;
  className?: string;
}) {
  return (
    <div className={`f-card p-4 ${slug ? 'f-rule' : ''} ${className}`} style={slug ? cssColor(slug) : undefined}>
      <div className="f-label mb-2">{label}</div>
      {children}
    </div>
  );
}

export function fmtRank(n: number | null | undefined): string {
  if (!n) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace('.', ',')} M`;
  if (n >= 1000) return `${Math.round(n / 1000)} k`;
  return String(n);
}

export function ordinal(n: number): string {
  return n === 1 ? '1er' : `${n}e`;
}

export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n} ${Math.abs(n) > 1 ? pluralWord : word}`;
}

/** Dates are rendered on the server (UTC on Vercel): always format in Belgian time. */
export function fmtBrussels(iso: string, withDay = true): string {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = withDay
    ? { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' }
    : { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' };
  return new Intl.DateTimeFormat('fr-BE', opts).format(d);
}
