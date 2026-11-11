'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, Globe2, Menu, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ROLE_LABEL } from '@/lib/roles';
import { Avatar } from '@/components/ui/Avatar';

/** Drapeau du pays : image (les émojis de drapeau ne s'affichent pas sous Windows). */
function Flag({ iso2, name }: { iso2: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="grid h-[18px] min-w-[24px] place-items-center rounded-sm bg-ink-100 px-1 text-[10px] font-semibold text-ink-600">
        {iso2.toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://flagcdn.com/w40/${iso2.toLowerCase()}.png`}
      width={24}
      height={18}
      alt={`Drapeau : ${name}`}
      className="h-[18px] w-6 rounded-sm object-cover shadow-[0_0_0_1px_rgba(23,36,48,0.15)]"
      onError={() => setFailed(true)}
    />
  );
}

function useToday() {
  const [today, setToday] = useState<{ long: string; short: string } | null>(null);
  useEffect(() => {
    const compute = () => {
      const d = new Date();
      const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
      setToday({
        long: cap(d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })),
        short: d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      });
    };
    compute();
    const t = setInterval(compute, 60_000); // change de jour sans rechargement
    return () => clearInterval(t);
  }, []);
  return today;
}

export function Topbar({ title, onMenu }: { title?: string; onMenu: () => void }) {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  const today = useToday();

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

  const country = user?.country;

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-ink-100 bg-white/90 px-3 backdrop-blur-md sm:gap-3 sm:px-6">
      <button
        onClick={onMenu}
        className="btn-ghost -ml-1 h-11 w-11 shrink-0 p-0 lg:hidden"
        aria-label="Ouvrir le menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Pays et date */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {title && <h1 className="truncate text-base font-semibold text-ink-900 sm:text-lg">{title}</h1>}
        <div className="flex min-w-0 items-center gap-2.5 text-sm text-ink-700">
          {country ? (
            <Flag iso2={country.iso2} name={country.nameFr} />
          ) : (
            <Globe2 className="h-[18px] w-[18px] shrink-0 text-ink-500" aria-hidden="true" />
          )}
          <span className="hidden truncate font-medium text-ink-900 sm:inline">
            {country?.nameFr ?? 'Réseau international'}
          </span>
          <span className="hidden h-4 w-px bg-ink-200 sm:block" aria-hidden="true" />
          <time className="truncate text-ink-600" suppressHydrationWarning>
            <span className="hidden md:inline">{today?.long}</span>
            <span className="md:hidden">{today?.short}</span>
          </time>
        </div>
      </div>

      <Link href="/communication" className="btn-ghost h-11 w-11 shrink-0 p-0" aria-label="Rechercher">
        <Search className="h-5 w-5" />
      </Link>

      <Link
        href="/notifications"
        className="btn-ghost relative h-11 w-11 shrink-0 p-0"
        aria-label={`Notifications${unread ? ` (${unread} non lues)` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent-coral px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Link>

      {/* Profil et rôle */}
      {user && (
        <Link
          href="/profil"
          className="flex min-h-[44px] shrink-0 items-center gap-3 rounded-xl border-l border-ink-100 py-1 pl-3 pr-1 transition-colors hover:bg-ink-50"
          aria-label={`Mon profil : ${user.firstName} ${user.lastName}, ${ROLE_LABEL[user.role]}`}
        >
          <Avatar src={user.avatarUrl} firstName={user.firstName} lastName={user.lastName} size="sm" />
          <span className="hidden min-w-0 leading-tight md:block">
            <span className="block max-w-[180px] truncate text-sm font-semibold text-ink-900">
              {user.firstName} {user.lastName}
            </span>
            <span className="block max-w-[180px] truncate text-xs text-ink-600">
              {ROLE_LABEL[user.role]}
              {user.orphanage ? ` · ${user.orphanage.name}` : user.province ? ` · ${user.province.nameFr}` : ''}
            </span>
          </span>
        </Link>
      )}
    </header>
  );
}
