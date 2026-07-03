import { HTMLAttributes } from 'react';

interface ListRowProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

/** Dense 56px row with hairline divider — the central component of the redesign. */
export function ListRow({ interactive = false, className = '', ...props }: ListRowProps) {
  return (
    <div
      className={`flex items-center gap-3 min-h-[56px] px-4 border-b border-[var(--hairline)] last:border-b-0 transition-colors duration-150 ease-out ${
        interactive ? 'hover:bg-[var(--surface-1)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] cursor-pointer' : ''
      } ${className}`}
      {...props}
    />
  );
}
