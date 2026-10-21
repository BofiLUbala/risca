'use client';

import { useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { useAuth } from '@/lib/auth-context';

const LINKS = [
  { href: '/', label: 'Accueil' },
  { href: '/enfants-a-soutenir', label: 'Enfants à soutenir' },
  { href: '/projets-ouverts', label: 'Projets' },
  { href: '/structures', label: 'Orphelinats' },
  { href: '/partenaires', label: 'Partenaires' },
];

export function PublicHeader() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="RISAC, accueil">
          <Logo className="h-12" />
        </Link>

        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-risac-50 hover:text-risac-700"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          {user ? (
            <Link href="/tableau-de-bord" className="btn-primary">
              Mon espace
            </Link>
          ) : (
            <>
              <Link href="/connexion" className="btn-ghost">
                Se connecter
              </Link>
              <Link href="/inscription" className="btn-primary">
                Devenir bailleur
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="btn-ghost ml-auto h-10 w-10 p-0 md:hidden"
          aria-label="Menu"
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        className={clsx(
          'overflow-hidden border-t border-ink-100 bg-white transition-all duration-200 md:hidden',
          open ? 'max-h-96' : 'max-h-0',
        )}
      >
        <nav className="space-y-1 px-4 py-4">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-risac-50"
            >
              {l.label}
            </Link>
          ))}
          <div className="flex gap-2 pt-3">
            {user ? (
              <Link href="/tableau-de-bord" className="btn-primary flex-1">
                Mon espace
              </Link>
            ) : (
              <>
                <Link href="/connexion" className="btn-outline flex-1">
                  Se connecter
                </Link>
                <Link href="/inscription" className="btn-primary flex-1">
                  Devenir bailleur
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
