'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabase, type Notification } from '@/hooks/useSupabase';
import { EmptyState } from '@/components/ui';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Bell,
  CalendarPlus,
  Users,
  MapPin,
  ThumbsUp,
  Trophy,
  type LucideIcon,
} from 'lucide-react';

const TYPE_ICON: Record<Notification['type'], LucideIcon> = {
  activity_created: CalendarPlus,
  activity_response: Users,
  location_proposed: MapPin,
  location_vote: ThumbsUp,
  match_response: Trophy,
};

function fallbackLink(type: Notification['type']): string {
  return type === 'activity_created' || type === 'activity_response'
    ? '/activities'
    : '/world-cup';
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: fr });
  } catch {
    return '';
  }
}

export default function NotificationBell() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
  } = useSupabase();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      // Opening the panel counts as seen: refresh, then mark everything read
      // (badge clears, dots go). The list stays, just no longer "unread".
      getNotifications().finally(() => markAllNotificationsRead());
    }
  };

  const handleTapNotification = async (notif: Notification) => {
    setOpen(false);
    if (!notif.read) {
      await markNotificationRead(notif.id);
    }
    router.push(notif.link || fallbackLink(notif.type));
  };

  const badge =
    unreadCount >= 2 ? (
      <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 score text-[10px] text-[#0A0C0B]">
        {unreadCount > 9 ? '9+' : unreadCount}
      </span>
    ) : unreadCount >= 1 ? (
      <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-[var(--accent)]" />
    ) : null;

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={handleToggle}
        aria-label="Notifications"
        className="relative flex h-11 w-11 items-center justify-center rounded-[6px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.04] transition-colors duration-150"
      >
        <Bell className="w-5 h-5" strokeWidth={1.75} />
        {badge}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-4rem)] max-w-[360px] rounded-[12px] bg-[var(--surface-3)] top-light shadow-2xl shadow-black/50 overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-12 border-b border-[var(--hairline)]">
            <span className="text-sm font-medium text-[var(--text-primary)]">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllNotificationsRead()}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors duration-150"
              >
                Tout marquer lu
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[70vh] overflow-y-auto overscroll-contain">
            {notifications.length === 0 ? (
              <EmptyState title="Aucune notification" description="Tu es à jour." />
            ) : (
              notifications.map((notif) => {
                const Icon = TYPE_ICON[notif.type] ?? Bell;
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleTapNotification(notif)}
                    className={`relative w-full flex items-start gap-2.5 px-4 py-3 text-left border-b border-[var(--hairline)] last:border-b-0 transition-colors duration-150 hover:bg-[var(--surface-2)] ${
                      notif.read ? 'bg-transparent' : 'bg-[var(--surface-2)]'
                    }`}
                  >
                    {!notif.read && (
                      <span className="absolute left-1.5 top-4 h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                    )}
                    <Icon
                      className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[var(--text-tertiary)]"
                      strokeWidth={1.75}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-snug text-[var(--text-primary)] truncate">
                        {notif.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-snug text-[var(--text-secondary)] line-clamp-2">
                        {notif.message}
                      </p>
                      <p className="mt-1 text-[11px] leading-none text-[var(--text-tertiary)]">
                        {relativeTime(notif.created_at)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
