'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { canAccessPath } from '@/lib/nav';
import { saveLastPath } from '@/lib/remember';
import clsx from 'clsx';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuth } from '@/lib/auth-context';
import { closeSocket, getSocket } from '@/lib/socket';
import { PushGate } from './PushGate';
import { PageLoading } from '@/components/ui/Loading';
import { LayoutPrefsProvider, SIDEBAR_WIDTH, useLayoutPrefs } from '@/lib/layout-prefs';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Coquille du tableau de bord : navigation des fonctionnalites a gauche,
 * detail de la fonctionnalite selectionnee a droite.
 * Sur petit ecran, la navigation devient un tiroir.
 */
export function AppShell(props: { title?: string; children: React.ReactNode }) {
  return (
    <LayoutPrefsProvider>
      <AppShellInner {...props} />
    </LayoutPrefsProvider>
  );
}

function AppShellInner({ title, children }: { title?: string; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { side, collapsed, width, toggleCollapsed, setCollapsed, setWidth } = useLayoutPrefs();
  // Largeur en cours de glissement (null hors glissement).
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const right = side === 'right';
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const denied = !!user && !canAccessPath(user.role, pathname);

  useEffect(() => {
    if (!loading && !user) router.replace('/connexion');
  }, [loading, user, router]);

  // Dernière page visitée : on y revient à la réouverture du site ou à la reconnexion.
  useEffect(() => {
    if (user && !denied) saveLastPath(user.id, pathname + (typeof window !== 'undefined' ? window.location.search : ''));
  }, [user?.id, pathname, denied]);

  // Un rôle qui ouvre une page hors de son périmètre revient à son tableau de bord.
  useEffect(() => {
    if (denied) router.replace('/tableau-de-bord');
  }, [denied, router]);

  // Présence : le socket est ouvert dès l’entrée dans l’espace connecté, et non
  // seulement sur la messagerie, sinon « Connectés maintenant » ne compte que les
  // personnes qui ont la page Messagerie ouverte.
  useEffect(() => {
    if (!user) return;
    getSocket();
    return () => {
      closeSocket();
    };
  }, [user?.id]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (loading || denied) return <PageLoading />;
  if (!user) return null;

  // Sous ce seuil, le menu se range en colonne d'icônes.
  const snap = (SIDEBAR_WIDTH.rail + SIDEBAR_WIDTH.min) / 2;
  const dragging = dragWidth !== null;
  const shownWidth = dragging
    ? Math.min(SIDEBAR_WIDTH.max, Math.max(SIDEBAR_WIDTH.rail, dragWidth))
    : collapsed
      ? SIDEBAR_WIDTH.rail
      : width;
  const railMode = dragging ? dragWidth < snap : collapsed;

  const commitWidth = (w: number) => {
    if (w < snap) setCollapsed(true);
    else {
      setCollapsed(false);
      setWidth(w);
    }
  };

  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startW = shownWidth;
    let live = startW;
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      live = startW + (right ? -dx : dx);
      setDragWidth(live);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
      setDragWidth(null);
      if (Math.abs(live - startW) > 2) commitWidth(live);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const onHandleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const grow = right ? 'ArrowLeft' : 'ArrowRight';
    const shrink = right ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === grow || e.key === shrink) {
      e.preventDefault();
      const step = e.key === grow ? 24 : -24;
      if (collapsed && step > 0) setCollapsed(false);
      else commitWidth(width + step);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleCollapsed();
    }
  };

  // La flèche pointe vers où le menu va : vers le bord pour le réduire, vers le contenu pour l'agrandir.
  const pointsLeft = right ? collapsed : !collapsed;
  const EdgeIcon = pointsLeft ? ChevronLeft : ChevronRight;
  const edgeLabel = collapsed ? 'Agrandir le menu' : 'Réduire le menu';

  return (
    <PushGate exempt={user.pushExempt}>
    <div className={clsx('flex min-h-screen bg-surface', right && 'flex-row-reverse')}>
      <aside
        className={clsx(
          // Largeur animée (sauf pendant le glissement) : le contenu (flex-1) récupère la place libérée.
          'relative z-[35] hidden shrink-0 lg:block',
          !dragging && 'transition-[width] duration-base ease-standard motion-reduce:transition-none',
          right ? 'border-l border-ink-100' : 'border-r border-ink-100',
        )}
        style={{ width: shownWidth }}
      >
        <div className="sticky top-0 h-screen">
          <Sidebar collapsed={railMode} onToggleCollapse={toggleCollapsed} />

          {/* Bord tirable : glisser pour élargir ou rétrécir, jusqu'à la colonne d'icônes. */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Redimensionner le menu (flèches gauche et droite, Entrée pour réduire ou agrandir)"
            aria-valuemin={SIDEBAR_WIDTH.rail}
            aria-valuemax={SIDEBAR_WIDTH.max}
            aria-valuenow={Math.round(shownWidth)}
            tabIndex={0}
            title="Glisser pour changer la largeur du menu"
            onPointerDown={startDrag}
            onKeyDown={onHandleKey}
            onDoubleClick={toggleCollapsed}
            className={clsx(
              'group absolute inset-y-0 z-10 flex w-3 cursor-col-resize justify-center outline-none',
              right ? '-left-1.5' : '-right-1.5',
            )}
          >
            <span
              className={clsx(
                'h-full w-[3px] rounded-full transition-colors duration-base motion-reduce:transition-none',
                dragging ? 'bg-[#e7b92c]' : 'bg-transparent group-hover:bg-[#e7b92c]/70 group-focus-visible:bg-[#e7b92c]',
              )}
            />
          </div>

          {/* Bouton toujours visible, en haut sur le bord du menu. */}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={edgeLabel}
            title={edgeLabel}
            className={clsx(
              // Doré (couleur de la barre active) : bien visible sur fond clair comme sombre.
              'absolute top-[48px] z-20 grid h-8 w-8 place-items-center rounded-full bg-[#e7b92c] text-[#172430] shadow-md ring-2 ring-surface',
              'transition-transform duration-base hover:scale-110 motion-reduce:transition-none motion-reduce:hover:scale-100',
              'focus-visible:outline-none focus-visible:ring-[#172430]',
              right ? '-left-4' : '-right-4',
            )}
          >
            <EdgeIcon className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </button>
        </div>
      </aside>

      <div
        className={clsx(
          'fixed inset-0 z-50 lg:hidden',
          open ? 'pointer-events-auto' : 'pointer-events-none',
        )}
      >
        <div
          className={clsx(
            'absolute inset-0 bg-black/45 transition-opacity duration-200',
            open ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
        <div
          className={clsx(
            'absolute inset-y-0 w-[280px] max-w-[85vw] shadow-lift transition-transform duration-200 ease-out',
            right ? 'right-0' : 'left-0',
            open ? 'translate-x-0' : right ? 'translate-x-full' : '-translate-x-full',
          )}
          role="dialog"
          aria-label="Navigation"
        >
          <Sidebar onNavigate={() => setOpen(false)} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} onMenu={() => setOpen(true)} />
        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
          <div className="mx-auto w-full max-w-[1400px] animate-fade-up">{children}</div>
        </main>
      </div>
    </div>
    </PushGate>
  );
}
