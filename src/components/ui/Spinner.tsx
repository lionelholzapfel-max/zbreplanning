/** The ONE spinner used across the app. */
export function Spinner({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Chargement"
      className={`inline-block animate-spin rounded-full border-2 border-[var(--hairline-strong)] border-t-[var(--accent)] ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
