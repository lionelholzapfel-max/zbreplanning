'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useSupabase } from '@/hooks/useSupabase';
import { Avatar } from '@/components/ui';
import { Home, Trophy, BarChart3, Target, Users, Gamepad2, type LucideIcon } from 'lucide-react';

const navItems: { href: string; label: string; mobileLabel: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Accueil', mobileLabel: 'Accueil', icon: Home },
  { href: '/world-cup', label: 'Coupe du Monde', mobileLabel: 'Matchs', icon: Trophy },
  { href: '/leaderboard', label: 'Classement', mobileLabel: 'Classement', icon: BarChart3 },
  { href: '/predictions', label: 'Pronostics', mobileLabel: 'Pronos', icon: Target },
  { href: '/activities', label: 'Activités', mobileLabel: 'Sorties', icon: Users },
  { href: '/games', label: 'Zbrétoile', mobileLabel: 'Jeux', icon: Gamepad2 },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, loading, logout } = useSupabase();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !currentUser && pathname !== '/login') {
      router.push('/login');
    }
  }, [currentUser, loading, pathname, router]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore errors, still clear local state
    }
    logout();
    router.push('/login');
  };

  if (loading || !currentUser) return null;

  return (
    <>
      <nav className="sticky top-0 z-50 bg-[var(--bg)] border-b border-[var(--hairline)]">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5">
              <div className="relative w-7 h-7 rounded-full overflow-hidden ring-1 ring-[var(--hairline-strong)]">
                <Image src="/team/group.webp" alt="Zbre Team" fill sizes="28px" className="object-cover" />
              </div>
              <span className="display text-[17px] text-[var(--text-primary)]">ZbrePlanning</span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center h-full">
              {navItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`h-full flex items-center px-3.5 text-sm font-medium border-b-2 -mb-px transition-colors duration-150 ease-out ${
                      active
                        ? 'text-[var(--text-primary)] border-[var(--accent)]'
                        : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>

            {/* User menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-2 rounded-[6px] px-1.5 py-1 hover:bg-white/[0.04] transition-colors duration-150"
              >
                <Avatar slug={currentUser.member_slug} name={currentUser.member_name} size={28} />
                <span className="text-sm text-[var(--text-secondary)] hidden sm:block">
                  {currentUser.member_name.split(' ')[0]}
                </span>
              </button>

              {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 py-1 rounded-lg bg-[var(--surface-raised)] border border-[var(--hairline-strong)] shadow-xl shadow-black/40">
                  <div className="px-3 py-2 border-b border-[var(--hairline)]">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">{currentUser.member_name}</p>
                    <p className="text-xs text-[var(--text-tertiary)]">Membre de la team</p>
                  </div>
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleLogout();
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-[var(--danger)] hover:bg-white/[0.04] transition-colors cursor-pointer"
                  >
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile bottom tab bar — icon + full label, active = accent */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-[var(--bg)]/90 backdrop-blur border-t border-[var(--hairline)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch">
          {navItems.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 py-2 px-1 transition-colors duration-150 ease-out ${
                  active ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" strokeWidth={1.75} />
                <span className="text-[10px] leading-none">{item.mobileLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
