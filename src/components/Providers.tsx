'use client';

import { Toaster } from 'sonner';
import DrereCelebration from './DrereCelebration';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <DrereCelebration />
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'var(--surface-3)',
            border: '1px solid var(--hairline)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
          },
          classNames: {
            error: 'border-[var(--danger)]/40 text-[var(--danger)]',
            success: 'border-[var(--accent)]/40 text-[var(--accent)]',
          },
        }}
        closeButton
      />
    </>
  );
}
