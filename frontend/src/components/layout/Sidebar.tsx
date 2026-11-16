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
 *
 * Sur grand écran, le menu peut être réduit à une colonne d'icônes (`collapsed`) :
 * les libellés et les titres de groupe sont masqués, chaque icône garde un nom
 * accessible et une infobulle. Le tiroir mobile n'utilise pas ce mode.
 */
export function Sidebar({
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { color, side } = useLayoutPrefs();
  if (!user) return null;

  const groups = navForRole(user.role);
  const light = color === 'light';
  const right = side === 'right';
  const ToggleIcon = collapsed
    ? right
      ? Icons.PanelRightOpen
      : Icons.PanelLeftOpen
    : right
      ? Icons.PanelRightClose
      : Icons.PanelLeftClose;
  const toggleLabel = collapsed ? 'Agrandir le menu' : 'Réduire le menu';

  return (
    <div className={clsx('sb flex h-full flex-col overflow-hidden', `sb-${color}`)}>
      <div
        className={clsx('flex h-16 shrink-0 items-center border-b', collapsed ? 'justify-center px-2' : 'px-4')}
        style={{ borderColor: 'var(--sb-border)' }}
      >
        <Link
          href="/tableau-de-bord"
          onClick={onNavigate}
          aria-label="RISAC, tableau de bord"
          title={collapsed ? 'RISAC, tableau de bord' : undefined}
          className={clsx(!light && (collapsed ? 'rounded-lg bg-[#ffffff] p-1' : 'rounded-xl bg-[#ffffff] px-2 py-1'))}
        >
          {collapsed ? <Logo showText={false} className="h-8 w-8" /> : <Logo className={light ? 'h-12' : 'h-10'} />}
        </Link>
      </div>

      <nav
        className={clsx('flex-1 overflow-y-auto overflow-x-hidden px-3 py-5',
          // En colonne étroite, la barre de défilement mangerait la place des icônes : on la masque (la molette et le clavier restent actifs).
          collapsed ? 'space-y-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : 'space-y-6',
        )}
        aria-label="Navigation principale"
      >
        {GROUP_ORDER.filter((g) => groups[g]?.length).map((group, i) => (
          <div key={group}>
            {collapsed ? (
              <>
                <p className="sr-only">{group}</p>
                {i > 0 && (
                  <div className="mx-2 mb-3 border-t" style={{ borderColor: 'var(--sb-border)' }} aria-hidden="true" />
                )}
              </>
            ) : (
              <p className="mb-1.5 whitespace-nowrap px-3 text-xs font-semibold" style={{ color: 'var(--sb-group)' }}>
                {group}
              </p>
            )}
            <div className="space-y-0.5">
              {groups[group].map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={clsx('sb-item', collapsed && 'justify-center px-0', active && 'sb-item-active')}
                    aria-current={active ? 'page' : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-0.5 border-t p-3" style={{ borderColor: 'var(--sb-border)' }}>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className={clsx('sb-item', collapsed && 'justify-center px-0')}
            aria-label={toggleLabel}
            title={toggleLabel}
          >
            <ToggleIcon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
            {!collapsed && <span className="truncate">Réduire le menu</span>}
          </button>
        )}
        <button
          type="button"
          onClick={logout}
          className={clsx('sb-item', collapsed && 'justify-center px-0')}
          aria-label={collapsed ? 'Se déconnecter' : undefined}
          title={collapsed ? 'Se déconnecter' : undefined}
        >
          <Icons.LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
          {!collapsed && <span className="truncate">Se déconnecter</span>}
        </button>
      </div>
    </div>
  );
}
