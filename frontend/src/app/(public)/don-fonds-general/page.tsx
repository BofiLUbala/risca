'use client';

import Link from 'next/link';
import { Globe2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { DonatePanel } from '@/components/donate/DonatePanel';
import { t } from '@/lib/i18n';

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
            {t("Global Congo Children Fund")}
          </h1>
          <p className="mt-3 leading-relaxed text-ink-600">
            {t("Le fonds général n'est pas affecté à un enfant particulier. Il est réparti par le réseau selon les urgences : soins, scolarité, alimentation, infrastructures.")}
          </p>

          <ul className="mt-6 space-y-3 text-sm text-ink-600">
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-risac-400" />
              {t("Chaque décaissement passe par la séparation des pouvoirs : la structure demande, l'ambassadeur confirme, l'Admin Finance paie.")}
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-risac-400" />
              {t("Seules les structures labellisées reçoivent des fonds.")}
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-risac-400" />
              {t("Les justificatifs sont obligatoires et remontent jusqu'à votre espace.")}
            </li>
          </ul>
        </div>

        <aside>
          <div className="card card-pad lg:sticky lg:top-24">
            <h2 className="section-title">{t("Soutenir le fonds")}</h2>
            {!user ? (
              <div className="mt-5 space-y-2">
                <Link href="/inscription" className="btn-primary w-full py-3">
                  {t("Créer un compte bailleur")}
                </Link>
                <Link href="/connexion" className="btn-outline w-full py-3">
                  {t("Se connecter")}
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
