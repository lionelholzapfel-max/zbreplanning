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
            background: '#1e1e2e',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#fff',
          },
          classNames: {
            error: 'bg-red-500/20 border-red-500/30 text-red-200',
            success: 'bg-green-500/20 border-green-500/30 text-green-200',
          },
        }}
        richColors
        closeButton
      />
    </>
  );
}
