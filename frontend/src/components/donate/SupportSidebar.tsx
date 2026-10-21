'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HeartHandshake } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { DonatePanel } from './DonatePanel';

export function SupportSidebar({ child }: { child: any }) {
  const { user } = useAuth();
  const [mode, setMode] = useState<'ONE_OFF' | 'SPONSORSHIP' | null>(null);

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <div className="card card-pad">
        <h2 className="section-title">Soutenir {child.firstName}</h2>

        {child.publicNeeds && (
          <p className="mt-2 flex items-start gap-2 rounded-xl bg-risac-50 px-3.5 py-3 text-sm text-risac-800">
            <HeartHandshake className="mt-0.5 h-4 w-4 shrink-0" />
            {child.publicNeeds}
          </p>
        )}

        {!user ? (
          <div className="mt-5 space-y-2">
            <Link href="/inscription" className="btn-primary w-full py-3">
              Créer un compte bailleur
            </Link>
            <Link href="/connexion" className="btn-outline w-full py-3">
              Se connecter
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setMode('ONE_OFF')}
                className={mode === 'ONE_OFF' ? 'btn-primary flex-1' : 'btn-outline flex-1'}
              >
                Financer
              </button>
              <button
                onClick={() => setMode('SPONSORSHIP')}
                className={mode === 'SPONSORSHIP' ? 'btn-primary flex-1' : 'btn-outline flex-1'}
              >
                Parrainer
              </button>
            </div>
            {mode && <DonatePanel mode={mode} childId={child.id} childName={child.firstName} />}
          </>
        )}

        <p className="mt-5 border-t border-ink-100 pt-4 text-xs leading-relaxed text-ink-400">
          Vous ecrivez à l’ambassadeur de l’enfant, jamais à l’enfant lui-même. Chaque dépense est
          justifiée par une facture ou une photo.
        </p>
      </div>
    </aside>
  );
}
