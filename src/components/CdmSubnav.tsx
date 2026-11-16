'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Secondary tabs for the (finished) World Cup section, now grouped under
// "Coupe du Monde" in the main nav since the home page became FPL.
const TABS = [
  { href: '/cdm', label: 'Accueil CDM' },
  { href: '/world-cup', label: 'Matchs' },
  { href: '/leaderboard', label: 'Classement' },
  { href: '/predictions', label: 'Pronos' },
];

export default function CdmSubnav() {
  const pathname = usePathname();
  return (
    <div className="border-b border-[var(--hairline)] bg-[var(--bg)]">
      <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`shrink-0 px-3 py-2.5 text-sm border-b-2 -mb-px transition-colors duration-150 ${
                active
                  ? 'text-[var(--text-primary)] border-[var(--accent)]'
                  : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
