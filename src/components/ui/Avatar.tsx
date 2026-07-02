import Image from 'next/image';

type Ring = 'none' | 'gold' | 'muted' | 'accent';

const rings: Record<Ring, string> = {
  none: 'ring-1 ring-[var(--hairline)]',
  gold: 'ring-2 ring-[var(--gold)]', // Drère / 1st place
  muted: 'ring-2 ring-[var(--text-tertiary)] grayscale', // Mzi
  accent: 'ring-2 ring-[var(--accent)]',
};

interface AvatarProps {
  slug: string;
  name: string;
  size?: number;
  ring?: Ring;
  className?: string;
}

/** Member avatar. The `ring` prop REPLACES the 👑 / 🥄 emojis in the UI. */
export function Avatar({ slug, name, size = 40, ring = 'none', className = '' }: AvatarProps) {
  return (
    <div
      className={`relative rounded-full overflow-hidden shrink-0 ${rings[ring]} ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={`/members/${slug}.png`}
        alt={name}
        fill
        sizes={`${size}px`}
        className="object-cover object-top"
      />
    </div>
  );
}
