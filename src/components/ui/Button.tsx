import { ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variants: Record<Variant, string> = {
  primary: 'bg-[var(--accent)] text-[#0A0A0B] hover:opacity-90',
  secondary:
    'bg-[var(--surface)] text-[var(--text-primary)] border border-[var(--hairline-strong)] hover:bg-[var(--surface-raised)]',
  ghost: 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04]',
  danger: 'bg-[var(--danger)] text-[#0A0A0B] hover:opacity-90',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

/** 36px tall, 6px radius, single-accent. No emojis in labels. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', className = '', ...props }, ref) => (
    <button
      ref={ref}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-[6px] px-3.5 text-sm font-medium transition-[background-color,color,opacity,border-color] duration-150 ease-out disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${className}`}
      {...props}
    />
  )
);
Button.displayName = 'Button';
