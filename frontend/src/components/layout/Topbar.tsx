'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, Menu, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ROLE_LABEL } from '@/lib/roles';

export function Topbar({ title, onMenu }: { title?: string; onMenu: () => void }) {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .get<{ unread: number }>('/notifications/count')
        .then((r) => alive && setUnread(r.unread))
        .catch(() => {});
    load();
    const t = setInterval(load, 45000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-ink-100 bg-white/85 px-4 backdrop-blur-md sm:px-6">
      <button
        onClick={onMenu}
        className="btn-ghost -ml-1 h-10 w-10 p-0 lg:hidden"
        aria-label="Ouvrir le menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1">
        {title && <h1 className="truncate text-base font-semibold text-ink-900 sm:text-lg">{title}</h1>}
        {user && (
          <p className="hidden truncate text-xs text-ink-400 sm:block">
            {ROLE_LABEL[user.role]}
            {user.orphanage ? ` · ${user.orphanage.name}` : ''}
            {user.province ? ` · ${user.province.nameFr}` : ''}
          </p>
        )}
      </div>

      <Link href="/communication" className="btn-ghost h-10 w-10 p-0" aria-label="Rechercher">
        <Search className="h-5 w-5" />
      </Link>

      <Link
        href="/notifications"
        className="btn-ghost relative h-10 w-10 p-0"
        aria-label={`Notifications${unread ? ` (${unread} non lues)` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent-coral px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Link>
    </header>
  );
}
