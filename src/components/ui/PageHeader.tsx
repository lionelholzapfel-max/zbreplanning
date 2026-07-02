import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  action?: ReactNode;
  /** Optional inline elements next to the title (e.g. a Badge). */
  children?: ReactNode;
}

/** Page title (20px semibold) + optional right-aligned action, hairline underline. */
export function PageHeader({ title, action, children }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4 pb-4 mb-6 border-b border-[var(--hairline)]">
      <div className="flex items-center gap-3 min-w-0">
        <h1 className="text-[20px] font-semibold tracking-[-0.01em] text-[var(--text-primary)] truncate">
          {title}
        </h1>
        {children}
      </div>
      {action}
    </div>
  );
}
