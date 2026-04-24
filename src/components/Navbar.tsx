'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSupabase } from '@/hooks/useSupabase';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const navItems = [
  { href: '/', label: 'Accueil', icon: '🏠', mobileLabel: 'Home' },
  { href: '/world-cup', label: 'Coupe du Monde', icon: '⚽', mobileLabel: 'CDM' },
  { href: '/predictions', label: 'Pronostics', icon: '🎰', mobileLabel: 'Pronos' },
  { href: '/activities', label: 'Activités', icon: '📅', mobileLabel: 'Activités' },
  { href: '/calendar', label: 'Calendrier', icon: '🗓️', mobileLabel: 'Calendrier' },
];

const notificationIcons: Record<string, string> = {
  activity_created: '🎉',
  activity_response: '✋',
  location_proposed: '📍',
  location_vote: '👍',
  match_response: '⚽',
};

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    currentUser,
    loading,
    logout,
    notifications,
    unreadCount,
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead
  } = useSupabase();
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    if (!loading && !currentUser && pathname !== '/login') {
      router.push('/login');
    }
  }, [currentUser, loading, pathname, router]);

  // Refresh notifications periodically
  useEffect(() => {
    if (currentUser) {
      getNotifications();
      const interval = setInterval(getNotifications, 30000); // Refresh every 30s
      return () => clearInterval(interval);
    }
  }, [currentUser, getNotifications]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowMenu(false);
      setShowNotifications(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleNotificationClick = async (notificationId: string, link?: string) => {
    await markNotificationRead(notificationId);
    setShowNotifications(false);
    if (link) {
      router.push(link);
    }
  };

  if (loading || !currentUser) return null;

  return (
    <nav className="sticky top-0 z-50 glass border-b border-white/5">
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

          {/* Right side: Notifications + User Menu */}
          <div className="flex items-center gap-2">
            {/* Notification Bell */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowMenu(false);
                }}
                className="relative p-2 rounded-xl hover:bg-white/5 transition-all"
              >
                <span className="text-xl">🔔</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#ef4444] text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 py-2 glass rounded-xl border border-white/10 shadow-xl max-h-[70vh] overflow-hidden">
                  <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between">
                    <h3 className="font-bold text-white">Notifications</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllNotificationsRead()}
                        className="text-xs text-[#6366f1] hover:underline"
                      >
                        Tout marquer lu
                      </button>
                    )}
                  </div>

                  <div className="overflow-y-auto max-h-[50vh]">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <span className="text-4xl mb-2 block">🔔</span>
                        <p className="text-gray-500 text-sm">Aucune notification</p>
                      </div>
                    ) : (
                      notifications.slice(0, 10).map((notif) => (
                        <button
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif.id, notif.link)}
                          className={`w-full px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 ${
                            !notif.read ? 'bg-[#6366f1]/10' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-xl shrink-0">
                              {notificationIcons[notif.type] || '📢'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${!notif.read ? 'text-white' : 'text-gray-300'}`}>
                                {notif.title}
                              </p>
                              <p className="text-xs text-gray-500 truncate">{notif.message}</p>
                              <p className="text-xs text-gray-600 mt-1">
                                {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: fr })}
                              </p>
                            </div>
                            {!notif.read && (
                              <span className="w-2 h-2 rounded-full bg-[#6366f1] shrink-0 mt-1" />
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Menu */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => {
                  setShowMenu(!showMenu);
                  setShowNotifications(false);
                }}
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

        {/* Mobile Nav */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-white/5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                pathname === item.href
                  ? 'text-[#6366f1]'
                  : 'text-gray-400'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs font-medium">{item.mobileLabel}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
