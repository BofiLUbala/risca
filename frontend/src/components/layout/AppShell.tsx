'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuth } from '@/lib/auth-context';
import { closeSocket, getSocket } from '@/lib/socket';
import { PushGate } from './PushGate';
import { PageLoading } from '@/components/ui/Loading';

/**
 * Coquille du tableau de bord : navigation des fonctionnalites a gauche,
 * detail de la fonctionnalite selectionnee a droite.
 * Sur petit ecran, la navigation devient un tiroir.
 */
export function AppShell({ title, children }: { title?: string; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/connexion');
  }, [loading, user, router]);

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

  if (loading) return <PageLoading />;
  if (!user) return null;

  return (
    <PushGate exempt={user.pushExempt}>
    <div className="flex min-h-screen bg-ink-50">
      <aside className="hidden w-[264px] shrink-0 border-r border-ink-100 lg:block">
        <div className="sticky top-0 h-screen">
          <Sidebar />
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
            'absolute inset-0 bg-ink-950/35 transition-opacity duration-200',
            open ? 'opacity-100' : 'opacity-0',
          )}
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
        <div
          className={clsx(
            'absolute inset-y-0 left-0 w-[280px] max-w-[85vw] shadow-lift transition-transform duration-200 ease-out',
            open ? 'translate-x-0' : '-translate-x-full',
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
