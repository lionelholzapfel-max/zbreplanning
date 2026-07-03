import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  /** Optional subtitle line under the title. */
  subtitle?: string;
  action?: ReactNode;
  /** Optional inline elements next to the title (e.g. a Badge). */
  children?: ReactNode;
}

/** Page title (.display 22px) + optional subtitle + right-aligned action, hairline underline. */
export function PageHeader({ title, subtitle, action, children }: PageHeaderProps) {
  return (
    <div
      className={`flex pb-4 mb-6 border-b border-[var(--hairline)] ${
        action
          ? 'flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4'
          : 'items-end justify-between gap-4'
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="display text-[22px] text-[var(--text-primary)] truncate">{title}</h1>
          {children}
        </div>
        {subtitle && <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
