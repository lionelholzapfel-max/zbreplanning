import { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Optional treated visual (e.g. archive-processed image) above the title. */
  media?: ReactNode;
}

/** Sober empty state — tertiary text, no cartoon illustration. */
export function EmptyState({ title, description, action, media }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4">
      {media && <div className="mb-5">{media}</div>}
      <p className="text-[var(--text-secondary)] font-medium">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-[var(--text-tertiary)] max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
