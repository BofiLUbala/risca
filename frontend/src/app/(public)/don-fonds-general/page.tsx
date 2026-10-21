'use client';

import Link from 'next/link';
import { Globe2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { DonatePanel } from '@/components/donate/DonatePanel';

export default function GeneralFundPage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-risac-100 text-risac-600">
            <Globe2 className="h-6 w-6" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink-950 sm:text-3xl">
            Global Congo Children Fund
          </h1>
          <p className="mt-3 leading-relaxed text-ink-600">
            Le fonds g&eacute;n&eacute;ral n&apos;est pas affect&eacute; &agrave; un enfant
            particulier. Il est r&eacute;parti par le r&eacute;seau selon les urgences : soins,
            scolarit&eacute;, alimentation, infrastructures.
          </p>

          <ul className="mt-6 space-y-3 text-sm text-ink-600">
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-risac-400" />
              Chaque d&eacute;caissement passe par la s&eacute;paration des pouvoirs : la structure
              demande, l&apos;ambassadeur confirme, l&apos;Admin Finance paie.
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-risac-400" />
              Seules les structures labellis&eacute;es re&ccedil;oivent des fonds.
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-risac-400" />
              Les justificatifs sont obligatoires et remontent jusqu&apos;&agrave; votre espace.
            </li>
          </ul>
        </div>

        <aside>
          <div className="card card-pad lg:sticky lg:top-24">
            <h2 className="section-title">Soutenir le fonds</h2>
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
              <DonatePanel mode="GENERAL_FUND" />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
