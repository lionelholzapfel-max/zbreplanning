import { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Sober empty state — tertiary text, no cartoon illustration. */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      <p className="text-[var(--text-secondary)] font-medium">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-[var(--text-tertiary)] max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
