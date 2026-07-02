'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useSupabase } from '@/hooks/useSupabase';

const navItems = [
  { href: '/', label: 'Accueil', icon: '🏠', mobileLabel: 'Home' },
  { href: '/world-cup', label: 'Coupe du Monde', icon: '⚽', mobileLabel: 'CDM' },
  { href: '/leaderboard', label: 'Classement', icon: '🏆', mobileLabel: 'Classt' },
  { href: '/predictions', label: 'Pronostics', icon: '🎰', mobileLabel: 'Pronos' },
  { href: '/activities', label: 'Activités', icon: '📅', mobileLabel: 'Activ' },
  { href: '/games', label: 'Zbrétoile', icon: '⭐', mobileLabel: 'Zbré' },
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

  // Close dropdown when clicking outside
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
    <nav className="sticky top-0 z-50 bg-[#0a0a0f] border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-[#6366f1]/50 group-hover:ring-[#6366f1] transition-all">
              <Image
                src="/team/group.png"
                alt="Zbre Team"
                fill
                className="object-cover"
              />
            </div>
            <span className="text-xl font-black hidden sm:block">
              <span className="bg-gradient-to-r from-[#6366f1] via-[#a855f7] to-[#ec4899] bg-clip-text text-transparent">Zbre</span>
              <span className="text-white">Planning</span>
            </span>
          </Link>

          {/* Desktop Nav Items */}
          <div className="hidden md:flex items-center gap-1 bg-[#1e1e2e]/50 rounded-2xl p-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${
                  pathname === item.href
                    ? 'bg-gradient-to-r from-[#6366f1] to-[#a855f7] text-white shadow-lg shadow-[#6366f1]/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </Link>
            ))}
          </div>

          {/* Right side: User Menu */}
          <div className="flex items-center gap-2">
            {/* User Menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/5 transition-all"
              >
                <div className="relative w-9 h-9 rounded-full overflow-hidden ring-2 ring-[#6366f1]/50">
                  <Image
                    src={`/members/${currentUser.member_slug}.png`}
                    alt={currentUser.member_name}
                    fill
                    className="object-cover"
                  />
                </div>
                <span className="text-sm font-medium text-white hidden sm:block">
                  {currentUser.member_name.split(' ')[0]}
                </span>
                <span className="text-gray-400 text-sm hidden sm:block">▼</span>
              </button>

              {/* Dropdown menu */}
              {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 py-2 glass rounded-xl border border-white/10 shadow-xl">
                  <div className="px-4 py-2 border-b border-white/10">
                    <p className="text-sm font-medium text-white">{currentUser.member_name}</p>
                    <p className="text-xs text-gray-500">Membre de la team</p>
                  </div>
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleLogout();
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  >
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </nav>

    {/* Mobile bottom tab bar — native-app feel, thumb-friendly during matches */}
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 glass border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 min-w-0 flex flex-col items-center gap-0.5 px-1 py-2 transition-all ${
              pathname === item.href
                ? 'text-[#6366f1]'
                : 'text-gray-400'
            }`}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span className="text-[10px] font-medium leading-none truncate max-w-full">{item.mobileLabel}</span>
          </Link>
        ))}
      </div>
    </nav>
    </>
  );
}
