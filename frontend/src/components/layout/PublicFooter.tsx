import Link from 'next/link';
import { Logo } from '@/components/ui/Logo';

export function PublicFooter() {
  return (
    <footer className="border-t border-ink-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo className="h-20" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-500">
              Réseau International des Structures d’Accueil du Congo, porté par l’ONG Congo Meilleur
              ASBL.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-ink-900">Le réseau</p>
            <ul className="mt-4 space-y-2.5 text-sm text-ink-500">
              <li>
                <Link href="/enfants-a-soutenir" className="inline-flex min-h-[44px] items-center hover:text-risac-700 sm:min-h-0">
                  Enfants à soutenir
                </Link>
              </li>
              <li>
                <Link href="/projets-ouverts" className="inline-flex min-h-[44px] items-center hover:text-risac-700 sm:min-h-0">
                  Projets en cours
                </Link>
              </li>
              <li>
                <Link href="/structures" className="inline-flex min-h-[44px] items-center hover:text-risac-700 sm:min-h-0">
                  Orphelinats labellisés
                </Link>
              </li>
              <li>
                <Link href="/partenaires" className="inline-flex min-h-[44px] items-center hover:text-risac-700 sm:min-h-0">
                  Partenaires
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-ink-900">Soutenir</p>
            <ul className="mt-4 space-y-2.5 text-sm text-ink-500">
              <li>
                <Link href="/inscription" className="inline-flex min-h-[44px] items-center hover:text-risac-700 sm:min-h-0">
                  Devenir bailleur
                </Link>
              </li>
              <li>
                <Link href="/don-fonds-general" className="inline-flex min-h-[44px] items-center hover:text-risac-700 sm:min-h-0">
                  Global Congo Children Fund
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-ink-900">Protection de l’enfant</p>
            <ul className="mt-4 space-y-2.5 text-sm text-ink-500">
              <li>Consentement photo obligatoire</li>
              <li>Aucun contact direct bailleur-enfant</li>
              <li>Localisation masquée en zone à risque</li>
              <li>Conformité RGPD et CDE</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-ink-100 pt-6 text-xs text-ink-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} RISAC — ONG Congo Meilleur ASBL.</p>
          <p>Batir un ecosysteme d’excellence, de resilience, de reparation et d’inclusion.</p>
        </div>
      </div>
    </footer>
  );
}
