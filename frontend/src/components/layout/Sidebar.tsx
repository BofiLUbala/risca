'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import * as Icons from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { GROUP_ORDER, navForRole } from '@/lib/nav';
import { ROLE_LABEL } from '@/lib/roles';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/lib/auth-context';

const GROUP_LABEL: Record<string, string> = {
  Pilotage: 'Pilotage',
  Suivi: 'Suivi',
  Réseau: 'Réseau',
  Argent: 'Argent',
  Gouvernance: 'Gouvernance',
  Administration: 'Administration',
};

function Icon({ name, className }: { name: string; className?: string }) {
  const C = (Icons as any)[name] ?? Icons.Circle;
  return <C className={className} strokeWidth={1.75} />;
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  if (!user) return null;

  const groups = navForRole(user.role);

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-16 shrink-0 items-center border-b border-ink-100 px-5">
        <Link href="/tableau-de-bord" onClick={onNavigate} aria-label="RISAC, tableau de bord">
          <Logo className="h-12" />
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        {GROUP_ORDER.filter((g) => groups[g]?.length).map((group) => (
          <div key={group}>
            <p className="mb-1.5 px-3 text-xs font-semibold text-ink-500">{GROUP_LABEL[group]}</p>
            <div className="space-y-0.5">
              {groups[group].map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={clsx('nav-item', active && 'nav-item-active')}
                    aria-current={active ? 'page' : undefined}
                  >
                    <Icon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-ink-100 p-3">
        <Link
          href="/profil"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-ink-50"
        >
          <Avatar
            src={user.avatarUrl}
            firstName={user.firstName}
            lastName={user.lastName}
            size="sm"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink-800">
              {user.firstName} {user.lastName}
            </span>
            <span className="block truncate text-xs text-ink-500">{ROLE_LABEL[user.role]}</span>
          </span>
        </Link>
        <button onClick={logout} className="nav-item mt-1 w-full text-ink-500">
          <Icons.LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
