'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import * as Icons from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { GROUP_ORDER, navForRole } from '@/lib/nav';
import { useAuth } from '@/lib/auth-context';
import { useLayoutPrefs } from '@/lib/layout-prefs';

function Icon({ name, className }: { name: string; className?: string }) {
  const C = (Icons as any)[name] ?? Icons.Circle;
  return <C className={className} strokeWidth={1.75} />;
}

/**
 * Menu latéral. La couleur suit le choix de la personne (Profil > Apparence).
 * Le logo officiel a un fond blanc : sur une couleur foncée il est posé sur une plaque blanche.
 * Le profil vit dans l'en-tête ; « Se déconnecter » ferme le menu, tout en bas.
 */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { color } = useLayoutPrefs();
  if (!user) return null;

  const groups = navForRole(user.role);
  const light = color === 'light';

  return (
    <div className={clsx('sb flex h-full flex-col', `sb-${color}`)}>
      <div className="flex h-16 shrink-0 items-center border-b px-4" style={{ borderColor: 'var(--sb-border)' }}>
        <Link
          href="/tableau-de-bord"
          onClick={onNavigate}
          aria-label="RISAC, tableau de bord"
          className={clsx(!light && 'rounded-xl bg-[#ffffff] px-2 py-1')}
        >
          <Logo className={light ? 'h-12' : 'h-10'} />
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Navigation principale">
        {GROUP_ORDER.filter((g) => groups[g]?.length).map((group) => (
          <div key={group}>
            <p className="mb-1.5 px-3 text-xs font-semibold" style={{ color: 'var(--sb-group)' }}>
              {group}
            </p>
            <div className="space-y-0.5">
              {groups[group].map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={clsx('sb-item', active && 'sb-item-active')}
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

      <div className="shrink-0 border-t p-3" style={{ borderColor: 'var(--sb-border)' }}>
        <button onClick={logout} className="sb-item">
          <Icons.LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
