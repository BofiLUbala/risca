import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const STATS = [
  { value: '150', label: 'Structures visées' },
  { value: '26', label: 'Provinces' },
  { value: '12', label: 'Rôles' },
];

/**
 * Pages d'accès (connexion, administrateur, inscription, activation).
 * Grand écran : le panneau de marque, avec le logo, est à gauche ; le formulaire est à droite.
 * Petit écran : le panneau disparaît, le logo passe au-dessus du formulaire.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside
        aria-label="Mission de RISAC"
        className="brand-band relative hidden w-[46%] max-w-[720px] shrink-0 overflow-hidden lg:block"
      >
        <div aria-hidden="true" className="absolute inset-y-0 right-0 w-1.5 bg-sun-400" />
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl"
        />

        <div className="relative flex h-full flex-col justify-between p-12 text-white xl:p-14">
          <Link
            href="/"
            aria-label="RISAC, retour à l’accueil"
            className="inline-block self-start rounded-2xl bg-[#ffffff] px-4 py-3 shadow-lift"
          >
            <Logo className="h-20" />
          </Link>

          <div>
            <blockquote className="max-w-lg">
              <p className="text-2xl font-semibold leading-snug xl:text-[1.75rem]">
                B&acirc;tir un &eacute;cosyst&egrave;me d&apos;excellence, de r&eacute;silience, de
                r&eacute;paration et d&apos;inclusion pour{' '}
                <span className="text-sun-400">l&apos;enfance vuln&eacute;rable</span> en
                R&eacute;publique D&eacute;mocratique du Congo.
              </p>
              <footer className="mt-5 text-sm text-onband">
                Ma&icirc;tre Ndondo Bonkendju Albert, Coordonnateur du RISAC
              </footer>
            </blockquote>

            <dl className="mt-12 grid grid-cols-3 gap-6 border-t border-white/20 pt-8">
              {STATS.map((s) => (
                <div key={s.label} className="border-l-4 border-sun-400 pl-3">
                  <dd className="text-2xl font-semibold">{s.value}</dd>
                  <dt className="mt-0.5 text-xs font-medium text-onband">{s.label}</dt>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col bg-ink-50 px-4 py-6 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between">
          <Link href="/" className="link-action -ml-1 px-1">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Retour à l&apos;accueil
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 flex-col justify-center py-8">
          <div className="mx-auto w-full max-w-md">
            <Link
              href="/"
              aria-label="RISAC, retour à l’accueil"
              className="mb-6 inline-block lg:hidden"
            >
              <Logo className="h-16" />
            </Link>
            <div className="card card-pad border-t-4 border-t-sun-400 shadow-lift sm:p-8">{children}</div>
            <p className="mt-6 text-center text-xs text-ink-500">
              Plateforme du Réseau International des Structures d&apos;Accueil du Congo
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
