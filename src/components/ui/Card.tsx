import { HTMLAttributes, forwardRef } from 'react';

/** Surface + hairline. NO drop shadow (shadows are for popovers/modals only). */
export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={`rounded-lg border border-[var(--hairline)] bg-[var(--surface)] ${className}`}
      {...props}
    />
  )
);
Card.displayName = 'Card';
